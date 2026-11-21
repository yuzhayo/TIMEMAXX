//! LOGIC — local NDJSON transport for the standalone image worker.
mod protocol;
mod photo;
mod export;
mod session;

use protocol::{OutputSettings, Request};
use serde::Deserialize;
use serde_json::json;
use std::io::{self, BufRead, Write};

#[derive(Deserialize)]
struct Config { output: OutputSettings }

fn run() -> Result<(), String> {
    let config_path = std::env::args().nth(1).ok_or("Missing frame config path")?;
    let config: Config = serde_json::from_slice(&std::fs::read(config_path).map_err(|e| e.to_string())?).map_err(|e| e.to_string())?;
    config.output.validate()?;
    let mut session = session::Session::new(config.output);
    let mut stdout = io::BufWriter::new(io::stdout().lock());
    for line in io::stdin().lock().lines() {
        let line = line.map_err(|e| e.to_string())?;
        let response = match serde_json::from_str::<Request>(&line) {
            Ok(request) => match session.execute(request.command) {
                Ok(result) => json!({ "id": request.id, "ok": true, "result": result }),
                Err(error) => json!({ "id": request.id, "ok": false, "error": error }),
            },
            Err(error) => json!({ "id": null, "ok": false, "error": error.to_string() }),
        };
        writeln!(stdout, "{response}").map_err(|e| e.to_string())?;
        stdout.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn main() { if let Err(error) = run() { eprintln!("{error}"); std::process::exit(1); } }
