// LOGIC — child: only turns one code.json value into a text drawing decision.
// The parent reads the file, handles a missing value and writes the PNG.
use crate::{number, Child, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeStamp", code_key: Some("codeGenerator"), z: 2, calculate: calculate }
}

pub fn calculate(data: Option<&Value>, config: &Value) -> EngineResult<LayerSpec> {
    let code = data.and_then(|value| value.get("code")).and_then(Value::as_str).unwrap_or("").trim();
    if code.is_empty() { return Err("empty codeGenerator.code".into()); }
    let part = config.get("codeStamp").ok_or_else(|| "missing config section codeStamp".to_string())?;
    let color = part.get("color").and_then(Value::as_array).cloned().unwrap_or_default();
    let rgba = [
        color.first().and_then(Value::as_u64).unwrap_or(255) as u8,
        color.get(1).and_then(Value::as_u64).unwrap_or(255) as u8,
        color.get(2).and_then(Value::as_u64).unwrap_or(255) as u8,
        color.get(3).and_then(Value::as_u64).unwrap_or(255) as u8,
    ];
    Ok(LayerSpec {
        id: "codeStamp",
        z: 2,
        paint: Paint::Text {
            text: code.to_string(),
            font: "assets/code.ttf",
            size: number(part, "size")?,
            color: rgba,
            x: number(part, "x")?,
            y: number(part, "y")?,
        },
    })
}
