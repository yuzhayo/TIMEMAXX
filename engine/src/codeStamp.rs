// LOGIC — child: only turns one code.json value into drawing decisions. The
// parent reads the file, handles a missing value and writes the PNG. Divider,
// colour and alpha are transcription of render.ts drawPhotoCode + theme.ts.
use crate::{Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeStamp", code_key: Some("codeGenerator"), z: 2, calculate: calculate }
}

pub fn calculate(data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let code = data.and_then(|value| value.get("code")).and_then(Value::as_str).unwrap_or("").trim();
    if code.is_empty() { return Err("empty codeGenerator.code".into()); }
    let row = &context.row;
    let scale = row.text_size / 12.0; // 12dp text; recover px-per-dp
    Ok(vec![
        // view_line: 0.5dp, white50, 6dp above the row top; root alpha 0.7.
        LayerSpec {
            id: "codeDivider",
            z: 2,
            paint: Paint::Rect {
                x: row.x,
                y: row.divider_y,
                w: row.width,
                h: 0.5 * scale,
                color: [255, 255, 255, 89], // 0.50 white50 * 0.70 row alpha
            },
        },
        // The code uses bodyCondensed with no shadow; white70 under row alpha.
        LayerSpec {
            id: "codeStamp",
            z: 2,
            paint: Paint::Text {
                text: code.to_string(),
                font: "assets/code.ttf",
                size: row.text_size,
                color: [255, 255, 255, 125], // white70 * 0.70 row alpha
                x: row.text_x,
                y: row.text_baseline,
            },
        },
    ])
}
