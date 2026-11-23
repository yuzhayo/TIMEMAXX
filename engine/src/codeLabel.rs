// LOGIC — child: generates the localized label text. Input never supplies it.
// i_photo_code (strings.xml:1888) / APK template item 640.
use crate::{_layout, Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeLabel", code_key: None, z: 2, calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let row = _layout::code_row(context.config, context.assets)?;
    Ok(vec![LayerSpec {
        id: "codeLabel",
        z: 2,
        paint: Paint::Text {
            text: _layout::label_for(context.language).into(),
            font: context.assets.font_bold.clone(),
            size: row.text_size,
            color: [255, 255, 255, 125], // white70 under 0.7 row alpha
            x: row.text_x,
            y: row.text_baseline,
        },
    }])
}
