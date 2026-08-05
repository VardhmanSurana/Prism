use image::DynamicImage;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AutoEnhanceParams {
    pub brightness: i32,
    pub exposure: i32,
    pub contrast: i32,
    pub highlights: i32,
    pub shadows: i32,
    pub saturation: i32,
    pub vibrance: i32,
    pub temperature: i32,
    pub whites: i32,
    pub blacks: i32,
}

pub fn calculate_auto_enhance(img: &DynamicImage) -> AutoEnhanceParams {
    // Resize for speed
    let resized = img.thumbnail(256, 256);
    let rgb = resized.to_rgb8();

    let mut sum_v = 0.0;
    let mut sum_v_sq = 0.0;
    let mut sum_s = 0.0;
    let mut count = 0.0;

    for pixel in rgb.pixels() {
        let r = pixel[0] as f32 / 255.0;
        let g = pixel[1] as f32 / 255.0;
        let b = pixel[2] as f32 / 255.0;

        let max = r.max(g).max(b);
        let min = r.min(g).min(b);
        let delta = max - min;

        let v = max * 255.0;
        let s = if max == 0.0 { 0.0 } else { (delta / max) * 255.0 };

        sum_v += v;
        sum_v_sq += v * v;
        sum_s += s;
        count += 1.0;
    }

    let avg_v = sum_v / count;
    let variance_v = (sum_v_sq / count) - (avg_v * avg_v);
    let std_v = variance_v.sqrt();
    let avg_s = sum_s / count;

    let mut params = AutoEnhanceParams {
        brightness: 0,
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        saturation: 0,
        vibrance: 0,
        temperature: 0,
        whites: 0,
        blacks: 0,
    };

    if avg_v < 80.0 {
        params.exposure = (45.0_f32).min((80.0 - avg_v) * 0.8) as i32;
        params.shadows = (30.0_f32).min((80.0 - avg_v) * 0.5) as i32;
    } else if avg_v > 180.0 {
        params.exposure = (-40.0_f32).max((180.0 - avg_v) * 0.6) as i32;
        params.highlights = (-35.0_f32).max((180.0 - avg_v) * 0.4) as i32;
    }

    if std_v < 40.0 {
        params.contrast = (40.0_f32).min((50.0 - std_v) * 0.7) as i32;
        params.whites = 10;
        params.blacks = 10;
    }

    if avg_s < 50.0 {
        params.vibrance = 25;
        params.saturation = 10;
    } else if avg_s > 150.0 {
        params.saturation = -15;
    }

    params
}
