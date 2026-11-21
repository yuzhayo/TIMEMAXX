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
    this.pending = null;
    this.closing = false;
    this.operation = Promise.resolve();
  }

  run(action) {
    if (this.busy || this.closing) return Promise.resolve({ ok: false, error: this.closing ? 'Image-file session is closing' : 'An image-file operation is already running' });
    this.busy = true;
    this.operation = (async () => {
      try { return { ok: true, result: await action() }; }
      catch (error) { return { ok: false, error: error.message }; }
      finally { this.busy = false; }
    })();
    return this.operation;
  }

  perform(currentPhotoId, action, allowBlack = false) {
    return this.run(async () => {
      if (currentPhotoId !== null && (!Number.isSafeInteger(currentPhotoId) || currentPhotoId <= 0)) throw new Error('Invalid current photo identity');
      // A new command explicitly identifies the renderer's photo, settling a lost acknowledgement safely.
      // Null is an explicit empty/black scene (also after reload), not a request for retained photo pixels.
      if (this.pending) {
        if (this.pending.accepted && currentPhotoId === this.pending.photo.photoId) await this.finalizeCandidate(currentPhotoId);
        else if (currentPhotoId === (this.pending.previousPhoto?.photoId ?? null) || allowBlack && currentPhotoId === null) await this.discardCandidate(this.pending.photo.photoId);
        else throw new Error('The photo candidate is awaiting its owner');
      }
      if (currentPhotoId !== (this.photo?.photoId ?? null) && !(allowBlack && currentPhotoId === null)) throw new Error('The photo changed; load again');
      return action();
    });
  }

  open(currentPhotoId) {
    return this.perform(currentPhotoId, async () => {
      const selection = await dialog.showOpenDialog(this.window, { title: 'Load image', properties: ['openFile'], filters: [{ name: 'Images', extensions: imageExtensions }] });
      if (selection.canceled || !selection.filePaths.length) return null;
      return this.loadSource(selection.filePaths[0]);
    }, true);
  }

  openDropped(filePath, currentPhotoId) { return this.perform(currentPhotoId, () => this.loadSource(filePath), true); }

  candidate(photoId) {
    if (!Number.isSafeInteger(photoId) || photoId <= 0 || this.pending?.photo.photoId !== photoId) throw new Error('Photo candidate no longer active');
    return this.pending;
  }

  accept(photoId) {
    return this.run(async () => {
      const pending = this.candidate(photoId);
      await this.worker.request({ op: 'accept_load', photo_id: photoId });
      if (!pending.accepted) {
        pending.accepted = true;
        this.photo = pending.photo;
        this.originals.push(pending.original);
      }
      return { photoId };
    });
  }

  finalize(photoId) { return this.run(() => this.finalizeCandidate(photoId)); }
  async finalizeCandidate(photoId) {
    const pending = this.candidate(photoId);
    if (!pending.accepted) throw new Error('Photo candidate has not been accepted');
    await this.worker.request({ op: 'finalize_load', photo_id: photoId });
    this.pending = null;
    return { photoId };
  }

  discard(photoId) { return this.run(() => this.discardCandidate(photoId)); }
  async discardCandidate(photoId) {
    const pending = this.candidate(photoId);
    await this.worker.request({ op: 'discard_load', photo_id: photoId });
    this.photo = pending.previousPhoto;
    this.originals.length = pending.originalsLength;
    this.pending = null;
    return { photoId: this.photo?.photoId ?? null };
  }

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
      if (!Number.isSafeInteger(metadata.photoId) || metadata.photoId <= 0) throw new Error('Invalid prepared photo identity');
      this.pending = { photo: { ...metadata, path: source, name: path.basename(source) }, previousPhoto: this.photo,
        original: { path: source, dev: stat.dev, ino: stat.ino }, originalsLength: this.originals.length, accepted: false };
      const preview = new Uint8Array(await fs.readFile(previewPath));
      await fs.rm(previewPath, { force: true });
      if (this.closing) throw new Error('Image-file session is closing');
      return { ...this.pending.photo, preview };
    } catch (error) {
      if (this.pending) {
        try { await this.discardCandidate(this.pending.photo.photoId); }
        catch (cleanup) { error.message += `; candidate cleanup pending: ${cleanup.message}`; }
      }
      try { await fs.rm(previewPath, { force: true }); } catch (cleanup) { error.message += `; preview cleanup failed: ${cleanup.message}`; }
      throw error;
    }
  }

  save(snapshot) {
    return this.perform(snapshot?.photoId, async () => {
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
    }, true);
  }

  dispose() {
    if (!this.disposal) {
      this.closing = true;
      this.disposal = (async () => { await this.operation; if (this.pending) await this.discardCandidate(this.pending.photo.photoId); })();
    }
    return this.disposal;
  }
}

module.exports = { ImageFileDialogs };
