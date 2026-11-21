// UI — stable preview-feature owner, independent of any section's assigned folder.
import { preparedPreviewOf } from '@frame/logic/PhotoState.mjs';
export class PreviewPainter {
  constructor(canvas, output, presentation, onError) {
    this.canvas = canvas;
    this.output = output;
    this.presentation = presentation;
    this.onError = onError;
    this.image = null;
    this.photo = null;
    this.document = null;
    this.source = null;
    this.observer = new ResizeObserver(() => this.draw());
    this.observer.observe(canvas.parentElement);
  }

  update(photo, document, view) {
    this.photo = photo;
    this.document = document;
    this.view = view;
    if ((photo?.previewUrl ?? null) !== this.source) {
      this.source = photo?.previewUrl ?? null;
      this.image = preparedPreviewOf(photo);
      if (photo && !this.image) this.onError('Missing prepared photo preview');
    }
    this.draw();
  }

  // UI — one geometry owner supplies both rendering and input hit/coordinate mapping.
  geometry(view = this.view) {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return null;
    const frame = this.output.frame;
    const baseScale = Math.min(width * (1 - 2 * this.presentation.insetX / 100) / frame.width,
      height * (1 - 2 * this.presentation.insetY / 100) / frame.height);
    const scale = baseScale * (view ? view.zoom : 1);
    const fw = frame.width * scale, fh = frame.height * scale;
    const left = (width - fw) / 2 + (view ? view.x * baseScale : 0);
    const top = (height - fh) / 2 + (view ? view.y * baseScale : 0);
    return { width, height, baseScale, scale, fw, fh, left, top, frame, rect: this.canvas.getBoundingClientRect() };
  }

  point(event, geometry = this.geometry()) {
    if (!geometry) return null;
    return { x: (event.clientX - geometry.rect.left - geometry.left) / geometry.scale - geometry.frame.width / 2,
      y: (event.clientY - geometry.rect.top - geometry.top) / geometry.scale - geometry.frame.height / 2 };
  }

  inFrame(event, geometry = this.geometry()) {
    if (!geometry) return false;
    const x = event.clientX - geometry.rect.left, y = event.clientY - geometry.rect.top;
    return x >= geometry.left && x <= geometry.left + geometry.fw && y >= geometry.top && y <= geometry.top + geometry.fh;
  }

  draw() {
    const geometry = this.geometry();
    if (!geometry) return;
    const { width, height, scale, fw, fh, left, top } = geometry;
    const dpr = window.devicePixelRatio;
    const pixelWidth = Math.round(width * dpr), pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) { this.canvas.width = pixelWidth; this.canvas.height = pixelHeight; }
    const context = this.canvas.getContext('2d');
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.fillStyle = `rgb(${this.output.matte.join(',')})`;
    context.fillRect(left, top, fw, fh);
    if (!this.image || !this.photo || !this.document) return;
    const transform = this.document;
    context.save();
    context.beginPath(); context.rect(left, top, fw, fh); context.clip();
    context.translate(left + fw / 2 + transform.x * scale, top + fh / 2 + transform.y * scale);
    context.rotate(transform.rotation * Math.PI / 180);
    context.scale(transform.scale * scale, transform.scale * scale);
    context.drawImage(this.image, -this.photo.width / 2, -this.photo.height / 2, this.photo.width, this.photo.height);
    context.restore();
  }

  dispose() { this.observer.disconnect(); this.image = null; this.photo = null; }
}
