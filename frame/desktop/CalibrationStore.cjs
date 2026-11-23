const fs = require('node:fs');
const path = require('node:path');

const freshGroup = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });
const defaults = () => ({ schemaVersion: 1, frame: { width: 1200, height: 1600 },
  groups: { sideCode: freshGroup(), sideVerified: freshGroup() } });

const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const normalizeGroup = (value) => {
  const base = freshGroup();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
  if (finite(value.x)) base.x = Math.max(-1200, Math.min(1200, value.x));
  if (finite(value.y)) base.y = Math.max(-1600, Math.min(1600, value.y));
  if (finite(value.scaleX)) base.scaleX = Math.max(0.05, Math.min(10, value.scaleX));
  if (finite(value.scaleY)) base.scaleY = Math.max(0.05, Math.min(10, value.scaleY));
  if (finite(value.rotation)) base.rotation = ((value.rotation + 180) % 360 + 360) % 360 - 180;
  return base;
};

class CalibrationStore {
  constructor(runtime) {
    this.directory = path.join(runtime, 'measurements');
    this.path = path.join(this.directory, 'side-stamp.json');
  }

  load() {
    let stored = null;
    try { stored = JSON.parse(fs.readFileSync(this.path, 'utf8')); } catch {}
    const state = defaults();
    state.groups.sideCode = normalizeGroup(stored?.groups?.sideCode);
    state.groups.sideVerified = normalizeGroup(stored?.groups?.sideVerified);
    return { ...state, path: this.path };
  }

  save(value) {
    const state = defaults();
    state.groups.sideCode = normalizeGroup(value?.groups?.sideCode);
    state.groups.sideVerified = normalizeGroup(value?.groups?.sideVerified);
    fs.mkdirSync(this.directory, { recursive: true });
    const temporary = `${this.path}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    fs.renameSync(temporary, this.path);
    return { ok: true, ...state, path: this.path };
  }
}

module.exports = { CalibrationStore, normalizeGroup };
