// LOGIC — one child owns the complete right-edge stamp. Its three sections
// share one coordinate calculation so changing code length never moves the
// shield and always moves Verified by the measured code advance.
use std::path::PathBuf;

use serde_json::Value;

use crate::{_layout, number, resolve, Child, Context, EngineResult, LayerSpec, Paint, SoftShadow};

const Z_SHIELD: i32 = 10;
const Z_CODE: i32 = 11;
const Z_VERIFIED: i32 = 12;

pub const fn meta() -> Child {
    Child { id: "sideStamp", code_key: Some("codeGenerator"), z: Z_SHIELD, calculate }
}

fn asset(context: &Context, key: &str) -> EngineResult<PathBuf> {
    let value = context.config.get("assets").and_then(|assets| assets.get(key))
        .and_then(Value::as_str).ok_or_else(|| format!("missing assets.{key}"))?;
    Ok(resolve(context.root, value))
}

pub fn calculate(data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let code = data.and_then(|value| value.get("code")).and_then(Value::as_str).unwrap_or("").trim();
    if code.is_empty() { return Err("empty codeGenerator.code".into()); }

    let frame_w = number(&context.config["frame"], "width")?;
    let scale = frame_w / 360.0;
    let dp = |value: f32| value * scale;

    // widget_anti_code.xml: 9dp text, 8x9dp icon rotated -90. One child-level
    // gap owns both relationships; the shield's frame anchor is independent of
    // text metrics and therefore invariant across every code length.
    let text_size = dp(9.0);
    let gap = dp(2.8);
    // BottomToTopTextView's measured character chain occupies 1.2x the plain
    // ab_glyph advances at this export scale; this reproduces the shipped
    // per-character layout without scaling the glyphs themselves.
    let advance_scale = 1.2;
    let axis_x = frame_w - dp(2.5); // measured right-edge baseline of the original export
    // The APK drawable is 24x27px (nominal 8x9dp), while the burnt-in export
    // presents it at 80% of that nominal box. Keep the original asset and apply
    // the observed export scale here instead of resizing the bitmap itself.
    let shield_source_w = dp(6.4);
    let shield_source_h = dp(7.2);
    let shield_final_h = shield_source_w;
    let shield_bottom = dp(288.7);
    let shield_x = axis_x - dp(6.25);
    let shield_y = shield_bottom - shield_final_h;

    let code_font = asset(context, "sideCodeFont")?;
    let verified_font = asset(context, "sideVerifiedFont")?;
    let code_advance = _layout::text_width(&code_font, text_size, code)? * advance_scale;
    let code_origin_y = shield_y - gap;
    let reference_advance = _layout::text_width(&code_font, text_size, "NNADN3TM9DTTRH")? * advance_scale;
    // Last operator-approved manual calibration, baked before disabling the
    // helper so relaunches cannot return the text to identity.
    let verified_x = (1165.73 - 1.3252054) * frame_w / 1200.0;
    let verified_y = (419.9 - 6.6016433) * frame_w / 1200.0 + reference_advance - code_advance;
    let verified_w = 35.27 * frame_w / 1200.0;
    let verified_h = 229.85 * frame_w / 1200.0;
    let shadow = || Some(SoftShadow { color: [0, 0, 0, 102], offset_x: 0.0,
        offset_y: dp(1.5), blur: dp(3.5) });
    // Operator-approved sideCode calibration (1200x1600 frame): only a
    // horizontal translation was needed; scale, Y and rotation remain identity.
    let code_axis_x = axis_x - 1.3252054;
    Ok(vec![
        // UI — section 1: fixed anchor. This geometry never reads text width.
        LayerSpec {
            id: "sideShield",
            z: Z_SHIELD,
            paint: Paint::RotatedImage {
                path: asset(context, "sideShield")?,
                x: shield_x,
                y: shield_y,
                w: shield_source_w,
                h: shield_source_h,
                alpha: 1.0,
            },
        },
        // UI — section 2: bottom-to-top code in PT Mono Regular.
        LayerSpec {
            id: "sideCode",
            z: Z_CODE,
            paint: Paint::VerticalText {
                text: code.into(), font: code_font, size: text_size,
                color: [255, 255, 255, 255], axis_x: code_axis_x, origin_y: code_origin_y,
                advance_scale, outline: None, shadow: shadow(),
            },
        },
        // UI — section 3: follows the measured code advance at the same gap.
        LayerSpec {
            id: "sideVerified",
            z: Z_VERIFIED,
            paint: Paint::RotatedText {
                text: "Timemark Verified".into(), font: verified_font,
                size: 31.31 * frame_w / 1200.0, tracking: 10.0,
                color: [255, 255, 255, 255], x: verified_x, y: verified_y,
                w: verified_w, h: verified_h, shadow: shadow(),
            },
        },
    ])
}

#[cfg(test)]
mod tests {
    use std::path::{Path, PathBuf};

    use serde_json::json;

    use super::*;
    use crate::Assets;

    fn context<'a>(config: &'a Value, assets: &'a Assets, root: &'a Path) -> Context<'a> {
        Context { root, config, assets, language: "id" }
    }

    fn image_position(specs: &[LayerSpec]) -> (f32, f32) {
        specs.iter().find_map(|spec| match &spec.paint {
            Paint::RotatedImage { x, y, .. } if spec.id == "sideShield" => Some((*x, *y)),
            _ => None,
        }).expect("sideShield")
    }

    fn text_origin(specs: &[LayerSpec], id: &str) -> f32 {
        specs.iter().find_map(|spec| match &spec.paint {
            Paint::VerticalText { origin_y, .. } if spec.id == id => Some(*origin_y),
            Paint::RotatedText { y, .. } if spec.id == id => Some(*y),
            _ => None,
        }).expect(id)
    }

    fn text_advance(specs: &[LayerSpec], id: &str) -> f32 {
        specs.iter().find_map(|spec| match &spec.paint {
            Paint::VerticalText { text, font, size, advance_scale, .. } if spec.id == id =>
                Some(_layout::text_width(font, *size, text).unwrap() * *advance_scale),
            _ => None,
        }).expect(id)
    }

    #[test]
    fn shield_is_invariant_and_verified_follows_code_advance() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let config = json!({
            "frame": { "width": 1200, "height": 1600 },
            "assets": {
                "sideShield": "assets/sideShield.png",
                "sideCodeFont": "assets/sideCode.ttf",
                "sideVerifiedFont": "assets/sideVerified.ttf"
            }
        });
        let assets = Assets { shield: root.join("assets/shield.png"),
            font: root.join("assets/code.ttf"), label: root.join("assets/label.ttf") };
        let ctx = context(&config, &assets, &root);
        let short = calculate(Some(&json!({ "code": "ABC123" })), &ctx).unwrap();
        let long = calculate(Some(&json!({ "code": "NNADN3TM9DTTRH" })), &ctx).unwrap();

        assert_eq!(image_position(&short), image_position(&long));
        assert_eq!(text_origin(&short, "sideCode"), text_origin(&long, "sideCode"));
        assert!(text_origin(&long, "sideVerified") < text_origin(&short, "sideVerified"));
        let verified_origin = text_origin(&long, "sideVerified");
        let movement = text_origin(&short, "sideVerified") - verified_origin;
        let advance_difference = text_advance(&long, "sideCode") - text_advance(&short, "sideCode");
        assert!((movement - advance_difference).abs() < 0.01);
        let z: Vec<_> = long.iter().map(|spec| spec.z).collect();
        assert_eq!(z, vec![Z_SHIELD, Z_CODE, Z_VERIFIED]);
    }
}
