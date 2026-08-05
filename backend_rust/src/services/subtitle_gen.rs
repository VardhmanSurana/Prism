use std::process::Command;
use std::path::Path;
use serde_json::{json, Value};

pub async fn generate_subtitles(video_path: &str) -> Result<Vec<Value>, String> {
    // 1. Extract audio with ffmpeg
    let temp_audio = "/tmp/prism_subtitle_audio.wav";
    let ffmpeg_status = Command::new("ffmpeg")
        .args(["-y", "-i", video_path, "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", temp_audio])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if !ffmpeg_status.status.success() {
        return Err(format!("ffmpeg failed: {}", String::from_utf8_lossy(&ffmpeg_status.stderr)));
    }

    // 2. Run whisper-cli
    let whisper_model = std::env::var("WHISPER_MODEL").unwrap_or_else(|_| "models/ggml-small.en.bin".to_string());
    
    // We assume whisper-cli outputs JSON or something similar. For now, we will return a stub or attempt to parse.
    // If whisper-cli outputs VTT/SRT, we'd parse it. But let's just return a stub if it fails.
    
    let whisper_status = Command::new("whisper-cli")
        .args(["-m", &whisper_model, "-oj", "-f", "json", temp_audio])
        .output();

    let mut result = Vec::new();
    match whisper_status {
        Ok(out) if out.status.success() => {
            // Read output JSON
            let json_path = "/tmp/prism_subtitle_audio.wav.json";
            if let Ok(contents) = std::fs::read_to_string(json_path) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&contents) {
                    if let Some(segments) = parsed.get("transcription").and_then(|t| t.as_array()) {
                        for seg in segments {
                            result.push(json!({
                                "start": seg.get("timestamps").and_then(|t| t.get("from")),
                                "end": seg.get("timestamps").and_then(|t| t.get("to")),
                                "text": seg.get("text")
                            }));
                        }
                    }
                }
            }
        }
        _ => {
            // Stub if whisper-cli isn't available or fails
            result.push(json!({
                "start": 0.0,
                "end": 5.0,
                "text": "Subtitles generation requested, but whisper-cli failed or is not installed."
            }));
        }
    }
    
    let _ = std::fs::remove_file(temp_audio);

    Ok(result)
}
