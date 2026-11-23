const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

// LOGIC — the only Frame-to-Engine bridge. It does not know any section name:
// the engine returns a layer list and this file just carries the PNGs across.
let cachedHash = null;
let cachedResult = null;

function digest(codePath) {
  try { return createHash('sha256').update(fs.readFileSync(codePath)).digest('hex'); }
  catch { return 'missing'; }
}

function render({ root, runtime }) {
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

// LOGIC — polling: re-run the engine only when a watched JSON changes. Both the
// generated code and the language selection are reflected without a restart.
function pollLayers({ root, runtime }) {
  const engineRoot = path.resolve(root, '..', 'engine');
  const engineConfig = JSON.parse(fs.readFileSync(path.join(engineRoot, 'config.json'), 'utf8'));
  const watched = [engineConfig.input, engineConfig.language].filter(Boolean)
    .map((value) => path.resolve(engineRoot, value));
  const hash = createHash('sha256');
  for (const file of watched) hash.update(digest(file));
  const current = hash.digest('hex');
  if (current === cachedHash && cachedResult?.ok) return { changed: false, result: cachedResult };
  const result = render({ root, runtime });
  if (result.ok) { cachedHash = current; cachedResult = result; }
  return { changed: result.ok, result };
}

function receiveLayers(context) { return pollLayers(context).result; }

module.exports = { receiveLayers, pollLayers };
