import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';
import { PreviewPainter } from '@frame/view/preview/PreviewPainter.mjs';
import { SideTextCalibration } from '@frame/view/preview/SideTextCalibration.mjs';
import { attachPhotoPointerInput, pointerSettingsProblem } from '@frame/view/window/frame-body/PhotoPointerInput.mjs';
import { attachPhotoWheelInput, wheelSettingsProblem } from '@frame/view/window/frame-body/PhotoWheelInput.mjs';

export const componentId = 'photo.preview';
export const configKeys = ['presentation', 'input', 'calibration'];
const originOf = (config, suffix = '') => ({ componentId: config.componentId, instanceId: config.id,
  parentId: config.parentId, filePath: config.filePath, configPath: `${config.configPath}${suffix}` });

// LOGIC — presentation options belong to this control and are validated before mount.
export function validateConfig(config, report) {
  const value = config.presentation;
  if (!value || typeof value !== 'object' || Array.isArray(value)) { report('presentation', '{insetX,insetY}', value); return false; }
  let valid = true;
  for (const key of Object.keys(value)) if (!['insetX', 'insetY'].includes(key)) { report(`presentation.${key}`, 'supported preview setting', value[key]); valid = false; }
  for (const key of ['insetX', 'insetY']) if (!Number.isFinite(value[key]) || value[key] < 0 || value[key] >= 50) { report(`presentation.${key}`, 'percentage from 0 to less than 50', value[key]); valid = false; }
  if (config.input !== undefined) {
    const input = config.input;
    if (!input || typeof input !== 'object' || Array.isArray(input)) { report('input', 'configured preview input object', input); return false; }
    for (const key of Object.keys(input)) if (!['pointer', 'wheel', 'cursors'].includes(key)) { report(`input.${key}`, 'pointer | wheel | cursors', input[key]); valid = false; }
    for (const [name, validate] of [['pointer', pointerSettingsProblem], ['wheel', wheelSettingsProblem]]) {
      const problem = validate(input[name]);
      if (problem) { report(`input.${name}${problem.property ? `.${problem.property}` : ''}`, problem.expected, problem.actual); valid = false; }
    }
    const cursorKeys = ['idle', 'photo', 'photoDrag', 'view', 'viewDrag', 'disabled'];
    if (!input.cursors || typeof input.cursors !== 'object' || Array.isArray(input.cursors)) { report('input.cursors', 'configured cursor states', input.cursors); valid = false; }
    else {
      for (const key of Object.keys(input.cursors)) if (!cursorKeys.includes(key)) { report(`input.cursors.${key}`, 'supported cursor state', input.cursors[key]); valid = false; }
      for (const key of cursorKeys) if (!['default', 'grab', 'grabbing', 'move', 'not-allowed', 'crosshair'].includes(input.cursors[key])) {
        report(`input.cursors.${key}`, 'supported explicit cursor', input.cursors[key]); valid = false;
      }
    }
  }
  if (config.calibration !== undefined) {
    const calibration = config.calibration;
    const keys = ['enabled', 'lockedGroups', 'opacity', 'keyboardStep', 'keyboardStepFast'];
    if (!calibration || typeof calibration !== 'object' || Array.isArray(calibration)) {
      report('calibration', 'configured calibration object', calibration); valid = false;
    } else {
      for (const key of Object.keys(calibration)) if (!keys.includes(key)) {
        report(`calibration.${key}`, 'supported calibration setting', calibration[key]); valid = false;
      }
      if (typeof calibration.enabled !== 'boolean') { report('calibration.enabled', 'boolean', calibration.enabled); valid = false; }
      if (!Array.isArray(calibration.lockedGroups) || calibration.lockedGroups.some((id) => !['sideCode', 'sideVerified'].includes(id))) {
        report('calibration.lockedGroups', 'array containing sideCode | sideVerified', calibration.lockedGroups); valid = false;
      }
      if (!Number.isFinite(calibration.opacity) || calibration.opacity <= 0 || calibration.opacity > 1) {
        report('calibration.opacity', 'number above 0 through 1', calibration.opacity); valid = false;
      }
      for (const key of ['keyboardStep', 'keyboardStepFast']) if (!Number.isFinite(calibration[key]) || calibration[key] <= 0) {
        report(`calibration.${key}`, 'positive number', calibration[key]); valid = false;
      }
    }
  }
  return valid;
}

export default function PhotoPreview({ config, state, actions }) {
  const canvas = useRef(null);
  const calibrationCanvas = useRef(null);
  const painter = useRef(null);
  const calibration = useRef(null);
  const previewFailure = useRef(null);
  const previewFailureCalls = useRef(0);
  const reportPreview = (operation, error) => {
    previewFailureCalls.current += 1;
    const message = error instanceof Error ? error.message : String(error);
    const key = message;
    if (previewFailure.current === key) return;
    previewFailure.current = key;
    actions.previewFailed(message, originOf(config), operation);
  };
  useEffect(() => {
    if (!state.output) return;
    const reportInput = (kind, operation, error) => actions.reportUiFailure?.({ code: `PHOTO_${kind.toUpperCase()}_INPUT_FAILED`, operation,
      expected: `successful configured ${kind} input`, error, action: `${kind} gesture canceled; current photo/view state retained` }, originOf(config, `.input.${kind}`));
    let instance, calibrator, pointer, wheel;
    try {
      instance = new PreviewPainter(canvas.current, state.output, config.presentation, (message, operation = 'preview-resource') => reportPreview(operation, message));
      painter.current = instance;
      const current = actions.getSnapshot();
      const failureCalls = previewFailureCalls.current;
      instance.update(current.photo, current.document, current.view);
      if (config.calibration?.enabled && calibrationCanvas.current) {
        calibrator = new SideTextCalibration({ canvas: calibrationCanvas.current, painter: instance,
          config: config.calibration, load: () => window.frameHost.loadCalibration(),
          save: (value) => window.frameHost.saveCalibration(value),
          onError: (error) => reportPreview('side-calibration', error) });
        calibration.current = calibrator;
      }
      if (previewFailureCalls.current === failureCalls) previewFailure.current = null;
      if (config.input) {
        pointer = attachPhotoPointerInput({ canvas: canvas.current, painter: instance, settings: config.input.pointer,
          cursors: config.input.cursors, actions, beforeStart: () => wheel?.finish(), onError: (operation, error) => reportInput('pointer', operation, error) });
        wheel = attachPhotoWheelInput({ canvas: canvas.current, painter: instance, settings: config.input.wheel,
          actions, isBlocked: () => pointer.isActive(), onError: (operation, error) => reportInput('wheel', operation, error) });
      }
    } catch (error) {
      reportPreview('preview-setup', error);
      wheel?.dispose(); pointer?.dispose(); calibrator?.dispose(); instance?.dispose();
      calibration.current = null; painter.current = null;
      return undefined;
    }
    return () => { wheel?.dispose(); pointer?.dispose(); calibrator?.dispose(); calibration.current = null;
      painter.current = null; instance.dispose(); };
  }, [config, state.output, actions]);
  // LOGIC — Frame subscribes to the parent engine's layer changes. Editing
  // code.json in Input re-renders and pushes new layers without a restart;
  // an engine failure only hides layers, it never breaks the photo preview.
  useEffect(() => {
    let alive = true;
    const apply = (result) => {
      if (!alive || !result?.ok) return;
      const layers = result.layers ?? [];
      if (config.calibration?.enabled) {
        const calibrationLayers = layers.filter((layer) => ['sideCode', 'sideVerified'].includes(layer.id));
        painter.current?.setLayers(layers.filter((layer) => !['sideCode', 'sideVerified'].includes(layer.id)));
        calibration.current?.setLayers(calibrationLayers);
      } else painter.current?.setLayers(layers);
    };
    window.frameHost?.layers?.().then(apply).catch(() => undefined);
    const detach = window.frameHost?.onLayersChanged?.(apply);
    return () => { alive = false; detach?.(); };
  }, [config, state.output]);
  useEffect(() => {
    const failureCalls = previewFailureCalls.current;
    try { painter.current?.update(state.photo, state.document, state.view); calibration.current?.draw();
      if (previewFailureCalls.current === failureCalls) previewFailure.current = null; }
    catch (error) { reportPreview('preview-update', error); }
  }, [state.photo, state.document, state.view, config, actions]);

  // UI — image frame matte is output data; workspace presentation remains JSON-owned.
  return <Box sx={{ ...fill, ...configuredSx(config), position: 'relative' }}>
    <canvas id={config.id} ref={canvas} aria-label={config.label} tabIndex={0} style={{ ...fill, touchAction: 'none',
      outlineColor: 'inherit', outlineWidth: 'inherit', outlineStyle: 'inherit', outlineOffset: 'inherit' }} />
    {config.calibration?.enabled && <canvas ref={calibrationCanvas} aria-label="Side text calibration overlay" tabIndex={0}
      style={{ ...fill, position: 'absolute', inset: 0, touchAction: 'none', cursor: 'move', outline: 'none' }} />}
  </Box>;
}
