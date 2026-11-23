// LOGIC — child: only calculates where the shield mark goes. It never reads
// code.json, writes a file or knows that Frame exists. Geometry comes from the
// parent's transcribed code row (render.ts drawPhotoCode).
use crate::{Child, Context, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "shield", code_key: None, z: 1, calculate: calculate }
}

pub fn calculate(_data: Option<&Value>, context: &Context) -> EngineResult<Vec<LayerSpec>> {
    let row = &context.row;
    Ok(vec![LayerSpec {
        id: "shield",
        z: 1,
        paint: Paint::Image {
            asset: "assets/shield.png",
            x: row.shield_x,
            y: row.shield_y,
            w: row.shield_w,
            h: row.shield_h,
            alpha: 0.7, // photo_code_view.xml root android:alpha
        },
    }])
}
