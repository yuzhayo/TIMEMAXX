// LOGIC — photo/preview identity, output choice and saved state; history owns transforms.
const previews = new WeakMap();
export const preparedPreviewOf = (photo) => photo ? previews.get(photo) ?? null : null;
export class PhotoState {
  constructor(output, initialDocument) {
    this.output = output;
    this.outputWidth = output.defaultWidth;
    this.photo = null;
    this.busy = false;
    this.message = 'Ready. Load an image or save a black frame.';
    this.savedKey = this.key(initialDocument);
  }

  key(document) { return JSON.stringify({ photoId: this.photo?.photoId ?? null, width: this.outputWidth, document }); }
  async prepare(metadata, preview) {
    const previewUrl = URL.createObjectURL(new Blob([preview], { type: 'image/png' }));
    try {
      const previewImage = new Image();
      previewImage.src = previewUrl;
      await previewImage.decode();
      if (!previewImage.naturalWidth || !previewImage.naturalHeight) throw new Error('Cannot decode the photo preview');
      const photo = { ...metadata, previewUrl };
      previews.set(photo, previewImage);
      return photo;
    } catch (error) { this.release({ previewUrl }); throw error; }
  }
  replace(photo) {
    const previous = this.photo;
    this.photo = photo;
    this.savedKey = null;
    return previous;
  }
  release(photo, onError) {
    if (photo) previews.delete(photo);
    try { if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl); }
    catch (error) { try { onError?.(error.message); } catch {} }
  }
  setActivity(busy, message) { this.busy = busy; this.message = message; }
  setMessage(message) { this.message = message; }
  finishActivity() { this.busy = false; }
  setOutputWidth(width) {
    if (!this.output.exports.some((size) => size.width === width)) throw new Error('Unsupported output resolution');
    this.outputWidth = width;
  }
  markSaved(key) { this.savedKey = key; }
  snapshot(document) {
    return { photo: this.photo, output: this.output, outputWidth: this.outputWidth, busy: this.busy, message: this.message, dirty: this.key(document) !== this.savedKey };
  }
  dispose() { this.release(this.photo); this.photo = null; }
}
