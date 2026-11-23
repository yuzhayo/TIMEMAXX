// LOGIC — build-time glob. Every *.rs file in src/ except lib.rs is a child.
// The generated registry is the only place children are listed; the parent
// never edits this file when a child is added, edited or removed.
use std::{env, fs, path::PathBuf};

fn main() {
    let manifest = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR"));
    let src = manifest.join("src");
    let generated = PathBuf::from(env::var("OUT_DIR").expect("OUT_DIR")).join("registry.rs");

    println!("cargo:rerun-if-changed={}", src.display());
    let mut names: Vec<String> = Vec::new();
    for entry in fs::read_dir(&src).expect("read engine/src") {
        let path = entry.expect("directory entry").path();
        if path.extension().and_then(|value| value.to_str()) != Some("rs") {
            continue;
        }
        let name = path.file_stem().and_then(|value| value.to_str()).unwrap_or("").to_string();
        if name.is_empty() || name == "lib" {
            continue;
        }
        println!("cargo:rerun-if-changed={}", path.display());
        names.push(name);
    }
    names.sort();

    let escaped = src.display().to_string().replace('\\', "\\\\").replace('"', "\\\"");
    let mut code = String::new();
    for name in &names {
        code.push_str(&format!("#[allow(non_snake_case)]\n#[path = \"{escaped}/{name}.rs\"]\npub mod {name};\n"));
    }
    code.push_str("\npub const CHILDREN: &[Child] = &[\n");
    for name in &names {
        code.push_str(&format!("    {name}::meta(),\n"));
    }
    code.push_str("];\n");
    fs::write(generated, code).expect("write child registry");
}
