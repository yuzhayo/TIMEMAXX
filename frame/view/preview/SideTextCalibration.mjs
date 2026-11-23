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
    this.action = null; this.hitRegions = [];
    this.resize = new ResizeObserver(() => this.draw()); this.resize.observe(canvas.parentElement);
    this.down = (event) => this.pointerDown(event); this.move = (event) => this.pointerMove(event);
    this.up = (event) => this.pointerUp(event);
    canvas.addEventListener('pointerdown', this.down); canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up); canvas.addEventListener('pointercancel', this.up);
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

      const frameCorners = cornersOf(box), corners = frameCorners.map((point) => this.screenPoint(point, geometry));
      if (!locked) {
        context.save(); context.strokeStyle = id === this.selected ? this.config.selectedOutline : this.config.outline;
        context.lineWidth = this.config.lineWidth; context.beginPath(); context.moveTo(corners[0].x, corners[0].y);
        for (let index = 1; index < corners.length; index++) context.lineTo(corners[index].x, corners[index].y);
        context.closePath(); context.stroke(); context.restore();
        this.hitRegions.push({ id, box, frameCorners });
        if (id === this.selected) this.drawHandles(context, box, geometry);
      }
    }
  }

  drawHandles(context, box, geometry) {
    const local = [
      ['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0],
      ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0],
    ];
    this.hitRegions = this.hitRegions.filter((entry) => entry.type !== 'handle');
    for (const [name, sx, sy] of local) {
      const rotated = rotate(sx * box.width / 2, sy * box.height / 2, box.rotation);
      const frame = { x: box.cx + rotated.x, y: box.cy + rotated.y }, screen = this.screenPoint(frame, geometry);
      this.handle(context, screen); this.hitRegions.push({ type: 'handle', id: this.selected, name, screen });
    }
    const offset = this.config.rotationHandleOffset / geometry.scale;
    const rotated = rotate(0, -box.height / 2 - offset, box.rotation);
    const frame = { x: box.cx + rotated.x, y: box.cy + rotated.y }, screen = this.screenPoint(frame, geometry);
    this.handle(context, screen); this.hitRegions.push({ type: 'handle', id: this.selected, name: 'rotate', screen });
  }

  handle(context, point) {
    context.save(); context.fillStyle = this.config.handleFill; context.strokeStyle = this.config.handleStroke;
    context.lineWidth = this.config.lineWidth; context.beginPath();
    context.rect(point.x - this.config.handleSize / 2, point.y - this.config.handleSize / 2,
      this.config.handleSize, this.config.handleSize); context.fill(); context.stroke(); context.restore();
  }

  hitGroup(point, region) {
    const local = rotate(point.x - region.box.cx, point.y - region.box.cy, -region.box.rotation);
    return Math.abs(local.x) <= region.box.width / 2 && Math.abs(local.y) <= region.box.height / 2;
  }

  pointerDown(event) {
    const frame = this.framePoint(event); if (!frame) return;
    const radius = this.config.handleSize;
    const handle = [...this.hitRegions].reverse().find((entry) => entry.type === 'handle'
      && Math.hypot(event.offsetX - entry.screen.x, event.offsetY - entry.screen.y) <= radius);
    let id = handle?.id, mode = handle?.name;
    if (!id) {
      const group = [...this.hitRegions].reverse().find((entry) => !entry.type && this.hitGroup(frame, entry));
      if (!group) return; id = group.id; mode = 'move';
    }
    this.selected = id;
    const layer = this.layers.get(id), start = { ...this.state.groups[id] }, box = transformedGroupBox(layer.source, start);
    this.action = { pointerId: event.pointerId, id, mode, start, startPoint: frame, box, source: layer.source,
      startAngle: Math.atan2(frame.y - box.cy, frame.x - box.cx) };
    this.canvas.setPointerCapture(event.pointerId); event.preventDefault(); this.draw();
  }

  pointerMove(event) {
    const action = this.action; if (!action || action.pointerId !== event.pointerId) return;
    const point = this.framePoint(event); if (!point) return;
    const next = { ...action.start };
    if (action.mode === 'move') {
      next.x += point.x - action.startPoint.x; next.y += point.y - action.startPoint.y;
    } else if (action.mode === 'rotate') {
      const angle = Math.atan2(point.y - action.box.cy, point.x - action.box.cx);
      next.rotation += (angle - action.startAngle) * 180 / Math.PI;
    } else {
      const delta = rotate(point.x - action.startPoint.x, point.y - action.startPoint.y, -action.box.rotation);
      if (action.mode.includes('e')) next.scaleX = Math.max(0.05, action.start.scaleX + 2 * delta.x / action.source.width);
      if (action.mode.includes('w')) next.scaleX = Math.max(0.05, action.start.scaleX - 2 * delta.x / action.source.width);
      if (action.mode.includes('s')) next.scaleY = Math.max(0.05, action.start.scaleY + 2 * delta.y / action.source.height);
      if (action.mode.includes('n')) next.scaleY = Math.max(0.05, action.start.scaleY - 2 * delta.y / action.source.height);
    }
    this.state.groups[action.id] = next; this.draw(); event.preventDefault();
  }

  pointerUp(event) {
    if (!this.action || this.action.pointerId !== event.pointerId) return;
    this.canvas.releasePointerCapture?.(event.pointerId); this.action = null;
    Promise.resolve(this.saveState(this.state)).catch(this.onError); this.draw();
  }

  dispose() {
    this.resize.disconnect(); this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move); this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.up); this.layers.clear();
  }
}
