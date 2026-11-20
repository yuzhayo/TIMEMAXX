const { dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const imageExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'tif', 'tiff'];

// LOGIC — native selection and filesystem protection; no renderer/chrome styling.
class ImageFileDialogs {
  constructor(window, worker, directory, output) {
    this.window = window;
    this.worker = worker;
    this.directory = directory;
    this.output = output;
    this.photo = null;
    this.originals = [];
    this.busy = false;
  }

  async perform(action) {
    if (this.busy) return { ok: false, error: 'An image-file operation is already running' };
    this.busy = true;
    try { return { ok: true, result: await action() }; }
    catch (error) { return { ok: false, error: error.message }; }
    finally { this.busy = false; }
  }

  open() {
    return this.perform(async () => {
      const selection = await dialog.showOpenDialog(this.window, { title: 'Load image', properties: ['openFile'], filters: [{ name: 'Images', extensions: imageExtensions }] });
      if (selection.canceled || !selection.filePaths.length) return null;
      return this.loadSource(selection.filePaths[0]);
    });
  }

  openDropped(filePath) { return this.perform(() => this.loadSource(filePath)); }

  // LOGIC — dialog and drop share decode, replacement identity and original-file protection.
  async loadSource(filePath) {
    if (typeof filePath !== 'string' || !path.isAbsolute(filePath) || filePath.includes('\0')) throw new Error('Choose a local image file.');
    const source = await fs.realpath(filePath);
    const stat = await fs.stat(source);
    if (!stat.isFile()) throw new Error('Drop an image file, not a folder.');
    if (!imageExtensions.includes(path.extname(source).slice(1).toLowerCase())) throw new Error('Unsupported image type. Drop a PNG, JPEG, WebP, BMP or TIFF image.');
    const previewPath = path.join(this.directory, `preview-${randomUUID()}.png`);
    try {
      const metadata = await this.worker.request({ op: 'load', path: source, preview_path: previewPath });
      const preview = new Uint8Array(await fs.readFile(previewPath));
      this.originals.push({ path: source, dev: stat.dev, ino: stat.ino });
      this.photo = { ...metadata, path: source, name: path.basename(source) };
      return { ...this.photo, preview };
    } finally { await fs.rm(previewPath, { force: true }); }
  }

  save(snapshot) {
    return this.perform(async () => {
      if (!snapshot || !this.output.exports.some((size) => size.width === snapshot.width)) throw new Error('Unsupported output resolution');
      if (snapshot.photoId !== null && snapshot.photoId !== this.photo?.photoId) throw new Error('The photo changed; save again');
      const stem = this.photo ? path.parse(this.photo.name).name : 'black-frame';
      const selection = await dialog.showSaveDialog(this.window, { title: 'Save image', defaultPath: `${stem}-export.png`, filters: [{ name: 'PNG image', extensions: ['png'] }, { name: 'JPEG image', extensions: ['jpg', 'jpeg'] }] });
      if (selection.canceled || !selection.filePath) return null;
      const destination = path.extname(selection.filePath) ? selection.filePath : `${selection.filePath}.png`;
      if (!['.png', '.jpg', '.jpeg'].includes(path.extname(destination).toLowerCase())) throw new Error('Choose a PNG or JPEG filename');
      let existing = null;
      try { existing = { path: await fs.realpath(destination), stat: await fs.stat(destination) }; }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      if (existing && this.originals.some((source) => source.path.toLowerCase() === existing.path.toLowerCase() || (source.dev === existing.stat.dev && source.ino === existing.stat.ino))) {
        throw new Error('The original photo cannot be overwritten. Choose a different filename.');
      }
      return this.worker.request({ op: 'export', path: destination, width: snapshot.width, photo_id: snapshot.photoId, transform: snapshot.transform });
    });
  }
}

module.exports = { ImageFileDialogs };
