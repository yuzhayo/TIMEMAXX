// LOGIC — child: calculates the 0.5dp white50 line above the code row.
use crate::{_layout, Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "codeDivider", code_key: None, z: 2, calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let row = _layout::code_row(context.config, context.assets)?;
    Ok(vec![LayerSpec {
        id: "codeDivider",
        z: 2,
        paint: Paint::Rect {
            x: row.x,
            y: row.divider_y,
            w: row.width,
            h: (0.5 * row.scale).max(1.0),
            color: [255, 255, 255, 89], // white50 under 0.7 row alpha
        },
    }])
}
