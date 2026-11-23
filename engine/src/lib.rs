// LOGIC — the one parent engine. It is the only part that talks to Input and
// Frame. It reads JSON, hands raw data to children, rasterises their decisions
// and writes files. It does not calculate layout, text or label choices.
#![allow(dead_code)]
use std::{
    fs,
    panic::{catch_unwind, AssertUnwindSafe},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use ab_glyph::{Font, FontRef, Point, PxScale, ScaleFont};
use image::{imageops, RgbaImage};
use serde_json::{json, Value};

// Children's shared calculation helpers. build.rs skips '_' files, so this is
// not a section and the parent never calls it.
#[allow(non_snake_case)]
pub mod _layout;

/// Resolved asset paths. The parent resolves paths (IO); children only use them.
pub struct Assets {
    pub shield: PathBuf,
    pub font: PathBuf,
    pub label: PathBuf,
}

/// One discovered child. Its file declares identity, code.json key and z.
pub struct Child {
    pub id: &'static str,
    pub code_key: Option<&'static str>,
    pub z: i32,
    pub calculate: fn(Option<&Value>, &Context) -> EngineResult<Vec<LayerSpec>>,
}

/// Raw inputs handed to a child. No geometry and no text decisions here.
pub struct Context<'a> {
    pub root: &'a Path,
    pub config: &'a Value,
    pub assets: &'a Assets,
    pub language: &'a str,
}

pub struct Outline {
    pub color: [u8; 4],
    pub width: f32,
}

/// A child's drawing decision. The parent owns all rasterising and file IO.
pub enum Paint {
    Image { path: PathBuf, x: f32, y: f32, w: f32, h: f32, alpha: f32 },
    RotatedImage { path: PathBuf, x: f32, y: f32, w: f32, h: f32, alpha: f32 },
    Rect { x: f32, y: f32, w: f32, h: f32, color: [u8; 4] },
    Text { text: String, font: PathBuf, size: f32, color: [u8; 4], x: f32, y: f32 },
    RotatedText { text: String, font: PathBuf, size: f32, tracking: f32,
        color: [u8; 4], x: f32, y: f32, w: f32, h: f32 },
    VerticalText { text: String, font: PathBuf, size: f32, color: [u8; 4],
        axis_x: f32, origin_y: f32, advance_scale: f32, outline: Option<Outline> },
}

pub struct LayerSpec {
    pub id: &'static str,
    pub z: i32,
    pub paint: Paint,
}

pub type EngineResult<T> = Result<T, String>;

include!(concat!(env!("OUT_DIR"), "/registry.rs"));

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|value| value.as_millis()).unwrap_or(0)
}

pub fn resolve(base: &Path, value: &str) -> PathBuf {
    let path = Path::new(value);
    if path.is_absolute() { path.to_path_buf() } else { base.join(path) }
}

pub fn number(config: &Value, key: &str) -> EngineResult<f32> {
    config.get(key).and_then(Value::as_f64).map(|value| value as f32)
        .ok_or_else(|| format!("expected numeric {key}"))
}

/// Non-crashing diagnostics: identical issues are counted, not repeated.
struct Log {
    path: PathBuf,
    records: Vec<Value>,
}

impl Log {
    fn new(path: PathBuf) -> Self { Self { path, records: Vec::new() } }

    fn add(&mut self, code: &str, section: &str, expected: &str, actual: &str, action: &str) {
        let stamp = now_ms();
        if let Some(record) = self.records.iter_mut().find(|record| {
            record["code"] == code && record["section"] == section && record["actual"] == actual
        }) {
            record["repeatCount"] = json!(record["repeatCount"].as_u64().unwrap_or(1) + 1);
            record["lastSeen"] = json!(stamp);
            return;
        }
        self.records.push(json!({
            "code": code, "section": section, "expected": expected, "actual": actual,
            "action": action, "timestamp": stamp, "lastSeen": stamp, "repeatCount": 1,
        }));
    }

    fn flush(&self) {
        if let Some(parent) = self.path.parent() { let _ = fs::create_dir_all(parent); }
        let _ = fs::write(&self.path, serde_json::to_string_pretty(&self.records).unwrap_or_else(|_| "[]".into()));
    }
}

fn blend(pixel: &mut image::Rgba<u8>, color: [u8; 4]) {
    // PNG stores straight (unpremultiplied) RGBA. Premultiplying RGB here
    // would apply alpha a second time when Frame composites the layer.
    *pixel = image::Rgba(color);
}

// LOGIC — pure rasterisation of a child's Paint::Text decision.
fn draw_text(image: &mut RgbaImage, spec: &Paint) -> EngineResult<()> {
    let Paint::Text { text, font, size, color, x, y } = spec else { return Ok(()) };
    let bytes = fs::read(font).map_err(|error| format!("font unreadable: {error}"))?;
    let face = FontRef::try_from_slice(&bytes).map_err(|error| format!("font invalid: {error}"))?;
    let scale = PxScale::from(*size);
    let scaled = face.as_scaled(scale);
    let mut pen = *x;
    for character in text.chars() {
        let glyph = face.glyph_id(character).with_scale(scale);
        let glyph_id = glyph.id;
        let positioned = ab_glyph::Glyph { position: Point { x: pen, y: *y }, ..glyph };
        if let Some(outline) = face.outline_glyph(positioned) {
            let origin = outline.px_bounds().min;
            outline.draw(|gx, gy, coverage| {
                let px = gx as i32 + origin.x as i32;
                let py = gy as i32 + origin.y as i32;
                if px < 0 || py < 0 || px >= image.width() as i32 || py >= image.height() as i32 { return; }
                let alpha = (coverage * color[3] as f32).round().clamp(0.0, 255.0) as u8;
                if alpha == 0 { return; }
                let pixel = image.get_pixel_mut(px as u32, py as u32);
                pixel[0] = color[0];
                pixel[1] = color[1];
                pixel[2] = color[2];
                pixel[3] = alpha.max(pixel[3]);
            });
        }
        pen += scaled.h_advance(glyph_id);
    }
    Ok(())
}

fn draw_rotated_text(image: &mut RgbaImage, spec: &Paint) -> EngineResult<()> {
    let Paint::RotatedText { text, font, size, tracking, color, x, y, w, h } = spec else { return Ok(()) };
    let bytes = fs::read(font).map_err(|error| format!("font unreadable: {error}"))?;
    let face = FontRef::try_from_slice(&bytes).map_err(|error| format!("font invalid: {error}"))?;
    let scale = PxScale::from(*size); let scaled = face.as_scaled(scale);
    let advances: Vec<f32> = text.chars().map(|character| scaled.h_advance(face.glyph_id(character))).collect();
    let tracking_px = *size * *tracking / 1000.0;
    let total = advances.iter().sum::<f32>() + tracking_px * advances.len().saturating_sub(1) as f32;
    let natural_width = total.ceil().max(1.0) as u32;
    let target_width = h.round().max(1.0) as u32;
    let target_height = w.round().max(1.0) as u32;
    let baseline = (target_height as f32 - (scaled.ascent() - scaled.descent())) / 2.0 + scaled.ascent();
    let mut pen = 0.0;
    let mut horizontal = RgbaImage::new(natural_width, target_height);
    for (index, character) in text.chars().enumerate() {
        let glyph = face.glyph_id(character).with_scale(scale);
        let positioned = ab_glyph::Glyph { position: Point { x: pen, y: baseline }, ..glyph };
        if let Some(outline) = face.outline_glyph(positioned) {
            let origin = outline.px_bounds().min;
            outline.draw(|gx, gy, coverage| {
                let px = gx as i32 + origin.x as i32;
                let py = gy as i32 + origin.y as i32;
                if px < 0 || py < 0 || px >= horizontal.width() as i32 || py >= horizontal.height() as i32 { return; }
                let pixel = horizontal.get_pixel_mut(px as u32, py as u32);
                pixel[0] = color[0]; pixel[1] = color[1]; pixel[2] = color[2];
                pixel[3] = (coverage * color[3] as f32).round().clamp(0.0, 255.0) as u8;
            });
        }
        pen += advances[index] + tracking_px;
    }
    // Photoshop's 31.31pt text metrics span the supplied 229.85px type box;
    // normalize the font engine's natural advance to that authoritative box.
    let fitted = imageops::resize(&horizontal, target_width, target_height, imageops::FilterType::Lanczos3);
    let rotated = imageops::rotate270(&fitted);
    imageops::overlay(image, &rotated, x.round() as i64, y.round() as i64);
    Ok(())
}

fn draw_vertical_glyphs(image: &mut RgbaImage, text: &str, font: &Path, size: f32,
    color: [u8; 4], axis_x: f32, origin_y: f32, advance_scale: f32) -> EngineResult<()> {
    let bytes = fs::read(font).map_err(|error| format!("font unreadable: {error}"))?;
    let face = FontRef::try_from_slice(&bytes).map_err(|error| format!("font invalid: {error}"))?;
    let scale = PxScale::from(size);
    let scaled = face.as_scaled(scale);
    let characters: Vec<char> = text.chars().collect();
    let advances: Vec<f32> = characters.iter().map(|character| {
        scaled.h_advance(face.glyph_id(*character)) * advance_scale
    }).collect();
    let mut cursor_y = origin_y - advances.first().copied().unwrap_or(0.0) / 2.0;
    for (index, character) in characters.iter().enumerate() {
        let glyph = face.glyph_id(*character).with_scale(scale);
        let glyph_id = glyph.id;
        let positioned = ab_glyph::Glyph { position: Point { x: -advances[index] / 2.0, y: 0.0 }, ..glyph };
        if let Some(outline) = face.outline_glyph(positioned) {
            let bounds = outline.px_bounds().min;
            outline.draw(|gx, gy, coverage| {
                let source_x = gx as f32 + bounds.x;
                let source_y = gy as f32 + bounds.y;
                let px = (axis_x + source_y).round() as i32;
                let py = (cursor_y - source_x).round() as i32;
                if px < 0 || py < 0 || px >= image.width() as i32 || py >= image.height() as i32 { return; }
                let alpha = (coverage * color[3] as f32).round().clamp(0.0, 255.0) as u8;
                if alpha == 0 { return; }
                let pixel = image.get_pixel_mut(px as u32, py as u32);
                pixel[0] = color[0]; pixel[1] = color[1]; pixel[2] = color[2];
                pixel[3] = alpha.max(pixel[3]);
            });
        }
        let next = advances.get(index + 1).copied().unwrap_or(0.0);
        cursor_y -= (advances[index] + next) / 2.0;
        let _ = glyph_id;
    }
    Ok(())
}

fn draw_vertical_text(image: &mut RgbaImage, spec: &Paint) -> EngineResult<()> {
    let Paint::VerticalText { text, font, size, color, axis_x, origin_y,
        advance_scale, outline } = spec else { return Ok(()) };
    if let Some(outline) = outline {
        let mut mask = RgbaImage::new(image.width(), image.height());
        draw_vertical_glyphs(&mut mask, text, font, *size, [255, 255, 255, 255],
            *axis_x, *origin_y, *advance_scale)?;
        let radius = outline.width.ceil().max(1.0) as i32;
        let mut stroke = RgbaImage::new(image.width(), image.height());
        for (x, y, pixel) in mask.enumerate_pixels() {
            if pixel[3] == 0 { continue; }
            for dy in -radius..=radius {
                for dx in -radius..=radius {
                    if dx * dx + dy * dy > radius * radius { continue; }
                    let px = x as i32 + dx;
                    let py = y as i32 + dy;
                    if px < 0 || py < 0 || px >= stroke.width() as i32 || py >= stroke.height() as i32 { continue; }
                    let target = stroke.get_pixel_mut(px as u32, py as u32);
                    target[0] = outline.color[0]; target[1] = outline.color[1]; target[2] = outline.color[2];
                    let alpha = (pixel[3] as f32 * outline.color[3] as f32 / 255.0).round() as u8;
                    target[3] = target[3].max(alpha);
                }
            }
        }
        imageops::overlay(image, &stroke, 0, 0);
    }
    draw_vertical_glyphs(image, text, font, *size, *color, *axis_x, *origin_y,
        *advance_scale)
}

fn rasterize(spec: &LayerSpec, config: &Value) -> EngineResult<RgbaImage> {
    let width = number(&config["frame"], "width")? as u32;
    let height = number(&config["frame"], "height")? as u32;
    let mut canvas = RgbaImage::new(width, height);
    match &spec.paint {
        Paint::Image { path, x, y, w, h, alpha } => {
            let source = image::open(path).map_err(|error| format!("asset unreadable: {error}"))?.to_rgba8();
            let mut scaled = imageops::resize(&source, *w as u32, *h as u32, imageops::FilterType::Lanczos3);
            if *alpha < 1.0 {
                for pixel in scaled.pixels_mut() {
                    pixel[3] = (pixel[3] as f32 * alpha).round().clamp(0.0, 255.0) as u8;
                }
            }
            imageops::overlay(&mut canvas, &scaled, *x as i64, *y as i64);
        }
        Paint::RotatedImage { path, x, y, w, h, alpha } => {
            let source = image::open(path).map_err(|error| format!("asset unreadable: {error}"))?.to_rgba8();
            let sized = imageops::resize(&source, *w as u32, *h as u32, imageops::FilterType::Lanczos3);
            let mut rotated = imageops::rotate270(&sized);
            if *alpha < 1.0 {
                for pixel in rotated.pixels_mut() {
                    pixel[3] = (pixel[3] as f32 * alpha).round().clamp(0.0, 255.0) as u8;
                }
            }
            imageops::overlay(&mut canvas, &rotated, *x as i64, *y as i64);
        }
        Paint::Rect { x, y, w, h, color } => {
            for py in y.max(0.0) as u32..(y + h).min(height as f32) as u32 {
                for px in x.max(0.0) as u32..(x + w).min(width as f32) as u32 {
                    blend(canvas.get_pixel_mut(px, py), *color);
                }
            }
        }
        Paint::Text { .. } => draw_text(&mut canvas, &spec.paint)?,
        Paint::RotatedText { .. } => draw_rotated_text(&mut canvas, &spec.paint)?,
        Paint::VerticalText { .. } => draw_vertical_text(&mut canvas, &spec.paint)?,
    }
    Ok(canvas)
}

/// LOGIC — language is a raw Input selection. The parent only reads it; the
/// label wording is decided entirely inside the codeLabel child.
fn read_language(config: &Value, manifest: &Path, log: &mut Log) -> String {
    let path = resolve(manifest, config["language"].as_str().unwrap_or("../ui-control/state.json"));
    let value = fs::read_to_string(&path).ok()
        .and_then(|text| serde_json::from_str::<Value>(&text).ok())
        .and_then(|state| state.get("sections")?.get("language")?.get("language")?.as_str().map(str::to_string));
    match value.as_deref() {
        Some("id") => "id".into(),
        Some("en") => "en".into(),
        Some(other) => {
            log.add("INPUT_LANGUAGE_INVALID", "language", "'en' or 'id'", other, "using English");
            "en".into()
        }
        None => {
            log.add("INPUT_LANGUAGE_UNREADABLE", "language", "a readable language selection", "absent", "using English");
            "en".into()
        }
    }
}

fn run() -> EngineResult<Value> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let config_path = std::env::var_os("TIMEMAXX_ENGINE_CONFIG")
        .map(PathBuf::from)
        .unwrap_or_else(|| manifest.join("config.json"));
    let config: Value = serde_json::from_str(&fs::read_to_string(&config_path)
        .map_err(|error| format!("config unreadable: {error}"))?)
        .map_err(|error| format!("config invalid: {error}"))?;
    let manifest_dir = config_path.parent().unwrap_or(&manifest).to_path_buf();
    let mut log = Log::new(resolve(&manifest_dir, config["log"].as_str().unwrap_or("log.json")));

    let input_path = resolve(&manifest_dir, config["input"].as_str().unwrap_or("../ui-control/code.json"));
    let sections = match fs::read_to_string(&input_path) {
        Ok(text) => match serde_json::from_str::<Value>(&text) {
            Ok(value) if value.is_object() => value.get("sections").cloned().unwrap_or_else(|| json!({})),
            Ok(_) => { log.add("INPUT_INVALID", "-", "an object", "non-object JSON", "sections hidden"); json!({}) }
            Err(error) => { log.add("INPUT_INVALID", "-", "readable JSON", &error.to_string(), "sections hidden"); json!({}) }
        },
        Err(error) => {
            let actual = if error.kind() == std::io::ErrorKind::NotFound { "code.json missing".into() } else { error.to_string() };
            log.add("INPUT_UNREADABLE", "-", "readable code.json", &actual, "sections hidden");
            json!({})
        }
    };

    let assets = Assets {
        shield: resolve(&manifest_dir, config["assets"]["shield"].as_str().unwrap_or("assets/shield.png")),
        font: resolve(&manifest_dir, config["assets"]["font"].as_str().unwrap_or("assets/code.ttf")),
        label: resolve(&manifest_dir, config["assets"]["labelFont"].as_str().unwrap_or("assets/label.ttf")),
    };
    let language = read_language(&config, &manifest_dir, &mut log);
    let context = Context { root: &manifest_dir, config: &config, assets: &assets, language: &language };

    let output = resolve(&manifest_dir, config["outputDir"].as_str().unwrap_or("../frame/.runtime/engine-layers"));
    if fs::create_dir_all(&output).is_err() {
        log.add("OUTPUT_UNWRITABLE", "-", "a writable output directory", &output.display().to_string(), "layers hidden");
    }
    let frame_width = number(&config["frame"], "width").unwrap_or(1200.0) as u32;
    let frame_height = number(&config["frame"], "height").unwrap_or(1600.0) as u32;

    let mut specs: Vec<LayerSpec> = Vec::new();
    for child in CHILDREN {
        let data = match child.code_key {
            None => None,
            Some(key) => match sections.get(key) {
                Some(value) => Some(value),
                None => {
                    log.add("INPUT_SECTION_MISSING", child.id, &format!("sections.{key}"), "absent", "section hidden");
                    continue;
                }
            },
        };
        let outcome = catch_unwind(AssertUnwindSafe(|| (child.calculate)(data, &context)));
        match outcome {
            Ok(Ok(mut items)) => specs.append(&mut items),
            Ok(Err(error)) => log.add("CHILD_CALCULATION_FAILED", child.id, "a layer calculation", &error, "section hidden"),
            Err(_) => log.add("CHILD_PANICKED", child.id, "a panic-free calculation", "panic", "section hidden"),
        }
    }
    specs.sort_by_key(|spec| spec.z);

    let mut layers = Vec::new();
    for spec in &specs {
        match rasterize(spec, &config) {
            Ok(image) => {
                let file = format!("{}.png", spec.id);
                if let Err(error) = image.save(output.join(&file)) {
                    log.add("LAYER_WRITE_FAILED", spec.id, "a written PNG", &error.to_string(), "section hidden");
                    continue;
                }
                layers.push(json!({ "id": spec.id, "z": spec.z, "file": file,
                    "width": frame_width, "height": frame_height }));
            }
            Err(error) => log.add("LAYER_RASTER_FAILED", spec.id, "a rasterized layer", &error, "section hidden"),
        }
    }
    let manifest = json!({ "schemaVersion": 1,
        "frame": { "width": frame_width, "height": frame_height }, "layers": layers });
    if let Err(error) = fs::write(output.join("layers.json"), serde_json::to_string_pretty(&manifest).unwrap_or_default()) {
        log.add("MANIFEST_WRITE_FAILED", "-", "a written layers.json", &error.to_string(), "Frame keeps its layers");
    }
    log.flush();
    Ok(manifest)
}

fn main() {
    match run() {
        Ok(manifest) => println!("{manifest}"),
        Err(error) => println!("{}", json!({ "schemaVersion": 1, "layers": [], "error": error })),
    }
}
