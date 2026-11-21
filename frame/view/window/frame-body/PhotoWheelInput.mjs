import { interactionBlocked } from '@frame/logic/InteractionPolicy.mjs';

// LOGIC — wheel bindings, unit conversion and idle grouping live with wheel input.
export function wheelSettingsProblem(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { property: '', expected: 'wheel settings object', actual: settings };
  const keys = ['enabled', 'bindings', 'linePixels', 'pagePixels', 'maxDelta', 'sizeRate', 'rotationRate', 'moveRate', 'viewRate', 'idleMs'];
  for (const key of Object.keys(settings)) if (!keys.includes(key)) return { property: key, expected: 'supported wheel setting', actual: settings[key] };
  if (typeof settings.enabled !== 'boolean') return { property: 'enabled', expected: 'boolean', actual: settings.enabled };
  for (const key of keys.filter((key) => !['enabled', 'bindings'].includes(key))) if (!Number.isFinite(settings[key]) || settings[key] <= 0) {
    return { property: key, expected: 'positive finite input policy value', actual: settings[key] };
  }
  if (!settings.bindings || typeof settings.bindings !== 'object' || Array.isArray(settings.bindings)) return { property: 'bindings', expected: 'modifier-to-action object', actual: settings.bindings };
  const modifiers = ['none', 'control', 'alt', 'shift'];
  for (const key of Object.keys(settings.bindings)) if (!modifiers.includes(key)) return { property: `bindings.${key}`, expected: modifiers.join(' | '), actual: settings.bindings[key] };
  for (const key of modifiers) if (!['none', 'size', 'rotate', 'moveX', 'moveY', 'viewZoom'].includes(settings.bindings[key])) {
    return { property: `bindings.${key}`, expected: 'none | size | rotate | moveX | moveY | viewZoom', actual: settings.bindings[key] };
  }
  return null;
}

export function attachPhotoWheelInput({ canvas, painter, settings, actions, isBlocked, onError }) {
  let gesture = null;
  let timeout = null;
  let reportingFailure = false;
  const clearTimer = () => { if (timeout !== null) clearTimeout(timeout); timeout = null; };
  const end = (cancel = false) => {
    clearTimer();
    const previous = gesture;
    gesture = null;
    if (!previous) return;
    if (previous.kind === 'viewZoom') {
      if (cancel) actions.cancelViewEdit(previous.edit); else actions.finishViewEdit(previous.edit);
    } else {
      if (cancel) actions.cancelPhotoEdit(previous.edit); else actions.finishPhotoEdit(previous.edit);
    }
  };
  const active = () => gesture && (gesture.kind === 'viewZoom'
    ? actions.isViewEditActive(gesture.edit) : actions.isPhotoEditActive(gesture.edit));
  const failed = (operation, error) => {
    if (reportingFailure) return;
    reportingFailure = true;
    try { try { end(true); } catch {} onError?.(operation, error); }
    finally { reportingFailure = false; }
  };
  const safe = (operation, handler) => (...args) => {
    try { return handler(...args); }
    catch (error) { failed(operation, error); return undefined; }
  };
  const wheel = (event) => {
    const state = actions.getSnapshot();
    if (!settings.enabled || interactionBlocked({ document, target: event.target, state }) || isBlocked()) { if (gesture) end(); return; }
    const geometry = painter.geometry(state.view);
    if (!painter.inFrame(event, geometry)) return;
    const modifier = event.ctrlKey || event.metaKey ? 'control' : event.altKey ? 'alt' : event.shiftKey ? 'shift' : 'none';
    const kind = settings.bindings[modifier];
    if (kind === 'none' || (kind === 'viewZoom' ? !state.view : !state.photo)) return;
    if (kind === 'size' && !state.sizeSettings || kind === 'rotate' && !state.rotationSettings) return;
    const unit = event.deltaMode === 1 ? settings.linePixels : event.deltaMode === 2 ? settings.pagePixels : 1;
    const delta = Math.max(-settings.maxDelta, Math.min(settings.maxDelta, event.deltaY * unit));
    if (!Number.isFinite(delta) || delta === 0) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    if (gesture && (gesture.kind !== kind || !active())) end();
    if (!gesture) {
      const edit = kind === 'viewZoom' ? actions.beginViewEdit() : actions.beginPhotoEdit();
      if (!edit) return;
      gesture = { kind, edit };
    }
    const anchor = painter.point(event, geometry);
    if (kind === 'viewZoom') actions.updateViewWheel(delta, anchor, gesture.edit, settings);
    else actions.updatePhotoWheel(kind, delta, anchor, gesture.edit, settings);
    if (!gesture) return;
    clearTimer(); timeout = setTimeout(() => end(), settings.idleMs);
  };
  const keyDown = (event) => {
    if (event.key === 'Escape' && gesture && event.target === canvas) { event.preventDefault(); end(true); }
  };
  const focusIn = (event) => { if (gesture && interactionBlocked({ document, target: event.target, state: actions.getSnapshot(), controls: 'keyboard' })) end(); };
  const blur = () => end();
  const handlers = { wheel: safe('wheel', wheel), canvasBlur: safe('canvas-blur', blur), keydown: safe('keydown', keyDown),
    focusin: safe('focusin', focusIn), windowBlur: safe('window-blur', blur), state: safe('state', () => { if (gesture && (!active() || actions.getSnapshot().busy)) end(); }) };
  canvas.addEventListener('wheel', handlers.wheel, { passive: false });
  canvas.addEventListener('blur', handlers.canvasBlur); window.addEventListener('keydown', handlers.keydown);
  window.addEventListener('focusin', handlers.focusin); window.addEventListener('blur', handlers.windowBlur);
  const unsubscribe = actions.subscribe(handlers.state);
  return {
    finish: () => end(),
    dispose: () => {
      unsubscribe();
      canvas.removeEventListener('wheel', handlers.wheel); canvas.removeEventListener('blur', handlers.canvasBlur);
      window.removeEventListener('keydown', handlers.keydown); window.removeEventListener('focusin', handlers.focusin); window.removeEventListener('blur', handlers.windowBlur);
      safe('dispose', end)();
    },
  };
}
