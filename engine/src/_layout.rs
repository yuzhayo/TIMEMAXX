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
    pub code_size: f32,
    pub scale: f32,
}

fn font(assets: &Assets, bold: bool) -> &Path {
    if bold { &assets.label } else { &assets.font }
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

/// Geometry measured directly from the operator's 1200x1600 reference export
/// (WhatsApp Image 2026-11-23 at 20.01.06.jpeg), scaled by frame width. The
/// shield is a fixed bottom-left anchor; text never moves it.
pub fn code_row(config: &Value, _assets: &Assets) -> EngineResult<CodeRow> {
    let frame_w = number(&config["frame"], "width")?;
    let frame_h = number(&config["frame"], "height")?;
    let k = frame_w / 1200.0;
    let scale = k;
    Ok(CodeRow {
        x: 31.0 * k,
        top: frame_h - 73.0 * k,
        width: 508.0 * k,
        row_h: 42.0 * k,
        divider_y: 1509.0 * k,
        shield_x: 31.0 * k,
        shield_y: frame_h - 73.0 * k,
        shield_w: 36.0 * k,
        shield_h: 42.0 * k,
        text_x: 79.0 * k,
        text_baseline: frame_h - 40.0 * k,
        text_size: 39.5 * k,
        code_size: 41.0 * k,
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
    Ok(row.text_x + label_width(row, assets, language)? - 6.0 * row.scale)
}

pub fn code_x(row: &CodeRow, assets: &Assets, language: &str) -> EngineResult<f32> {
    Ok(colon_x(row, assets, language)?
        + text_width(font(assets, false), row.text_size, ":")?
        + 6.0 * row.scale)
}
