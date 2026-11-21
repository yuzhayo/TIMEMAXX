const path = require('node:path');
const { spawnSync } = require('node:child_process');

// LOGIC — keep worker artifacts/cache local to frame and use its standalone crate.
const root = path.resolve(__dirname, '..');
const task = process.argv.includes('--test') ? 'test' : 'build';
const result = spawnSync('cargo', [task, '--release', '--manifest-path', path.join(root, 'image-worker/Cargo.toml')], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, CARGO_HOME: path.join(root, '.runtime/cargo-home'), CARGO_TARGET_DIR: path.join(root, 'image-worker/target') },
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
