import { interactionBlocked } from '@frame/logic/InteractionPolicy.mjs';

// LOGIC — pointer input translates gestures; operations/history own edits and calculations.
export function pointerSettingsProblem(settings) {
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return { property: '', expected: 'pointer settings object', actual: settings };
  const keys = ['enabled', 'photoButton', 'viewButton', 'panKey'];
  for (const key of Object.keys(settings)) if (!keys.includes(key)) return { property: key, expected: 'supported pointer setting', actual: settings[key] };
  if (typeof settings.enabled !== 'boolean') return { property: 'enabled', expected: 'boolean', actual: settings.enabled };
  for (const key of ['photoButton', 'viewButton']) if (![0, 1].includes(settings[key])) return { property: key, expected: 'left (0) or middle (1) mouse button', actual: settings[key] };
  if (settings.photoButton === settings.viewButton) return { property: 'viewButton', expected: 'different photo/view buttons', actual: settings.viewButton };
  if (settings.panKey !== 'Space') return { property: 'panKey', expected: 'Space', actual: settings.panKey };
  return null;
}

export function attachPhotoPointerInput({ canvas, painter, settings, cursors, actions, beforeStart, onError }) {
  let gesture = null;
  let panHeld = false;
  let hovering = false;
  let lastEvent = null;
  let reportingFailure = false;
  const getState = actions.getSnapshot;
  const geometry = () => painter.geometry(getState().view);
  const inFrame = (event) => painter.inFrame(event, geometry());
  const blocked = (event, controls = 'editing') => interactionBlocked({ document, target: event?.target, state: getState(), controls });

  // UI — cursor appearance is configured; capture/focus are input mechanics only.
  const refreshCursor = () => {
    const state = getState();
    let cursor = cursors.idle;
    if (state.busy) cursor = cursors.disabled;
    else if (interactionBlocked({ document, target: document.activeElement, state })) cursor = cursors.idle;
    else if (gesture) cursor = gesture.kind === 'view' ? cursors.viewDrag : cursors.photoDrag;
    else if (hovering && panHeld && state.view) cursor = cursors.view;
    else if (hovering && state.photo && lastEvent && inFrame(lastEvent)) cursor = cursors.photo;
    canvas.style.cursor = cursor;
  };
  const end = (cancel) => {
    const previous = gesture;
    if (!previous) return;
    gesture = null;
    if (canvas.hasPointerCapture(previous.id)) canvas.releasePointerCapture(previous.id);
    if (previous.kind === 'photo') {
      if (cancel) actions.cancelPhotoEdit(previous.edit); else actions.finishPhotoEdit(previous.edit);
    } else {
      if (cancel) actions.cancelViewEdit(previous.edit); else actions.finishViewEdit(previous.edit);
    }
    refreshCursor();
  };
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
  const down = (event) => {
    if (!settings.enabled || gesture || blocked(event) || ![settings.photoButton, settings.viewButton].includes(event.button)) return;
    const kind = event.button === settings.viewButton || panHeld ? 'view' : 'photo';
    if (kind === 'view' ? !getState().view : !getState().photo || !inFrame(event)) return;
    beforeStart();
    const frame = geometry();
    if (!frame) return;
    const edit = kind === 'photo' ? actions.beginPhotoEdit() : actions.beginViewEdit();
    if (!edit) return;
    event.preventDefault(); canvas.focus({ preventScroll: true });
    gesture = { id: event.pointerId, kind, edit, frame,
      point: painter.point(event, frame), clientX: event.clientX, clientY: event.clientY,
      width: canvas.clientWidth, height: canvas.clientHeight };
    canvas.setPointerCapture(event.pointerId);
    refreshCursor();
  };
  const move = (event) => {
    lastEvent = event;
    if (!gesture) { refreshCursor(); return; }
    if (event.pointerId !== gesture.id) return;
    if (blocked(event) || canvas.clientWidth !== gesture.width || canvas.clientHeight !== gesture.height) { end(true); return; }
    if (gesture.kind === 'photo') {
      const point = painter.point(event, gesture.frame);
      actions.updateMove({ x: point.x - gesture.point.x, y: point.y - gesture.point.y }, gesture.edit, true);
    } else {
      actions.updateViewPan({ x: (event.clientX - gesture.clientX) / gesture.frame.baseScale,
        y: (event.clientY - gesture.clientY) / gesture.frame.baseScale }, gesture.edit);
    }
  };
  const up = (event) => { if (gesture?.id === event.pointerId) end(false); };
  const cancel = (event) => { if (gesture?.id === event.pointerId) end(true); };
  const enter = (event) => { hovering = true; lastEvent = event; refreshCursor(); };
  const leave = () => { hovering = false; refreshCursor(); };
  const keyDown = (event) => {
    if (blocked(event, 'keyboard')) return;
    if (event.key === 'Escape' && gesture) { event.preventDefault(); end(true); }
    if (settings.enabled && event.code === settings.panKey && (hovering || document.activeElement === canvas)) {
      event.preventDefault(); panHeld = true; refreshCursor();
    }
  };
  const keyUp = (event) => { if (event.code === settings.panKey) { panHeld = false; refreshCursor(); } };
  const focusIn = (event) => { if (gesture && blocked(event, 'keyboard')) end(true); };
  const blur = () => { panHeld = false; end(true); refreshCursor(); };
  const handlers = Object.fromEntries(Object.entries({ pointerdown: down, pointermove: move, pointerup: up, pointercancel: cancel,
    lostpointercapture: cancel, pointerenter: enter, pointerleave: leave }).map(([name, handler]) => [name, safe(name, handler)]));
  const windowHandlers = { keydown: safe('keydown', keyDown), keyup: safe('keyup', keyUp),
    focusin: safe('focusin', focusIn), blur: safe('blur', blur) };
  for (const [name, handler] of Object.entries(handlers)) canvas.addEventListener(name, handler);
  for (const [name, handler] of Object.entries(windowHandlers)) window.addEventListener(name, handler);
  const changed = safe('state', () => {
    if (gesture && (getState().busy || (gesture.kind === 'photo'
      ? !actions.isPhotoEditActive(gesture.edit) : !actions.isViewEditActive(gesture.edit)))) end(true);
    refreshCursor();
  });
  const unsubscribe = actions.subscribe(changed);
  safe('cursor', refreshCursor)();
  return {
    isActive: () => gesture !== null,
    dispose: () => {
      unsubscribe();
      for (const [name, handler] of Object.entries(handlers)) canvas.removeEventListener(name, handler);
      for (const [name, handler] of Object.entries(windowHandlers)) window.removeEventListener(name, handler);
      safe('dispose', () => end(true))();
    },
  };
}
