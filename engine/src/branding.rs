// LOGIC — one locale-owned child renders the Indonesian top-right branding.
// Photoshop supplies geometry/color/opacity; timemark-web supplies the shared
// Roboto Condensed face and soft-shadow mechanism.
use serde_json::Value;

use crate::{Child, Context, EngineResult, LayerSpec, Paint, SoftShadow, TextRun};

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
    }
}
