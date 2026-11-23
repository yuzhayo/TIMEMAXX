// LOGIC — child: calculates only the shield mark geometry.
use crate::{_layout, Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "shield", code_key: None, z: 1, calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let row = _layout::code_row(context.config, context.assets)?;
    Ok(vec![LayerSpec {
        id: "shield",
        z: 1,
        paint: Paint::Image {
            path: context.assets.shield.clone(),
            x: row.shield_x,
            y: row.shield_y,
            w: row.shield_w,
            h: row.shield_h,
            alpha: 0.7, // photo_code_view.xml root alpha
        },
    }])
}
