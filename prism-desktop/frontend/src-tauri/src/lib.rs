use std::io::{BufRead, BufReader};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use quick_xml::events::Event;
use quick_xml::XmlVersion;
use quick_xml::Reader;
use tauri::{AppHandle, Emitter, Manager};

const MAX_MLT_XML_BYTES: usize = 5 * 1024 * 1024;
const ALLOWED_EXPORT_EXTENSIONS: &[&str] = &["mp4", "mov", "mkv", "webm"];
const ALLOWED_MEDIA_EXTENSIONS: &[&str] = &[
    "mp4", "mov", "mkv", "webm", "m4v", "avi", "mp3", "wav", "aac", "flac", "ogg",
    "jpg", "jpeg", "png", "webp", "gif", "tif", "tiff",
];

fn is_within(path: &Path, roots: &[PathBuf]) -> bool {
    roots.iter().any(|root| path.starts_with(root))
}

fn allowed_user_roots(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    let mut roots = vec![
        app.path().home_dir().map_err(|e| format!("Unable to resolve home directory: {e}"))?,
        app.path().app_data_dir().map_err(|e| format!("Unable to resolve app data directory: {e}"))?,
    ];

    #[cfg(target_os = "linux")]
    roots.extend([PathBuf::from("/media"), PathBuf::from("/run/media"), PathBuf::from("/mnt")]);
    #[cfg(target_os = "macos")]
    roots.push(PathBuf::from("/Volumes"));

    roots.retain(|root| root.exists());
    Ok(roots)
}

fn contains_parent_traversal(path: &Path) -> bool {
    path.components().any(|component| matches!(component, Component::ParentDir))
}

fn has_allowed_extension(path: &Path, allowed: &[&str]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| allowed.iter().any(|allowed_extension| extension.eq_ignore_ascii_case(allowed_extension)))
        .unwrap_or(false)
}

fn validate_output_path(output_path: &str, roots: &[PathBuf]) -> Result<PathBuf, String> {
    let requested = PathBuf::from(output_path);
    if !requested.is_absolute() || contains_parent_traversal(&requested) {
        return Err("Export path must be an absolute path without traversal".to_string());
    }
    if !has_allowed_extension(&requested, ALLOWED_EXPORT_EXTENSIONS) {
        return Err("Export format is not supported".to_string());
    }

    let file_name = requested.file_name().ok_or("Export path must include a filename")?;
    let parent = requested.parent().ok_or("Export path must include a parent directory")?;
    let canonical_parent = parent.canonicalize().map_err(|_| "Export directory does not exist or is inaccessible".to_string())?;
    if !canonical_parent.is_dir() || !is_within(&canonical_parent, roots) {
        return Err("Export path is outside the allowed user directories".to_string());
    }

    let resolved = canonical_parent.join(file_name);
    if let Ok(metadata) = std::fs::symlink_metadata(&resolved) {
        if metadata.file_type().is_symlink() {
            return Err("Export path must not overwrite a symlink".to_string());
        }
        if !metadata.is_file() {
            return Err("Export path must refer to a file".to_string());
        }
    }
    Ok(resolved)
}

fn validate_media_reference(resource: &str, roots: &[PathBuf]) -> Result<(), String> {
    if resource == "black" {
        return Ok(());
    }

    let path = PathBuf::from(resource);
    if !path.is_absolute() || contains_parent_traversal(&path) || !has_allowed_extension(&path, ALLOWED_MEDIA_EXTENSIONS) {
        return Err("MLT XML contains an invalid media reference".to_string());
    }
    let resolved = path.canonicalize().map_err(|_| "MLT XML references a missing or inaccessible media file".to_string())?;
    if !resolved.is_file() || !is_within(&resolved, roots) {
        return Err("MLT XML references media outside the allowed user directories".to_string());
    }
    Ok(())
}

fn validate_mlt_xml(xml: &str, roots: &[PathBuf]) -> Result<(), String> {
    if xml.len() > MAX_MLT_XML_BYTES || xml.contains("<!DOCTYPE") || xml.contains("<!ENTITY") {
        return Err("MLT XML is too large or contains a forbidden declaration".to_string());
    }

    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut root_seen = false;
    let mut resource_property = false;

    loop {
        match reader.read_event_into(&mut buffer).map_err(|e| format!("Invalid MLT XML: {e}"))? {
            Event::Start(event) => {
                if !root_seen {
                    if event.name().as_ref() != b"mlt" {
                        return Err("MLT XML root element must be <mlt>".to_string());
                    }
                    root_seen = true;
                }
                resource_property = event.name().as_ref() == b"property"
                    && event.attributes().flatten().any(|attribute| {
                        attribute.key.as_ref() == b"name" && attribute.value.as_ref() == b"resource"
                    });
            }
            Event::Text(text) if resource_property => {
                let resource = text.xml_content(XmlVersion::Explicit1_0).map_err(|e| format!("Invalid MLT resource value: {e}"))?;
                validate_media_reference(&resource, roots)?;
            }
            Event::End(event) if event.name().as_ref() == b"property" => resource_property = false,
            Event::Eof => break,
            _ => {}
        }
        buffer.clear();
    }

    if !root_seen {
        return Err("MLT XML is empty".to_string());
    }
    Ok(())
}

fn which_melt() -> Option<String> {
    if let Ok(path) = std::env::var("PATH") {
        for dir in std::env::split_paths(&path) {
            let bin_path_7 = dir.join("melt-7");
            if bin_path_7.exists() {
                return Some(bin_path_7.to_string_lossy().into_owned());
            }
            let bin_path = dir.join("melt");
            if bin_path.exists() {
                return Some(bin_path.to_string_lossy().into_owned());
            }
        }
    }
    for path in &["/usr/bin/melt-7", "/usr/bin/melt", "/usr/local/bin/melt-7", "/usr/local/bin/melt"] {
        if std::path::Path::new(path).exists() {
            return Some(path.to_string());
        }
    }
    None
}

#[tauri::command]
async fn nle_export_local(
    app: AppHandle,
    mlt_xml: String,
    output_path: String,
    width: u32,
    height: u32,
    _fps: u32,
    _quality: String,
) -> Result<String, String> {
    let allowed_roots = allowed_user_roots(&app)?;
    validate_mlt_xml(&mlt_xml, &allowed_roots)?;
    let output_path = validate_output_path(&output_path, &allowed_roots)?;

    tauri::async_runtime::spawn_blocking(move || {
        let temp_dir = std::env::temp_dir();
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let temp_xml_path = temp_dir.join(format!("prism_nle_{}_{}.mlt", std::process::id(), timestamp));
        let mut temp_file = std::fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temp_xml_path)
            .map_err(|e| format!("Unable to create temporary MLT file: {e}"))?;
        use std::io::Write;
        temp_file.write_all(mlt_xml.as_bytes()).map_err(|e| e.to_string())?;

        let melt_bin = which_melt().ok_or_else(|| "melt command not found on system".to_string())?;

        let mut child = Command::new(&melt_bin)
            .arg(&temp_xml_path)
            .arg("-consumer")
            .arg(format!("avformat:{}", output_path.display()))
            .arg(format!("profile={}x{}", width, height))
            .arg("vcodec=libx264")
            .arg("acodec=aac")
            .arg("-progress")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;

        let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
        let reader = BufReader::new(stdout);

        let mut current_frame = 0.0;
        let mut total_frames = 0.0;

        for line in reader.lines() {
            if let Ok(line_str) = line {
                let trimmed = line_str.trim();
                if trimmed.starts_with("current=") {
                    if let Some(val) = trimmed.split('=').nth(1) {
                        if let Ok(curr) = val.parse::<f64>() {
                            current_frame = curr;
                        }
                    }
                } else if trimmed.starts_with("duration=") {
                    if let Some(val) = trimmed.split('=').nth(1) {
                        if let Ok(dur) = val.parse::<f64>() {
                            total_frames = dur;
                        }
                    }
                }

                if total_frames > 0.0 {
                    let progress = (current_frame / total_frames).clamp(0.0, 1.0);
                    let _ = app.emit("nle-export-progress", progress);
                }
            }
        }

        let status = child.wait().map_err(|e| e.to_string())?;
        let _ = std::fs::remove_file(temp_xml_path);

        if status.success() {
            Ok(output_path.to_string_lossy().into_owned())
        } else {
            Err("melt process failed during export".to_string())
        }
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![nle_export_local])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_root() -> PathBuf {
        let root = std::env::temp_dir().join(format!("prism-native-export-test-{}", std::process::id()));
        std::fs::create_dir_all(&root).unwrap();
        root.canonicalize().unwrap()
    }

    #[test]
    fn accepts_mlt_media_references_within_allowed_roots() {
        let root = test_root();
        let media = root.join("clip.mp4");
        std::fs::write(&media, b"test").unwrap();
        let xml = format!("<mlt><producer><property name=\"resource\">{}</property></producer></mlt>", media.display());

        assert!(validate_mlt_xml(&xml, &[root]).is_ok());
    }

    #[test]
    fn rejects_mlt_traversal_and_non_media_references() {
        let root = test_root();
        let traversal = "<mlt><producer><property name=\"resource\">/tmp/../etc/passwd</property></producer></mlt>";
        let non_media = "<mlt><producer><property name=\"resource\">/tmp/not-a-video.txt</property></producer></mlt>";

        assert!(validate_mlt_xml(traversal, &[root.clone()]).is_err());
        assert!(validate_mlt_xml(non_media, &[root]).is_err());
    }

    #[test]
    fn constrains_output_to_existing_allowed_directories() {
        let root = test_root();
        let output = root.join("export.mp4");

        assert_eq!(validate_output_path(output.to_str().unwrap(), &[root.clone()]).unwrap(), output);
        assert!(validate_output_path("/tmp/../etc/export.mp4", &[root.clone()]).is_err());
        assert!(validate_output_path(root.join("export.txt").to_str().unwrap(), &[root]).is_err());
    }
}
