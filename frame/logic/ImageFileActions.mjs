import { centeredFill, exportTransform } from './PhotoOperations.mjs';

// LOGIC — operation sequencing and owner coordination; no component layout here.
export function createImageFileActions({ transport, photoState, history, output, publish, diagnostics }) {
  let busy = false;
  let disposed = false;
  const report = (operation, origin, message) => diagnostics?.report({
    code: 'IMAGE_FILE_OPERATION_FAILED', operation,
    componentId: origin?.componentId, instanceId: origin?.instanceId, parentId: origin?.parentId,
    configPath: origin?.configPath,
    filePath: origin?.filePath ?? 'logic/ImageFileActions.mjs',
    expected: `successful ${operation} operation`, actual: message,
    action: 'current image preserved; operation stopped',
  });
  const perform = async (operation, origin, pending, action) => {
    if (busy || disposed) return;
    history.finishEdit();
    busy = true;
    photoState.setActivity(true, pending);
    publish();
    try { await action(); }
    catch (error) { if (!disposed) { photoState.setMessage(error.message); report(operation, origin, error.message); } }
    finally {
      busy = false;
      if (!disposed) { photoState.finishActivity(); publish(); }
    }
  };
  const acceptLoadedImage = (response) => {
    if (disposed) return;
    if (!response.ok) throw new Error(response.error);
    if (!response.result) { photoState.setMessage('Load canceled. Current image unchanged.'); return; }
    const { preview, ...metadata } = response.result;
    const previewUrl = URL.createObjectURL(new Blob([preview], { type: 'image/png' }));
    photoState.replace({ ...metadata, previewUrl });
    history.reset(centeredFill(metadata, output.frame));
    photoState.setMessage(`Loaded ${metadata.name} · ${metadata.width} × ${metadata.height}`);
  };
  return {
    load: (origin) => perform('load', origin, 'Choose an image…', async () => {
      acceptLoadedImage(await transport.openImage());
    }),
    ...(typeof transport.dropImage === 'function' ? {
      drop: (files, origin) => perform('drop', origin, 'Loading dropped image…', async () => {
        if (!Array.isArray(files) || files.length !== 1) throw new Error('Drop exactly one image file. Current image unchanged.');
        acceptLoadedImage(await transport.dropImage(files[0]));
      }),
    } : {}),
    save: (origin) => perform('save', origin, 'Choose where to save…', async () => {
      const document = history.snapshot().document;
      const snapshot = photoState.snapshot(document);
      const key = photoState.key(document);
      const response = await transport.saveImage({ photoId: snapshot.photo?.photoId ?? null, width: snapshot.outputWidth, transform: exportTransform(document) });
      if (disposed) return;
      if (!response.ok) throw new Error(response.error);
      if (!response.result) { photoState.setMessage('Save canceled. No file written.'); return; }
      photoState.markSaved(key);
      photoState.setMessage(`Saved ${response.result.width} × ${response.result.height} · ${response.result.path.split(/[\\/]/).pop()}`);
    }),
    dispose: () => { disposed = true; },
  };
}
