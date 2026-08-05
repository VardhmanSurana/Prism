#![allow(dead_code)]

use exif::{In, Reader, Tag, Value};
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug, Default, Clone)]
#[derive(serde::Serialize, serde::Deserialize)]
pub struct ExifMetadata {
    pub make: Option<String>,
    pub model: Option<String>,
    pub focal_length: Option<f64>,
    pub iso: Option<i32>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub date_taken: Option<String>,
}

pub fn extract_exif(path: &Path) -> ExifMetadata {
    let file = match File::open(path) {
        Ok(f) => f,
        Err(_) => return ExifMetadata::default(),
    };

    let mut buf = BufReader::new(file);
    let exif_reader = Reader::new();
    let exif = match exif_reader.read_from_container(&mut buf) {
        Ok(exif) => exif,
        Err(_) => return ExifMetadata::default(),
    };

    let mut metadata = ExifMetadata::default();

    if let Some(field) = exif.get_field(Tag::Make, In::PRIMARY) {
        metadata.make = Some(field.display_value().to_string().trim_matches('"').to_string());
    }

    if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
        metadata.model = Some(field.display_value().to_string().trim_matches('"').to_string());
    }

    if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
        if let Value::Rational(ref vec) = field.value {
            if let Some(r) = vec.first() {
                if r.denom != 0 {
                    metadata.focal_length = Some(r.num as f64 / r.denom as f64);
                }
            }
        }
    }

    if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
        if let Value::Short(ref vec) = field.value {
            if let Some(&iso) = vec.first() {
                metadata.iso = Some(iso as i32);
            }
        }
    }

    if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
        metadata.date_taken = Some(field.display_value().to_string());
    }

    metadata
}
