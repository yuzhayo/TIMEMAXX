//! LOGIC — one owner for original image identity; no renderer thumbnails in exports.
use crate::{export, photo, protocol::{Command, OutputSettings}};
use image::RgbaImage;
use serde_json::{Value, json};
use std::path::{Path, PathBuf};

struct LoadedPhoto { image: RgbaImage, id: u64, source: PathBuf }
struct PendingLoad { id: u64, candidate: Option<LoadedPhoto>, previous: Option<LoadedPhoto>, accepted: bool }
pub struct Session { photo: Option<LoadedPhoto>, pending: Option<PendingLoad>, next_id: u64, settings: OutputSettings }

impl Session {
    pub fn new(settings: OutputSettings) -> Self { Self { photo: None, pending: None, next_id: 0, settings } }
    pub fn execute(&mut self, command: Command) -> Result<Value, String> {
        match command {
            Command::Load { path, preview_path } => {
                if self.pending.is_some() { return Err("A photo candidate is awaiting acceptance".into()); }
                let source = Path::new(&path).canonicalize().map_err(|e| e.to_string())?;
                let image = photo::load(&source, Path::new(&preview_path), self.settings.preview_max_edge)?;
                let (width, height) = image.dimensions();
                let id = self.next_id.checked_add(1).filter(|id| *id <= 9_007_199_254_740_991).ok_or("Photo identity exhausted")?;
                self.next_id = id;
                self.pending = Some(PendingLoad { id, candidate: Some(LoadedPhoto { image, id, source }), previous: None, accepted: false });
                Ok(json!({ "photoId": id, "width": width, "height": height }))
            },
            Command::AcceptLoad { photo_id } => {
                if self.pending.is_none() && self.photo.as_ref().is_some_and(|photo| photo.id == photo_id) {
                    return Ok(json!({ "photoId": photo_id }));
                }
                let pending = self.pending.as_mut().filter(|pending| pending.id == photo_id).ok_or("Photo candidate no longer active")?;
                if !pending.accepted {
                    pending.previous = self.photo.take();
                    self.photo = pending.candidate.take();
                    pending.accepted = true;
                }
                Ok(json!({ "photoId": photo_id }))
            },
            Command::FinalizeLoad { photo_id } => {
                if !self.photo.as_ref().is_some_and(|photo| photo.id == photo_id) { return Err("Accepted photo identity changed".into()); }
                if let Some(pending) = &self.pending {
                    if pending.id != photo_id || !pending.accepted { return Err("Photo candidate has not been accepted".into()); }
                }
                self.pending = None;
                Ok(json!({ "photoId": photo_id }))
            },
            Command::DiscardLoad { photo_id } => {
                let pending = self.pending.as_mut().filter(|pending| pending.id == photo_id).ok_or("Photo candidate no longer active")?;
                if pending.accepted { self.photo = pending.previous.take(); }
                self.pending = None;
                Ok(json!({ "photoId": self.photo.as_ref().map(|photo| photo.id) }))
            },
            Command::Export { path, width, photo_id, transform } => {
                let destination = Path::new(&path);
                if let Ok(existing) = destination.canonicalize() {
                    let pending = self.pending.as_ref();
                    if [self.photo.as_ref(), pending.and_then(|pending| pending.previous.as_ref()), pending.and_then(|pending| pending.candidate.as_ref())]
                        .into_iter().flatten().any(|photo| photo.source == existing) {
                        return Err("The original photo cannot be overwritten".into());
                    }
                }
                let photo = match photo_id {
                    None => None,
                    Some(id) => Some(self.photo.as_ref().filter(|photo| photo.id == id)
                        .or_else(|| self.pending.as_ref().and_then(|pending| pending.previous.as_ref()).filter(|photo| photo.id == id))
                        .ok_or("Loaded photo identity changed; save again")?),
                };
                let rendered = export::render(photo.map(|photo| &photo.image), transform, width, &self.settings)?;
                export::save(&rendered, destination, self.settings.jpeg_quality)?;
                Ok(json!({ "path": path, "width": rendered.width(), "height": rendered.height() }))
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::{Dimensions, Transform};
    use image::Rgba;
    use std::sync::atomic::{AtomicU64, Ordering};
    static NEXT: AtomicU64 = AtomicU64::new(0);
    struct Fixture { directory: PathBuf, session: Session }
    impl Fixture {
        fn new() -> Self {
            let directory = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../.runtime/checks/photo-replacement")
                .join(format!("rust-{}-{}", std::process::id(), NEXT.fetch_add(1, Ordering::Relaxed)));
            std::fs::create_dir_all(&directory).unwrap();
            let settings = OutputSettings { frame: Dimensions { width: 3, height: 4 }, exports: vec![Dimensions { width: 3, height: 4 }],
                default_width: 3, preview_max_edge: 4, jpeg_quality: 95, matte: [0, 0, 0] };
            Self { directory, session: Session::new(settings) }
        }
        fn load(&mut self, color: u8) -> u64 {
            let path = self.directory.join(format!("source-{color}.png"));
            RgbaImage::from_pixel(3, 4, Rgba([color, 0, 0, 255])).save(&path).unwrap();
            self.session.execute(Command::Load { path: path.to_string_lossy().into(), preview_path: self.directory.join("preview.png").to_string_lossy().into() })
                .unwrap()["photoId"].as_u64().unwrap()
        }
        fn pixel(&mut self, id: Option<u64>) -> Result<u8, String> {
            let path = self.directory.join("export.png");
            self.session.execute(Command::Export { path: path.to_string_lossy().into(), width: 3, photo_id: id,
                transform: Transform { scale: 1.0, x: 0.0, y: 0.0, rotation: 0.0 } })?;
            Ok(image::open(path).unwrap().to_rgb8().get_pixel(1, 1).0[0])
        }
    }
    impl Drop for Fixture { fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.directory); } }
    #[test]
    fn preparation_retains_old_pixels_and_discard_does_not_reuse_identity() {
        let mut f = Fixture::new(); let old = f.load(40);
        f.session.execute(Command::AcceptLoad { photo_id: old }).unwrap();
        f.session.execute(Command::FinalizeLoad { photo_id: old }).unwrap();
        let next = f.load(80); assert_eq!(f.pixel(Some(old)).unwrap(), 40); assert!(f.pixel(Some(next)).is_err());
        f.session.execute(Command::DiscardLoad { photo_id: next }).unwrap();
        assert_eq!(f.pixel(Some(old)).unwrap(), 40); assert!(f.load(120) > next);
    }
    #[test]
    fn acceptance_retains_rollback_pixels_until_explicit_finalization() {
        let mut f = Fixture::new(); let old = f.load(40);
        f.session.execute(Command::AcceptLoad { photo_id: old }).unwrap(); f.session.execute(Command::FinalizeLoad { photo_id: old }).unwrap();
        let next = f.load(80); f.session.execute(Command::AcceptLoad { photo_id: next }).unwrap();
        assert_eq!(f.pixel(Some(old)).unwrap(), 40); assert_eq!(f.pixel(Some(next)).unwrap(), 80);
        f.session.execute(Command::AcceptLoad { photo_id: next }).unwrap();
        f.session.execute(Command::FinalizeLoad { photo_id: next }).unwrap(); f.session.execute(Command::FinalizeLoad { photo_id: next }).unwrap();
        assert!(f.pixel(Some(old)).is_err()); assert_eq!(f.pixel(Some(next)).unwrap(), 80);
    }
    #[test]
    fn rollback_and_foreign_tickets_cannot_mutate_another_candidate() {
        let mut f = Fixture::new(); let old = f.load(40);
        f.session.execute(Command::AcceptLoad { photo_id: old }).unwrap(); f.session.execute(Command::FinalizeLoad { photo_id: old }).unwrap();
        let next = f.load(80);
        assert!(f.session.execute(Command::DiscardLoad { photo_id: old }).is_err());
        assert!(f.session.execute(Command::AcceptLoad { photo_id: old + 99 }).is_err());
        assert!(f.session.execute(Command::FinalizeLoad { photo_id: next }).is_err());
        f.session.execute(Command::AcceptLoad { photo_id: next }).unwrap(); f.session.execute(Command::DiscardLoad { photo_id: next }).unwrap();
        assert_eq!(f.pixel(Some(old)).unwrap(), 40); assert!(f.pixel(Some(next)).is_err());
    }
    #[test]
    fn first_candidate_cancel_preserves_black_and_originals_are_protected() {
        let mut f = Fixture::new(); let next = f.load(80); assert_eq!(f.pixel(None).unwrap(), 0);
        let original = f.directory.join("source-80.png");
        assert!(f.session.execute(Command::Export { path: original.to_string_lossy().into(), width: 3, photo_id: None,
            transform: Transform { scale: 1.0, x: 0.0, y: 0.0, rotation: 0.0 } }).is_err());
        f.session.execute(Command::AcceptLoad { photo_id: next }).unwrap(); f.session.execute(Command::DiscardLoad { photo_id: next }).unwrap();
        assert_eq!(f.pixel(None).unwrap(), 0); assert!(f.pixel(Some(next)).is_err());
    }
}
