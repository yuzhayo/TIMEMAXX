import { PhotoHistory } from './PhotoHistory.mjs';
import { PhotoState } from './PhotoState.mjs';
import { createImageFileActions } from './ImageFileActions.mjs';
import { createWindowActions } from './WindowActions.mjs';
import { createPhotoOperations, sizePercentOf } from './PhotoOperations.mjs';
import { ViewState } from './ViewState.mjs';
import { createViewOperations } from './ViewOperations.mjs';
import { createInputScreenAction } from './InputScreenActions.mjs';

// LOGIC — compose independent document/history, file and window capabilities.
export function createFrameSession(config, services = {}) {
  // Document availability and optional history policy are independent capabilities.
  // Null is an explicit no-tracking mode, not an invented replacement limit.
  const history = new PhotoHistory(services.document, config === null ? null : config.limit);
  const photoState = services.output ? new PhotoState(services.output, services.document) : null;
  const viewState = services.view ? new ViewState(services.view) : null;
  const listeners = new Set();
  let windowActions = null;
  const read = () => {
    const edit = { ...history.snapshot(), historyAvailable: config !== null, rotationSettings: services.rotation ?? null,
      ...(viewState ? { view: viewState.snapshot() } : {}),
      ...(services.diagnostics ? { diagnostics: services.diagnostics.getSnapshot() } : {}),
    };
    const state = photoState ? { ...edit, ...photoState.snapshot(edit.document) } : edit;
    const sized = services.size
      ? { ...state, sizeSettings: services.size, sizePercent: state.photo ? sizePercentOf(state.document, state.photo, services.output?.frame, services.size.precision) : null }
      : state;
    return windowActions ? { ...sized, windowState: windowActions.snapshot() } : sized;
  };
  let snapshot = read();
  const publish = (changed) => {
    if (!changed) return;
    snapshot = read();
    for (const listener of listeners) listener();
  };
  const files = photoState && services.transport ? createImageFileActions({ transport: services.transport, photoState, history, output: services.output, publish: () => publish(true), diagnostics: services.diagnostics }) : null;
  const photoOperations = photoState && services.output
    ? createPhotoOperations({ history, photoState, settings: services.rotation, size: services.size ?? null, output: services.output, publish }) : null;
  const viewOperations = viewState ? createViewOperations({ viewState, publish }) : null;
  if (services.transport?.windowAction && services.transport?.onWindowState) {
    windowActions = createWindowActions({ transport: services.transport, initialState: services.windowState, publish: () => publish(true), diagnostics: services.diagnostics });
    snapshot = read();
  }
  const unsubscribeDiagnostics = services.diagnostics?.subscribe(() => publish(true));
  const reportUiFailure = (failure, origin = {}) => services.diagnostics?.report({
    code: failure.code ?? 'UI_INTERACTION_FAILED', operation: failure.operation,
    componentId: origin.componentId, instanceId: origin.instanceId, parentId: origin.parentId,
    filePath: origin.filePath, configPath: origin.configPath,
    expected: failure.expected ?? 'successful UI interaction',
    actual: failure.error instanceof Error ? failure.error.message : String(failure.error ?? 'Unknown UI interaction failure'),
    action: failure.action ?? 'interaction stopped; current state retained',
  });
  return {
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    getSnapshot: () => snapshot,
    commit: (next) => { if (!photoState?.busy) publish(history.commit(next)); },
    undo: () => { if (!photoState?.busy) publish(history.undo()); },
    redo: () => { if (!photoState?.busy) publish(history.redo()); },
    ...(files ? { load: files.load, save: files.save } : {}),
    ...(files?.drop ? { drop: files.drop } : {}),
    ...(windowActions ? { windowAction: windowActions.activate } : {}),
    ...(typeof services.transport?.openInputScreen === 'function'
      ? { openInputScreen: createInputScreenAction({ transport: services.transport, reportFailure: reportUiFailure }) } : {}),
    ...(photoOperations ?? {}),
    ...(viewOperations ?? {}),
    setOutputWidth: (width) => { if (photoState && !photoState.busy) { photoState.setOutputWidth(width); publish(true); } },
    reportUiFailure,
    previewFailed: (message, origin, operation = 'preview') => reportUiFailure({ code: 'PHOTO_PREVIEW_FAILED', operation,
      expected: 'decoded photo preview', error: message, action: 'preview update stopped; original photo retained for export' }, origin),
    dispose: () => { unsubscribeDiagnostics?.(); files?.dispose(); windowActions?.dispose(); photoState?.dispose(); listeners.clear(); },  };
}
