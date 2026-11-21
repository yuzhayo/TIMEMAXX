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
  const candidateIssue = (origin, message, accepted, preview = false) => diagnostics?.report({
    code: 'PHOTO_CANDIDATE_CLEANUP_FAILED', componentId: origin?.componentId, instanceId: origin?.instanceId,
    parentId: origin?.parentId, configPath: origin?.configPath, filePath: origin?.filePath ?? 'logic/ImageFileActions.mjs',
    expected: 'owned photo candidate and preview resources settled', actual: message,
    action: preview ? accepted ? 'new image accepted; previous preview resource cleanup failed' : 'current image retained; preview resource cleanup failed'
      : accepted ? 'new image accepted; pending cleanup must reconcile before the next image operation' : 'current image retained; pending candidate must reconcile before the next image operation',
  });
  const acceptLoadedImage = async (response, origin) => {
    if (disposed && !response?.result) return;
    if (!response.ok) throw new Error(response.error);
    if (!response.result) { photoState.setMessage('Load canceled. Current image unchanged.'); return; }
    const { preview, photoId, width, height, name, path } = response.result;
    let prepared = null, committed = false;
    try {
      if (disposed) return;
      if (![photoId, width, height].every((value) => Number.isSafeInteger(value) && value > 0)
        || typeof name !== 'string' || !name || typeof path !== 'string' || !path
        || !ArrayBuffer.isView(preview) || preview.byteLength === 0) throw new Error('Invalid prepared photo/preview metadata');
      const metadata = { photoId, width, height, name, path };
      const document = centeredFill(metadata, output.frame);
      prepared = await photoState.prepare(metadata, preview);
      if (disposed) return;
      const accepted = await transport.acceptImage(photoId);
      if (!accepted?.ok || accepted.result?.photoId !== photoId) throw new Error(accepted?.error ?? 'Photo acceptance was not confirmed');
      if (disposed) return;
      history.reset(document);
      const previous = photoState.replace(prepared);
      prepared = null; committed = true;
      photoState.setMessage(`Loaded ${metadata.name} · ${metadata.width} × ${metadata.height}`);
      publish();
      photoState.release(previous, (message) => candidateIssue(origin, message, true, true));
      try {
        const finalized = await transport.finalizeImage(photoId);
        if (!finalized?.ok || finalized.result?.photoId !== photoId) throw new Error(finalized?.error ?? 'Photo finalization was not confirmed');
      } catch (error) { if (!disposed) candidateIssue(origin, error.message, true); }
    } finally {
      if (!committed && Number.isSafeInteger(photoId) && photoId > 0) {
        try {
          const discarded = await transport.discardImage(photoId);
          if (!discarded?.ok) throw new Error(discarded?.error ?? 'Photo candidate cleanup was not confirmed');
        } catch (error) { if (!disposed) candidateIssue(origin, error.message, false); }
      }
      photoState.release(prepared, (message) => { if (!disposed) candidateIssue(origin, message, committed, true); });
    }
  };
  return {
    load: (origin) => perform('load', origin, 'Choose an image…', async () => {
      await acceptLoadedImage(await transport.openImage(photoState.photo?.photoId ?? null), origin);
    }),
    ...(typeof transport.dropImage === 'function' ? {
      drop: (files, origin) => perform('drop', origin, 'Loading dropped image…', async () => {
        if (!Array.isArray(files) || files.length !== 1) throw new Error('Drop exactly one image file. Current image unchanged.');
        await acceptLoadedImage(await transport.dropImage(files[0], photoState.photo?.photoId ?? null), origin);
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
