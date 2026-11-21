//! LOGIC — standalone image-file protocol; no stamp-generation requests.
use serde::{Deserialize, Serialize};

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputSettings {
    pub frame: Dimensions,
    pub exports: Vec<Dimensions>,
    pub default_width: u32,
    pub preview_max_edge: u32,
    pub jpeg_quality: u8,
    pub matte: [u8; 3],
}

impl OutputSettings {
    pub fn validate(&self) -> Result<(), String> {
        if self.frame.width == 0 || self.frame.height == 0 || self.preview_max_edge == 0
            || self.jpeg_quality == 0 || self.jpeg_quality > 100 || self.exports.is_empty()
            || !self.exports.iter().any(|size| size.width == self.default_width)
            || self.exports.iter().any(|size| size.width == 0 || size.height == 0
                || u64::from(size.width) * u64::from(self.frame.height) != u64::from(size.height) * u64::from(self.frame.width)) {
            return Err("Invalid frame output settings".into());
        }
        Ok(())
    }
}

#[derive(Clone, Deserialize, Serialize)]
pub struct Dimensions { pub width: u32, pub height: u32 }

#[derive(Clone, Copy, Deserialize)]
pub struct Transform { pub scale: f64, pub x: f64, pub y: f64, pub rotation: f64 }

#[derive(Deserialize)]
pub struct Request {
    pub id: u64,
    #[serde(flatten)]
    pub command: Command,
}

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case")]
pub enum Command {
    Load { path: String, preview_path: String },
    AcceptLoad { photo_id: u64 },
    FinalizeLoad { photo_id: u64 },
    DiscardLoad { photo_id: u64 },
    Export { path: String, width: u32, photo_id: Option<u64>, transform: Transform },
}
