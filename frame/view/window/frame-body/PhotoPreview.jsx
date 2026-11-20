import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import { configuredSx, fill } from '@ui/appearance.mjs';
import { PreviewPainter } from '@frame/view/preview/PreviewPainter.mjs';
import { attachPhotoPointerInput, pointerSettingsProblem } from '@frame/view/window/frame-body/PhotoPointerInput.mjs';
import { attachPhotoWheelInput, wheelSettingsProblem } from '@frame/view/window/frame-body/PhotoWheelInput.mjs';

export const componentId = 'photo.preview';
export const configKeys = ['presentation', 'input'];

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
  return valid;
}

export default function PhotoPreview({ config, state, actions }) {
  const canvas = useRef(null);
  const painter = useRef(null);
  useEffect(() => {
    if (!state.output) return;
    const instance = new PreviewPainter(canvas.current, state.output, config.presentation, actions.previewFailed);
    painter.current = instance;
    const current = actions.getSnapshot();
    instance.update(current.photo, current.document, current.view);
    let pointer, wheel;
    if (config.input) {
      pointer = attachPhotoPointerInput({ canvas: canvas.current, painter: instance, settings: config.input.pointer,
        cursors: config.input.cursors, actions, beforeStart: () => wheel?.finish() });
      wheel = attachPhotoWheelInput({ canvas: canvas.current, painter: instance, settings: config.input.wheel,
        actions, isBlocked: () => pointer.isActive() });
    }
    return () => { wheel?.dispose(); pointer?.dispose(); painter.current = null; instance.dispose(); };
  }, [config, state.output, actions]);
  useEffect(() => painter.current?.update(state.photo, state.document, state.view), [state.photo, state.document, state.view]);

  // UI — image frame matte is output data; workspace presentation remains JSON-owned.
  return <Box sx={{ ...fill, ...configuredSx(config) }}>
    <canvas id={config.id} ref={canvas} aria-label={config.label} tabIndex={0} style={{ ...fill, touchAction: 'none',
      outlineColor: 'inherit', outlineWidth: 'inherit', outlineStyle: 'inherit', outlineOffset: 'inherit' }} />
  </Box>;
}
