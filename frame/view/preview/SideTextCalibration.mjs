const GROUP_IDS = ['sideCode', 'sideVerified'];

const freshGroup = () => ({ x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 });

export function normalizeCalibrationState(value) {
  const state = { schemaVersion: 1, frame: { width: 1200, height: 1600 },
    groups: { sideCode: freshGroup(), sideVerified: freshGroup() } };
  for (const id of GROUP_IDS) {
    const input = value?.groups?.[id];
    if (!input || typeof input !== 'object') continue;
    for (const key of ['x', 'y', 'scaleX', 'scaleY', 'rotation']) {
      if (Number.isFinite(input[key])) state.groups[id][key] = input[key];
    }
  }
  return state;
}

export function transformedGroupBox(source, transform) {
  return { cx: source.x + source.width / 2 + transform.x,
    cy: source.y + source.height / 2 + transform.y,
    width: source.width * transform.scaleX, height: source.height * transform.scaleY,
    rotation: transform.rotation };
}

const rotate = (x, y, degrees) => {
  const angle = degrees * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
};

const cornersOf = (box) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
  const point = rotate(sx * box.width / 2, sy * box.height / 2, box.rotation);
  return { x: box.cx + point.x, y: box.cy + point.y };
});

const alphaBounds = (image) => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = canvas.width, minY = canvas.height, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (pixels[(y * canvas.width + x) * 4 + 3] === 0) continue;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  }
  return maxX < 0 ? null : { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
};

const loadImage = (source) => new Promise((resolve, reject) => {
  const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Calibration layer failed to load'));
  image.src = source;
});

export class SideTextCalibration {
  constructor({ canvas, painter, config, load, save, onError }) {
    this.canvas = canvas; this.painter = painter; this.config = config;
    this.loadState = load; this.saveState = save; this.onError = onError;
    this.state = normalizeCalibrationState(null); this.layers = new Map();
    this.locked = new Set(config.lockedGroups ?? []);
    this.selected = GROUP_IDS.find((id) => !this.locked.has(id)) ?? null;
    this.action = null; this.hitRegions = []; this.saveTimer = null;
    this.resize = new ResizeObserver(() => this.draw()); this.resize.observe(canvas.parentElement);
    this.down = (event) => this.pointerDown(event); this.move = (event) => this.pointerMove(event);
    this.up = (event) => this.pointerUp(event); this.key = (event) => this.keyDown(event);
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('keydown', this.key);
    Promise.resolve(load()).then((value) => { this.state = normalizeCalibrationState(value); this.draw(); }).catch(onError);
  }

  async setLayers(layers) {
    const generation = Symbol('layers'); this.generation = generation;
    try {
      const entries = await Promise.all(GROUP_IDS.map(async (id) => {
        const layer = layers.find((candidate) => candidate.id === id);
        if (!layer) return [id, null];
        const image = await loadImage(layer.dataUrl);
        return [id, { image, source: alphaBounds(image) }];
      }));
      if (this.generation !== generation) return;
      this.layers = new Map(entries.filter(([, value]) => value?.source)); this.draw();
    } catch (error) { this.onError(error); }
  }

  geometry() { return this.painter.geometry(); }
  framePoint(event) {
    const geometry = this.geometry(); if (!geometry) return null;
    return { x: (event.clientX - geometry.rect.left - geometry.left) / geometry.scale,
      y: (event.clientY - geometry.rect.top - geometry.top) / geometry.scale };
  }
  screenPoint(point, geometry) { return { x: geometry.left + point.x * geometry.scale,
    y: geometry.top + point.y * geometry.scale }; }

  draw() {
    const geometry = this.geometry(); if (!geometry) return;
    const dpr = window.devicePixelRatio, width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth; this.canvas.height = pixelHeight;
    }
    const context = this.canvas.getContext('2d'); context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height); this.hitRegions = [];
    for (const id of GROUP_IDS) {
      const layer = this.layers.get(id); if (!layer) continue;
      const locked = this.locked.has(id);
      const transform = locked ? freshGroup() : this.state.groups[id];
      const box = transformedGroupBox(layer.source, transform);
      const center = this.screenPoint({ x: box.cx, y: box.cy }, geometry);
      context.save(); context.translate(center.x, center.y); context.rotate(box.rotation * Math.PI / 180);
      context.globalAlpha = this.config.opacity;
      context.drawImage(layer.image, layer.source.x, layer.source.y, layer.source.width, layer.source.height,
        -box.width * geometry.scale / 2, -box.height * geometry.scale / 2,
        box.width * geometry.scale, box.height * geometry.scale);
      context.restore();

      const frameCorners = cornersOf(box);
      if (!locked) {
        this.hitRegions.push({ id, box, frameCorners });
      }
    }
  }

  hitGroup(point, region) {
    const local = rotate(point.x - region.box.cx, point.y - region.box.cy, -region.box.rotation);
    return Math.abs(local.x) <= region.box.width / 2 && Math.abs(local.y) <= region.box.height / 2;
  }

  pointerDown(event) {
    const frame = this.framePoint(event); if (!frame) return;
    const group = [...this.hitRegions].reverse().find((entry) => this.hitGroup(frame, entry));
    if (!group) return;
    this.selected = group.id; this.canvas.focus({ preventScroll: true });
    const id = group.id;
    const layer = this.layers.get(id), start = { ...this.state.groups[id] }, box = transformedGroupBox(layer.source, start);
    this.action = { pointerId: event.pointerId, id, start, startPoint: frame, box, source: layer.source };
    this.canvas.setPointerCapture(event.pointerId); event.preventDefault(); this.draw();
  }

  pointerMove(event) {
    const action = this.action;
    if (!action) return;
    if (action.pointerId !== event.pointerId) return;
    const point = this.framePoint(event); if (!point) return;
    const next = { ...action.start };
    next.x += point.x - action.startPoint.x; next.y += point.y - action.startPoint.y;
    this.state.groups[action.id] = next; this.draw(); event.preventDefault();
  }

  pointerUp(event) {
    if (!this.action || this.action.pointerId !== event.pointerId) return;
    this.canvas.releasePointerCapture?.(event.pointerId); this.action = null;
    Promise.resolve(this.saveState(this.state)).catch(this.onError); this.draw();
  }

  keyDown(event) {
    if (!this.selected || this.locked.has(this.selected)) return;
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key]; if (!direction) return;
    const step = event.shiftKey ? this.config.keyboardStepFast : this.config.keyboardStep;
    const group = this.state.groups[this.selected]; group.x += direction[0] * step; group.y += direction[1] * step;
    clearTimeout(this.saveTimer); this.saveTimer = setTimeout(() => {
      Promise.resolve(this.saveState(this.state)).catch(this.onError);
    }, 80);
    this.draw(); event.preventDefault();
  }

  dispose() {
    clearTimeout(this.saveTimer); this.resize.disconnect(); this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move); this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.up); this.canvas.removeEventListener('keydown', this.key);
    this.layers.clear();
  }
}
