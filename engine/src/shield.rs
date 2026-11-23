// LOGIC — child: only calculates where the shield mark goes. It never reads
// code.json, writes a file or knows that Frame exists.
use crate::{number, Child, EngineResult, LayerSpec, Paint};
use serde_json::Value;

pub const fn meta() -> Child {
    Child { id: "shield", code_key: None, z: 1, calculate: calculate }
}

pub fn calculate(_data: Option<&Value>, config: &Value) -> EngineResult<LayerSpec> {
    let part = config.get("shield").ok_or_else(|| "missing config section shield".to_string())?;
    Ok(LayerSpec {
        id: "shield",
        z: 1,
        paint: Paint::Image {
            asset: "assets/shield.png",
            x: number(part, "x")?,
            y: number(part, "y")?,
            w: number(part, "width")?,
            h: number(part, "height")?,
        },
    })
}
