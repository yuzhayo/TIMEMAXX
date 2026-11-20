// LOGIC — photo geometry rules shared by file loading and future editing controls.
export function centeredFill(photo, frame) {
  return { scale: placementScale(photo, frame, 0, 'fill'), x: 0, y: 0, rotation: 0 };
}

export const placementModes = Object.freeze(['fit', 'fill', 'center']);

// LOGIC — Fit/Fill account for current rotation; Center changes position only.
export function placementScale(photo, frame, rotation, mode) {
  if (!photo || !frame || !Number.isFinite(rotation) || !['fit', 'fill'].includes(mode)) throw new Error('Invalid photo placement scale request');
  const radians = rotation * Math.PI / 180;
  const cosine = Math.abs(Math.cos(radians));
  const sine = Math.abs(Math.sin(radians));
  if (mode === 'fill') {
    return Math.max((cosine * frame.width + sine * frame.height) / photo.width,
      (sine * frame.width + cosine * frame.height) / photo.height);
  }
  return Math.min(frame.width / (cosine * photo.width + sine * photo.height),
    frame.height / (sine * photo.width + cosine * photo.height));
}

export function placedDocument(document, photo, frame, mode) {
  if (!placementModes.includes(mode)) throw new Error('Unsupported photo placement');
  if (mode === 'center') return { ...document, x: 0, y: 0 };
  return { ...document, scale: placementScale(photo, frame, document.rotation, mode), x: 0, y: 0 };
}

export function exportTransform(document) {
  const transform = Object.fromEntries(['scale', 'x', 'y', 'rotation'].map((key) => [key, document[key]]));
  if (!Object.values(transform).every(Number.isFinite) || transform.scale <= 0) throw new Error('Photo transform must be finite with a positive scale');
  return transform;
}

export function rotationSettingsProblem(settings) {
  const keys = ['min', 'max', 'step', 'precision', 'buttonStep'];
  const problem = (property, expected) => ({ property, expected, actual: property ? settings[property] : settings });
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) return problem('', 'rotation policy object');
  for (const key of Object.keys(settings)) if (!keys.includes(key)) return problem(key, 'supported rotation policy property');
  for (const key of keys) if (!Number.isFinite(settings[key])) return problem(key, 'finite number');
  if (settings.max - settings.min !== 360 || settings.min > 0 || settings.max < 0) return problem('max', '360-degree interval containing zero');
  if (!Number.isInteger(settings.precision) || settings.precision < 0 || settings.precision > 100) return problem('precision', 'integer 0–100');
  for (const key of ['step', 'buttonStep']) if (settings[key] <= 0 || settings[key] > 360 || Number(settings[key].toFixed(settings.precision)) !== settings[key]) return problem(key, 'positive, representable degree increment up to 360');
  if (Math.abs(360 / settings.step - Math.round(360 / settings.step)) > 0.000001) return problem('step', 'step evenly dividing the rotation interval');
  for (const key of ['min', 'max']) if (Number(settings[key].toFixed(settings.precision)) !== settings[key]) return problem(key, 'bound representable at configured precision');
  return null;
}

export const rotationSettingsValid = (settings) => rotationSettingsProblem(settings) === null;

// LOGIC — photo size policy has one owner, like the rotation policy.
export function sizeSettingsProblem(settings) {
  const keys = ['min', 'max', 'step', 'precision'];
  const problem = (property, expected, actual) => ({ property, expected, actual: property ? settings[property] : settings });
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings)) return problem('', 'size policy object');
  for (const key of Object.keys(settings)) if (!keys.includes(key)) return problem(key, 'supported size policy property');
  for (const key of keys) if (!Number.isFinite(settings[key])) return problem(key, 'finite number');
  if (settings.min <= 0) return problem('min', 'positive minimum percent', settings.min);
  if (settings.max <= settings.min) return problem('max', 'maximum above the minimum', settings.max);
  if (settings.step <= 0 || settings.step > settings.max - settings.min) return problem('step', 'positive step inside the range', settings.step);
  if (!Number.isInteger(settings.precision) || settings.precision < 0 || settings.precision > 10) return problem('precision', 'integer 0-10', settings.precision);
  return null;
}

export const sizeSettingsValid = (settings) => sizeSettingsProblem(settings) === null;

// LOGIC — the centered fill scale is the 100% reference for photo size.
export function fitScale(photo, frame) {
  return placementScale(photo, frame, 0, 'fill');
}

export function sizePercentOf(document, photo, frame, precision = 0) {
  if (!photo || !frame) return null;
  const base = fitScale(photo, frame);
  if (!Number.isFinite(base) || base <= 0) return null;
  return Number(((document.scale / base) * 100).toFixed(precision));
}

export function scaleFromPercent(percent, photo, frame) {
  return fitScale(photo, frame) * percent / 100;
}

// LOGIC — cursor anchoring is shared sizing behavior, not wheel-handler math.
export function resizedDocument(document, scale, anchor) {
  if (!anchor) return { ...document, scale };
  const factor = scale / document.scale;
  return { ...document, scale,
    x: anchor.x - (anchor.x - document.x) * factor,
    y: anchor.y - (anchor.y - document.y) * factor,
  };
}

// Draft grammar is shared with the field; rotation rounding/wrapping has one owner.
export function parseRotationDraft(text) {
  return /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text.trim()) ? Number(text) : NaN;
}

export function normalizeRotation(value, settings) {
  if (!Number.isFinite(value) || !rotationSettingsValid(settings)) throw new Error('Invalid rotation value or policy');
  const rounded = Number(value.toFixed(settings.precision));
  const wrapped = rounded >= settings.min && rounded <= settings.max ? rounded
    : ((rounded - settings.min) % 360 + 360) % 360 + settings.min;
  const normalized = Number(wrapped.toFixed(settings.precision));
  return Object.is(normalized, -0) ? 0 : normalized;
}

// LOGIC — rotation commands own calculations; history owns gesture grouping.
export function createPhotoOperations({ history, photoState, settings, size, output, publish }) {
  const canEdit = () => {
    const snapshot = photoState?.snapshot(history.snapshot().document);
    return Boolean(snapshot?.photo) && !snapshot.busy;
  };
  const current = () => history.snapshot().document;
  const photoOf = () => photoState?.snapshot(current())?.photo ?? null;
  const frameOf = () => output?.frame ?? null;
  const percentOf = () => {
    const photo = photoOf(), frame = frameOf();
    return photo && frame && size ? sizePercentOf(current(), photo, frame, size.precision) : null;
  };
  const gestureActive = (gesture) => Boolean(gesture) && canEdit()
    && photoOf()?.photoId === gesture.photoId && history.isEditActive(gesture.token);
  const updateRotation = (value, gesture) => {
    if (gesture && !gestureActive(gesture)) return current()?.rotation;
    if (!canEdit() || !Number.isFinite(value) || !settings) return current()?.rotation;
    const next = { ...current(), rotation: normalizeRotation(value, settings) };
    publish(history.updateEdit(next, gesture?.token));
    return next.rotation;
  };
  const updateSize = (percent, anchor, gesture) => {
    if (gesture && !gestureActive(gesture)) return percentOf();
    if (!canEdit() || !Number.isFinite(percent) || !size) return percentOf();
    if (anchor && ![anchor.x, anchor.y].every(Number.isFinite)) return percentOf();
    const photo = photoOf(), frame = frameOf();
    if (!photo || !frame) return percentOf();
    const clamped = Math.min(size.max, Math.max(size.min, percent));
    publish(history.updateEdit(resizedDocument(current(), scaleFromPercent(clamped, photo, frame), anchor), gesture?.token));
    return percentOf();
  };
  const operations = {};
  Object.assign(operations, {
    beginPhotoEdit: () => {
      if (!canEdit()) return null;
      publish(history.finishEdit());
      return { token: history.beginEdit(), photoId: photoOf().photoId, document: current() };
    },
    isPhotoEditActive: gestureActive,
    finishPhotoEdit: (gesture) => { if (gesture) publish(history.finishEdit(gesture.token)); },
    cancelPhotoEdit: (gesture) => { if (gesture) publish(history.cancelEdit(gesture.token)); },
    updateMove: (delta, gesture, fromStart = false) => {
      if (!gestureActive(gesture) || ![delta?.x, delta?.y].every(Number.isFinite)) return current();
      const origin = fromStart ? gesture.document : current();
      const next = { ...current(), x: origin.x + delta.x, y: origin.y + delta.y };
      publish(history.updateEdit(next, gesture.token));
      return next;
    },
    updatePhotoWheel: (kind, delta, anchor, gesture, policy) => {
      if (!gestureActive(gesture) || !Number.isFinite(delta)) return;
      if (kind === 'size' && size) {
        const rawPercent = current().scale / fitScale(photoOf(), frameOf()) * 100;
        updateSize(rawPercent * Math.exp(-delta * policy.sizeRate), anchor, gesture);
      } else if (kind === 'rotate' && settings) updateRotation(current().rotation - delta * policy.rotationRate, gesture);
      else if (kind === 'moveX') operations.updateMove({ x: delta * policy.moveRate, y: 0 }, gesture);
      else if (kind === 'moveY') operations.updateMove({ x: 0, y: delta * policy.moveRate }, gesture);
    },
  });
  if (settings) Object.assign(operations, {
    beginRotation: () => { if (canEdit()) history.beginEdit(); },
    updateRotation,
    stepRotation: (direction) => [-1, 1].includes(direction) ? updateRotation(current().rotation + direction * settings.step) : current()?.rotation,
    finishRotation: () => { publish(history.finishEdit()); return current()?.rotation; },
    cancelRotation: () => { publish(history.cancelEdit()); return current()?.rotation; },
    rotateBy: (delta) => {
      if (!canEdit() || !Number.isFinite(delta) || !settings) return;
      publish(history.commit({ ...current(), rotation: normalizeRotation(current().rotation + delta, settings) }));
    },
  });
  if (size) Object.assign(operations, {
    beginSize: () => { if (canEdit()) history.beginEdit(); },
    updateSize,
    stepSize: (direction) => {
      const percent = percentOf();
      if (percent === null || ![-1, 1].includes(direction)) return percent;
      // LOGIC — a button step is one discrete history entry, like the rotation buttons.
      const photo = photoOf(), frame = frameOf();
      const clamped = Math.min(size.max, Math.max(size.min, percent + direction * size.step));
      publish(history.commit({ ...current(), scale: scaleFromPercent(clamped, photo, frame) }));
      return percentOf();
    },
    finishSize: () => { publish(history.finishEdit()); return percentOf(); },
    cancelSize: () => { publish(history.cancelEdit()); return percentOf(); },
  });
  operations.reset = () => {
    const photo = photoOf(), frame = frameOf();
    if (!canEdit() || !photo || !frame) return;
    publish(history.commit(centeredFill(photo, frame)));
  };
  operations.placePhoto = (mode) => {
    const photo = photoOf(), frame = frameOf();
    if (!canEdit() || !photo || !frame || !placementModes.includes(mode)) return current();
    const next = placedDocument(current(), photo, frame, mode);
    publish(history.commit(next));
    return next;
  };
  return operations;
}
