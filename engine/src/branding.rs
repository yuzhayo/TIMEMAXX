// LOGIC — one locale-owned child renders the Indonesian top-right branding.
// Photoshop supplies geometry/color/opacity; timemark-web supplies the shared
// Roboto Condensed face and soft-shadow mechanism.
use serde_json::Value;

use crate::{Child, Context, EngineResult, LayerSpec, Paint, SoftShadow, TextInk, TextRun};

const Z_TITLE: i32 = 20;
const Z_SUBTITLE: i32 = 21;

pub const fn meta() -> Child {
    Child { id: "branding", code_key: None, z: Z_TITLE, calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    if context.language != "id" { return Ok(Vec::new()); }
    let frame_w = context.config["frame"]["width"].as_f64().ok_or("missing frame.width")? as f32;
    let k = frame_w / 1200.0;
    let dp = |value: f32| value * frame_w / 360.0;
    let shadow = || Some(SoftShadow { color: [0, 0, 0, 102], offset_x: 0.0,
        offset_y: dp(1.5), blur: dp(3.5) });

    Ok(vec![
        LayerSpec {
            id: "brandTitle",
            z: Z_TITLE,
            paint: Paint::FittedText {
                runs: vec![
                    TextRun { text: "Time".into(), color: [0xF1, 0xB7, 0x33, 255] },
                    TextRun { text: "mark".into(), color: [255, 255, 255, 255] },
                ],
                font: context.assets.label.clone(), size: 41.47 * k, tracking: 10.0,
                x: 985.92 * k, y: 22.42 * k, w: 195.79 * k, h: 46.71 * k,
                // Visible ink measured in the operator's 1200x1600 Photoshop
                // export. The logical type box above is NOT the glyph box.
                ink: TextInk { x: 987.0 * k, y: 26.0 * k, w: 194.0 * k, h: 32.0 * k },
                shadow: shadow(),
            },
        },
        LayerSpec {
            id: "brandSubtitle",
            z: Z_SUBTITLE,
            paint: Paint::FittedText {
                runs: vec![TextRun { text: "Foto 100% akurat".into(), color: [255, 255, 255, 128] }],
                font: context.assets.label.clone(), size: 27.22 * k, tracking: 10.0,
                x: 986.63 * k, y: 76.94 * k, w: 195.08 * k, h: 30.66 * k,
                ink: TextInk { x: 988.0 * k, y: 80.0 * k, w: 193.0 * k, h: 20.0 * k },
                shadow: shadow(),
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

    fn context<'a>(language: &'a str, config: &'a Value, assets: &'a Assets, root: &'a Path) -> Context<'a> {
        Context { root, config, assets, language }
    }

    #[test]
    fn branding_is_indonesian_only_and_keeps_measured_sections() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let config = json!({ "frame": { "width": 1200, "height": 1600 } });
        let assets = Assets { shield: root.join("assets/shield.png"),
            font: root.join("assets/code.ttf"), label: root.join("assets/label.ttf") };
        assert!(calculate(None, &context("en", &config, &assets, &root)).unwrap().is_empty());
        let layers = calculate(None, &context("id", &config, &assets, &root)).unwrap();
        assert_eq!(layers.iter().map(|layer| layer.id).collect::<Vec<_>>(), vec!["brandTitle", "brandSubtitle"]);
        assert_eq!(layers.iter().map(|layer| layer.z).collect::<Vec<_>>(), vec![Z_TITLE, Z_SUBTITLE]);
        let expected = [
            (41.47, 985.92, 22.42, 195.79, 46.71,
                vec![("Time", [241, 183, 51, 255]), ("mark", [255, 255, 255, 255])]),
            (27.22, 986.63, 76.94, 195.08, 30.66,
                vec![("Foto 100% akurat", [255, 255, 255, 128])]),
        ];
        for (layer, (size, x, y, w, h, colors)) in layers.iter().zip(expected) {
            let Paint::FittedText { runs, font, size: actual_size, tracking,
                x: actual_x, y: actual_y, w: actual_w, h: actual_h, .. } = &layer.paint
                else { panic!("branding must use the typeset renderer") };
            assert_eq!((*actual_size, *actual_x, *actual_y, *actual_w, *actual_h), (size, x, y, w, h));
            assert_eq!(*tracking, 10.0);
            assert_eq!(*font, assets.label);
            assert_eq!(runs.iter().map(|run| (run.text.as_str(), run.color)).collect::<Vec<_>>(), colors);
        }
    }

    #[test]
    fn rasterized_branding_keeps_photoshop_export_ink_height_and_position() {
        let root = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let config = json!({ "frame": { "width": 1200, "height": 1600 } });
        let assets = Assets { shield: root.join("assets/shield.png"),
            font: root.join("assets/code.ttf"), label: root.join("assets/label.ttf") };
        let layers = calculate(None, &context("id", &config, &assets, &root)).unwrap();
        // Measured from the operator's 72-DPI Photoshop export TIMEMARK.png,
        // not the logical type-layer box and not a screenshot of our app.
        let expected = [[987, 26, 1180, 57], [989, 80, 1179, 99]];
        for (layer, expected) in layers.iter().zip(expected) {
            let image = crate::rasterize(layer, &config).unwrap();
            let threshold = if layer.id == "brandTitle" { 180 } else { 100 };
            let mut bounds = [u32::MAX, u32::MAX, 0, 0];
            for (x, y, pixel) in image.enumerate_pixels() {
                if pixel[3] <= threshold || pixel[0] < 200 { continue; }
                bounds[0] = bounds[0].min(x); bounds[1] = bounds[1].min(y);
                bounds[2] = bounds[2].max(x); bounds[3] = bounds[3].max(y);
            }
            for (actual, wanted) in bounds.into_iter().zip(expected) {
                assert!(actual.abs_diff(wanted) <= 1,
                    "{}: expected export ink {:?}, got {:?}", layer.id, expected, bounds);
            }
            if layer.id == "brandTitle" {
                assert!(image.pixels().any(|pixel| pixel.0 == [241, 183, 51, 255]));
                assert!(image.pixels().any(|pixel| pixel.0 == [255, 255, 255, 255]));
            } else {
                // Shadow may add alpha underneath; the actual text paint stays
                // white with 128/255 opacity, never an opaque replacement.
                assert!(image.pixels().any(|pixel| pixel[0] > 240 && pixel[3] >= 128 && pixel[3] < 160));
            }
        }
    }
}
