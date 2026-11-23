// LOGIC — child: the only place that reads the generated code value. It does
// not choose the label: codeLabel and codeColon own their own text.
use crate::{_layout, Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeStamp", code_key: Some("codeGenerator"), z: 2, calculate }
}

pub fn calculate(data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let code = data.and_then(|value| value.get("code")).and_then(Value::as_str).unwrap_or("").trim();
    if code.is_empty() { return Err("empty codeGenerator.code".into()); }
    let row = _layout::code_row(context.config, context.assets)?;
    Ok(vec![LayerSpec {
        id: "codeStamp",
        z: 2,
        paint: Paint::Text {
            text: code.into(),
            font: context.assets.font.clone(),
            size: row.text_size,
            color: [255, 255, 255, 125],
            x: _layout::code_x(&row, context.assets, context.language)?,
            y: row.text_baseline,
        },
    }])
}
