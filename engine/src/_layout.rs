// LOGIC — shared calculations used only by children. build.rs skips '_' files,
// so this is not a section and the parent never calls any function here.
use std::{fs, path::Path};
use ab_glyph::{Font, FontRef, PxScale, ScaleFont};
use serde_json::Value;
use crate::{number, Assets, EngineResult};

#[derive(Clone)]
pub struct CodeRow {
    pub x: f32,
    pub top: f32,
    pub width: f32,
    pub row_h: f32,
    pub divider_y: f32,
    pub shield_x: f32,
    pub shield_y: f32,
    pub shield_w: f32,
    pub shield_h: f32,
    pub text_x: f32,
    pub text_baseline: f32,
    pub text_size: f32,
    pub scale: f32,
}

fn font(assets: &Assets, bold: bool) -> &Path {
    if bold { &assets.font_bold } else { &assets.font }
}

pub fn font_metrics(path: &Path, size: f32) -> EngineResult<(f32, f32)> {
    let bytes = fs::read(path).map_err(|error| format!("font unreadable: {error}"))?;
    let face = FontRef::try_from_slice(&bytes).map_err(|error| format!("font invalid: {error}"))?;
    let scaled = face.as_scaled(PxScale::from(size));
    Ok((scaled.ascent(), scaled.descent()))
}

/// Advance width, matching ctx.measureText in draw.ts.
pub fn text_width(path: &Path, size: f32, text: &str) -> EngineResult<f32> {
    let bytes = fs::read(path).map_err(|error| format!("font unreadable: {error}"))?;
    let face = FontRef::try_from_slice(&bytes).map_err(|error| format!("font invalid: {error}"))?;
    let scaled = face.as_scaled(PxScale::from(size));
    Ok(text.chars().map(|character| {
        let glyph = face.glyph_id(character).with_scale(PxScale::from(size));
        scaled.h_advance(glyph.id)
    }).sum())
}

/// render34 + drawPhotoCode + compose.ts anchoring, calculated by children.
pub fn code_row(config: &Value, assets: &Assets) -> EngineResult<CodeRow> {
    let frame_w = number(&config["frame"], "width")?;
    let frame_h = number(&config["frame"], "height")?;
    let scale = frame_w / 360.0;
    let dp = |value: f32| value * scale;
    let text_size = dp(12.0);
    let (ascent, descent) = font_metrics(font(assets, false), text_size)?;
    let line_h = ascent - descent;
    let shield_w = dp(12.0);
    let shield_h = dp(14.0);
    let row_h = shield_h.max(line_h);
    let x = dp(8.0);
    let top = frame_h - dp(8.0) - row_h;
    Ok(CodeRow {
        x,
        top,
        width: dp(245.0),
        row_h,
        divider_y: top - dp(12.0) - 0.5 * scale,
        shield_x: x,
        shield_y: top,
        shield_w,
        shield_h,
        text_x: x + shield_w + dp(4.0),
        text_baseline: top + (row_h - line_h) / 2.0 + ascent,
        text_size,
        scale,
    })
}

/// i_photo_code (res-values/strings.xml:1888) / APK template item 640.
pub fn label_for(language: &str) -> &'static str {
    if language == "id" { "Kode Foto" } else { "Photo Code" }
}

pub fn label_width(row: &CodeRow, assets: &Assets, language: &str) -> EngineResult<f32> {
    text_width(font(assets, true), row.text_size, label_for(language))
}

pub fn colon_x(row: &CodeRow, assets: &Assets, language: &str) -> EngineResult<f32> {
    Ok(row.text_x + label_width(row, assets, language)?)
}

pub fn code_x(row: &CodeRow, assets: &Assets, language: &str) -> EngineResult<f32> {
    Ok(colon_x(row, assets, language)?
        + text_width(font(assets, false), row.text_size, ":")?
        + 2.0 * row.scale)
}
