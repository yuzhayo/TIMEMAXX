//! LOGIC — render full-resolution photo pixels onto the fixed black frame, then encode.
use crate::protocol::{OutputSettings, Transform};
use image::{Rgb, RgbImage, RgbaImage};
use std::{fs::File, io::BufWriter, path::Path};

pub fn render(photo: Option<&RgbaImage>, transform: Transform, width: u32, settings: &OutputSettings) -> Result<RgbImage, String> {
    if ![transform.scale, transform.x, transform.y, transform.rotation].iter().all(|n| n.is_finite()) || transform.scale <= 0.0 {
        return Err("Photo transform must be finite with a positive scale".into());
    }
    let size = settings.exports.iter().find(|size| size.width == width).ok_or("Unsupported export resolution")?;
    let mut output = RgbImage::from_pixel(size.width, size.height, Rgb(settings.matte));
    let Some(photo) = photo else { return Ok(output); };
    let ratio = f64::from(size.width) / f64::from(settings.frame.width);
    let (sin, cos) = transform.rotation.to_radians().sin_cos();
    for (x, y, destination) in output.enumerate_pixels_mut() {
        let dx = (f64::from(x) + 0.5) / ratio - f64::from(settings.frame.width) / 2.0 - transform.x;
        let dy = (f64::from(y) + 0.5) / ratio - f64::from(settings.frame.height) / 2.0 - transform.y;
        let sx = (cos * dx + sin * dy) / transform.scale + f64::from(photo.width()) / 2.0 - 0.5;
        let sy = (-sin * dx + cos * dy) / transform.scale + f64::from(photo.height()) / 2.0 - 0.5;
        *destination = sample(photo, sx, sy, settings.matte);
    }
    Ok(output)
}

fn sample(photo: &RgbaImage, x: f64, y: f64, matte: [u8; 3]) -> Rgb<u8> {
    let x0 = x.floor() as i64;
    let y0 = y.floor() as i64;
    let mut channels = matte.map(f64::from);
    for (px, wx) in [(x0, 1.0 - (x - x0 as f64)), (x0 + 1, x - x0 as f64)] {
        for (py, wy) in [(y0, 1.0 - (y - y0 as f64)), (y0 + 1, y - y0 as f64)] {
            if px < 0 || py < 0 || px >= i64::from(photo.width()) || py >= i64::from(photo.height()) { continue; }
            let pixel = photo.get_pixel(px as u32, py as u32).0;
            let weight = wx * wy * f64::from(pixel[3]) / 255.0;
            for c in 0..3 { channels[c] += (f64::from(pixel[c]) - f64::from(matte[c])) * weight; }
        }
    }
    Rgb(channels.map(|value| value.round().clamp(0.0, 255.0) as u8))
}

pub fn save(image: &RgbImage, path: &Path, quality: u8) -> Result<(), String> {
    let extension = path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase();
    match extension.as_str() {
        "png" => image.save_with_format(path, image::ImageFormat::Png).map_err(|e| e.to_string()),
        "jpg" | "jpeg" => {
            let file = File::create(path).map_err(|e| e.to_string())?;
            image::codecs::jpeg::JpegEncoder::new_with_quality(BufWriter::new(file), quality)
                .encode_image(image).map_err(|e| e.to_string())
        },
        _ => Err("Choose PNG or JPEG for export".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::Dimensions;
    fn settings() -> OutputSettings {
        OutputSettings { frame: Dimensions { width: 3, height: 4 }, exports: vec![Dimensions { width: 3, height: 4 }], default_width: 3, preview_max_edge: 4, jpeg_quality: 95, matte: [0, 0, 0] }
    }
    #[test]
    fn black_and_identity_photo_pixels_are_real_output() {
        let transform = Transform { scale: 1.0, x: 0.0, y: 0.0, rotation: 0.0 };
        assert!(render(None, transform, 3, &settings()).unwrap().pixels().all(|pixel| pixel.0 == [0, 0, 0]));
        let photo = RgbaImage::from_pixel(3, 4, image::Rgba([200, 100, 50, 128]));
        assert_eq!(render(Some(&photo), transform, 3, &settings()).unwrap().get_pixel(1, 1).0, [100, 50, 25]);
    }
    #[test]
    fn invalid_transform_or_export_is_rejected() {
        let invalid = Transform { scale: 0.0, x: 0.0, y: 0.0, rotation: 0.0 };
        assert!(render(None, invalid, 3, &settings()).is_err());
        assert!(render(None, Transform { scale: 1.0, ..invalid }, 10, &settings()).is_err());
    }
}
