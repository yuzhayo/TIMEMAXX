// LOGIC — inspection state and cancellation are independent of the photo document/history.
export function viewSettingsProblem(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { property: '', expected: 'view settings object', actual: settings };
  const keys = ['zoom', 'x', 'y', 'minZoom', 'maxZoom'];
  for (const key of Object.keys(settings)) if (!keys.includes(key)) return { property: key, expected: 'supported view setting', actual: settings[key] };
  for (const key of keys) if (!Number.isFinite(settings[key])) return { property: key, expected: 'finite number', actual: settings[key] };
  if (settings.minZoom <= 0 || settings.maxZoom < settings.minZoom || settings.zoom < settings.minZoom || settings.zoom > settings.maxZoom) {
    return { property: 'zoom', expected: 'positive zoom within configured minimum/maximum', actual: settings.zoom };
  }
  return null;
}

export class ViewState {
  constructor(settings) {
    this.settings = settings;
    this.current = { zoom: settings.zoom, x: settings.x, y: settings.y };
    this.sequence = 0;
    this.token = null;
    this.before = null;
  }
  snapshot() { return { ...this.current }; }
  beginEdit() {
    this.finishEdit(this.token);
    this.before = this.snapshot();
    this.token = ++this.sequence;
    return { token: this.token, view: this.snapshot() };
  }
  isEditActive(gesture) { return Boolean(gesture) && gesture.token === this.token && this.token !== null; }
  updateEdit(next, gesture) {
    if (!this.isEditActive(gesture) || ![next.zoom, next.x, next.y].every(Number.isFinite) || next.zoom <= 0) return false;
    const changed = JSON.stringify(this.current) !== JSON.stringify(next);
    this.current = { ...next };
    return changed;
  }
  finishEdit(token) {
    if (token !== this.token) return;
    this.token = null; this.before = null;
  }
  cancelEdit(gesture) {
    if (!this.isEditActive(gesture)) return false;
    const changed = JSON.stringify(this.current) !== JSON.stringify(this.before);
    this.current = this.before;
    this.finishEdit(gesture.token);
    return changed;
  }
}
