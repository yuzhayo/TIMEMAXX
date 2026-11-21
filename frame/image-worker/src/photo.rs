//! LOGIC — decoding and orientation; only replace the session after successful decode.
use image::{DynamicImage, ImageDecoder, ImageReader, RgbaImage};
use std::path::Path;

pub fn load(path: &Path, preview_path: &Path, preview_edge: u32) -> Result<RgbaImage, String> {
    let mut decoder = ImageReader::open(path).map_err(|e| e.to_string())?
        .with_guessed_format().map_err(|e| e.to_string())?
        .into_decoder().map_err(|e| e.to_string())?;
    let orientation = decoder.orientation().map_err(|e| e.to_string())?;
    let mut image = DynamicImage::from_decoder(decoder).map_err(|e| e.to_string())?;
    image.apply_orientation(orientation);
    if image.width() == 0 || image.height() == 0 { return Err("Image has empty dimensions".into()); }
    image.thumbnail(preview_edge, preview_edge).save_with_format(preview_path, image::ImageFormat::Png).map_err(|e| e.to_string())?;
    Ok(image.into_rgba8())
}
