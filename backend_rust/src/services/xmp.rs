//! Adobe Camera Raw compatible XMP sidecar generator and parser.

use std::path::Path;
use serde_json::{json, Value};
use crate::models::Photo;

/// Generates valid Adobe Camera Raw XML formatted XMP sidecar metadata string.
#[allow(dead_code)]
pub fn generate_xmp(photo: &Photo, adjustments: &Value) -> String {
    let exposure = adjustments.get("exposure").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let contrast = adjustments.get("contrast").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let highlights = adjustments.get("highlights").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let shadows = adjustments.get("shadows").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let saturation = adjustments.get("saturation").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let has_crop = adjustments.get("crop").is_some();

    let exposure_str = if exposure >= 0.0 { format!("+{:.2}", exposure) } else { format!("{:.2}", exposure) };
    let contrast_str = if contrast >= 0.0 { format!("+{:.0}", contrast) } else { format!("{:.0}", contrast) };
    let highlights_str = if highlights >= 0.0 { format!("+{:.0}", highlights) } else { format!("{:.0}", highlights) };
    let shadows_str = if shadows >= 0.0 { format!("+{:.0}", shadows) } else { format!("{:.0}", shadows) };
    let saturation_str = if saturation >= 0.0 { format!("+{:.0}", saturation) } else { format!("{:.0}", saturation) };

    let date_str = photo.date_taken
        .map(|d| d.to_rfc3339())
        .or_else(|| photo.date.map(|d| d.to_rfc3339()))
        .unwrap_or_default();

    let make = photo.exif_make.as_deref().unwrap_or("Unknown");
    let model = photo.exif_model.as_deref().unwrap_or("Unknown");
    let caption = photo.caption.as_deref().or(photo.ai_summary.as_deref()).unwrap_or("");

    format!(
r#"<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Prism Photo Manager">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:tiff="http://ns.adobe.com/tiff/1.0/"
    xmlns:exif="http://ns.adobe.com/exif/1.0/"
    xmlns:xmp="http://ns.adobe.com/xap/1.0/"
    crs:Version="16.0"
    crs:ProcessVersion="15.4"
    crs:Exposure2012="{}"
    crs:Contrast2012="{}"
    crs:Highlights2012="{}"
    crs:Shadows2012="{}"
    crs:Saturation="{}"
    crs:HasCrop="{}"
    tiff:Make="{}"
    tiff:Model="{}"
    exif:DateTimeOriginal="{}">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">{}</rdf:li>
    </rdf:Alt>
   </dc:title>
   <dc:description>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">{}</rdf:li>
    </rdf:Alt>
   </dc:description>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>"#,
        exposure_str,
        contrast_str,
        highlights_str,
        shadows_str,
        saturation_str,
        if has_crop { "True" } else { "False" },
        make,
        model,
        date_str,
        photo.filename,
        caption
    )
}

/// Parses Adobe Camera Raw XML format and extracts adjustments into Prism JSON.
#[allow(dead_code)]
pub fn parse_xmp(xml_content: &str) -> Option<Value> {
    if !xml_content.contains("crs:Exposure2012") && !xml_content.contains("crs:Contrast2012") && !xml_content.contains("camera-raw-settings") {
        return None;
    }

    let extract_attr = |attr: &str| -> Option<f64> {
        let pattern = format!("{}=\"", attr);
        if let Some(start) = xml_content.find(&pattern) {
            let val_start = start + pattern.len();
            if let Some(end) = xml_content[val_start..].find('"') {
                let s = &xml_content[val_start..val_start + end];
                return s.trim_start_matches('+').parse::<f64>().ok();
            }
        }
        None
    };

    let exposure = extract_attr("crs:Exposure2012").unwrap_or(0.0);
    let contrast = extract_attr("crs:Contrast2012").unwrap_or(0.0);
    let highlights = extract_attr("crs:Highlights2012").unwrap_or(0.0);
    let shadows = extract_attr("crs:Shadows2012").unwrap_or(0.0);
    let saturation = extract_attr("crs:Saturation").unwrap_or(0.0);

    let has_crop = xml_content.contains("crs:HasCrop=\"True\"");

    Some(json!({
        "exposure": exposure,
        "contrast": contrast,
        "highlights": highlights,
        "shadows": shadows,
        "saturation": saturation,
        "has_crop": has_crop,
    }))
}

/// Writes an XMP sidecar file alongside the given photo path.
pub fn write_xmp_sidecar(photo_path: &Path, adjustments: &Value) -> Result<(), std::io::Error> {
    let xmp_path = photo_path.with_extension("xmp");
    let exposure = adjustments.get("exposure").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let contrast = adjustments.get("contrast").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let highlights = adjustments.get("highlights").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let shadows = adjustments.get("shadows").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let saturation = adjustments.get("saturation").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let has_crop = adjustments.get("crop").is_some();

    let exposure_str = if exposure >= 0.0 { format!("+{:.2}", exposure) } else { format!("{:.2}", exposure) };
    let contrast_str = if contrast >= 0.0 { format!("+{:.0}", contrast) } else { format!("{:.0}", contrast) };
    let highlights_str = if highlights >= 0.0 { format!("+{:.0}", highlights) } else { format!("{:.0}", highlights) };
    let shadows_str = if shadows >= 0.0 { format!("+{:.0}", shadows) } else { format!("{:.0}", shadows) };
    let saturation_str = if saturation >= 0.0 { format!("+{:.0}", saturation) } else { format!("{:.0}", saturation) };

    let filename = photo_path.file_name().and_then(|n| n.to_str()).unwrap_or("");

    let xmp_content = format!(
r#"<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Prism Photo Manager">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about=""
    xmlns:crs="http://ns.adobe.com/camera-raw-settings/1.0/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    crs:Version="16.0"
    crs:ProcessVersion="15.4"
    crs:Exposure2012="{}"
    crs:Contrast2012="{}"
    crs:Highlights2012="{}"
    crs:Shadows2012="{}"
    crs:Saturation="{}"
    crs:HasCrop="{}">
   <dc:title>
    <rdf:Alt>
     <rdf:li xml:lang="x-default">{}</rdf:li>
    </rdf:Alt>
   </dc:title>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>"#,
        exposure_str,
        contrast_str,
        highlights_str,
        shadows_str,
        saturation_str,
        if has_crop { "True" } else { "False" },
        filename
    );

    std::fs::write(xmp_path, xmp_content)
}
