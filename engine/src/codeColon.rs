// LOGIC — child: generates the separator after the localized label.
use crate::{_layout, Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeColon", code_key: None, z: 2, calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let row = _layout::code_row(context.config, context.assets)?;
    Ok(vec![LayerSpec {
        id: "codeColon",
        z: 2,
        paint: Paint::Text {
            text: ":".into(),
            font: context.assets.font.clone(),
            size: row.text_size,
            color: [255, 255, 255, 125],
            x: _layout::colon_x(&row, context.assets, context.language)?,
            y: row.text_baseline,
        },
    }])
}
