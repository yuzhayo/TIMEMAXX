const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

// LOGIC — the only Frame-to-Engine bridge. It does not know any section name:
// the engine returns a layer list and this file just carries the PNGs across.
function receiveLayers({ root, runtime }) {
  const engineRoot = path.resolve(root, '..', 'engine');
  const binary = path.join(engineRoot, 'target/release/engine-render.exe');
  const output = path.join(runtime, 'engine-layers');
  if (!fs.existsSync(binary)) return { ok: false, error: 'engine-render.exe is not built' };

  const stdout = execFileSync(binary, [], {
    cwd: engineRoot,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const manifest = JSON.parse(stdout);
  const layers = (manifest.layers ?? []).flatMap((layer) => {
    const file = path.join(output, layer.file);
    if (!fs.existsSync(file)) return [];
    const data = fs.readFileSync(file).toString('base64');
    return [{ id: layer.id, z: layer.z, width: layer.width, height: layer.height,
      dataUrl: `data:image/png;base64,${data}` }];
  });
  return { ok: true, frame: manifest.frame, layers };
}

module.exports = { receiveLayers };
