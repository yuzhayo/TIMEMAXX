import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import { configuredSx, configuredAppearance, boundsStyle, fill } from '@ui/appearance.mjs';
import { parseRotationDraft } from '@frame/logic/PhotoOperations.mjs';

export const componentId = 'photo.rotationInput';
export const requires = ['rotation', 'output'];
export const partKeys = ['input', 'degree'];
export const configKeys = ['unit', 'textSizing'];

// LOGIC — draft text is local; parsed values and grouped edits use shared owners.
export function validateConfig(config, report) {
  let valid = true;
  if (typeof config.unit !== 'string' || !config.unit.trim()) { report('unit', 'nonempty degree unit', config.unit); valid = false; }
  const sizing = config.textSizing;
  if (sizing !== undefined) {
    const keys = ['minDigits', 'maxCharacters', 'paddingCh', 'gapCh'];
    if (!sizing || typeof sizing !== 'object' || Array.isArray(sizing)) { report('textSizing', 'text sizing object', sizing); return false; }
    for (const key of Object.keys(sizing)) if (!keys.includes(key)) { report(`textSizing.${key}`, 'supported text sizing property', sizing[key]); valid = false; }
    for (const key of ['minDigits', 'maxCharacters']) if (!Number.isInteger(sizing[key]) || sizing[key] < 1) { report(`textSizing.${key}`, 'positive character count', sizing[key]); valid = false; }
    if (sizing.maxCharacters < sizing.minDigits) { report('textSizing.maxCharacters', 'at least minDigits', sizing.maxCharacters); valid = false; }
    for (const key of ['paddingCh', 'gapCh']) if (!Number.isFinite(sizing[key]) || sizing[key] < 0) { report(`textSizing.${key}`, 'nonnegative input-font character units', sizing[key]); valid = false; }
  }
  for (const name of partKeys) {
    const part = config.parts[name];
    if (sizing !== undefined) {
      if (!part.size || part.size.width !== 100) { report(`parts.${name}.size.width`, '100% of its measured text allocation; explicit height', part.size?.width); valid = false; }
      if (part.bounds) { report(`parts.${name}.bounds`, 'size-only text-measured part', part.bounds); valid = false; }
    } else {
      if (!part.bounds) { report(`parts.${name}.bounds`, 'explicit part bounds', undefined); valid = false; }
      if (part.size) { report(`parts.${name}.size`, 'bounds-only positioned part', part.size); valid = false; }
    }
  }
  return valid;
}

export default function RotationInput({ config, state, actions, onPreferredWidth }) {
  const value = state.document?.rotation;
  const [draft, setDraft] = useState(String(value ?? ''));
  const editing = useRef(false);
  const applied = useRef(value);
  const context = useMemo(() => document.createElement('canvas').getContext('2d'), []);
  // UI — measure with the actual configured fonts; only presentation width is reported.
  const textWidth = (part, text) => {
    context.font = `${part.typography.weight} ${part.geometry.fontSize}px ${part.typography.family}`;
    return context.measureText(text).width;
  };
  const sizing = config.textSizing;
  const numberWidth = sizing ? Math.ceil(Math.max(
    textWidth(config.parts.input, '0'.repeat(sizing.minDigits)),
    textWidth(config.parts.input, draft.slice(0, sizing.maxCharacters)),
  )) : 0;
  const unitWidth = sizing ? Math.ceil(textWidth(config.parts.degree, config.unit)) : 0;
  const ch = sizing ? textWidth(config.parts.input, '0') : 0;
  const padding = sizing ? Math.ceil(sizing.paddingCh * ch) : 0;
  const gap = sizing ? Math.ceil(sizing.gapCh * ch) : 0;
  const preferredWidth = sizing ? numberWidth + unitWidth + 2 * padding + gap + 2 * config.geometry.borderWidth : null;
  useLayoutEffect(() => { onPreferredWidth?.(preferredWidth); }, [onPreferredWidth, preferredWidth]);
  const disabled = !state.photo || state.busy || !actions.updateRotation;
  useEffect(() => {
    if (!editing.current || value !== applied.current || disabled) {
      editing.current = false;
      applied.current = value;
      setDraft(String(value ?? ''));
    }
  }, [value, state.photo?.photoId, disabled]);
  useEffect(() => () => actions.finishRotation(), [actions]);
  const change = (event) => {
    const text = event.target.value;
    editing.current = true;
    setDraft(text);
    const number = parseRotationDraft(text);
    if (Number.isFinite(number)) applied.current = actions.updateRotation(number);
  };
  const finish = () => {
    editing.current = false;
    applied.current = actions.finishRotation();
    setDraft(String(applied.current ?? ''));
  };
  const keyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finish(); }
    if (event.key === 'Escape') {
      event.preventDefault(); editing.current = false;
      applied.current = actions.cancelRotation(); setDraft(String(applied.current ?? ''));
    }
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); editing.current = true;
      applied.current = actions.stepRotation(event.key === 'ArrowUp' ? 1 : -1);
      setDraft(String(applied.current));
    }
  };
  const invalid = !disabled && !Number.isFinite(parseRotationDraft(draft));
  const input = config.parts.input;
  // UI — size-only text parts center in the same parent; fixed mode retains explicit bounds.
  const partBounds = (part, left, width) => sizing
    ? { position: 'absolute', left: `${left}px`, top: `${(100 - part.size.height) / 2}%`, width: `${width}px`, height: `${part.size.height}%` }
    : boundsStyle(part.bounds);
  // UI — the field and degree symbol are explicit immediate-parent parts.
  return <Box id={config.id} aria-disabled={disabled} sx={{ ...fill, ...configuredSx(config), position: 'relative', containerType: 'size' }}>
    <InputBase value={draft} disabled={disabled} error={invalid} onChange={change} onBlur={finish} onKeyDown={keyDown}
      sx={{ ...partBounds(input, padding, numberWidth), '&.Mui-focused': configuredAppearance(input, 'focusVisible'), ...configuredSx(input) }}
      slotProps={{ input: { 'aria-label': config.label, 'aria-invalid': invalid, inputMode: 'decimal', autoComplete: 'off',
        className: 'configured-native-input', 'data-part': 'input' } }} />
    <Box component="span" aria-hidden="true" aria-disabled={disabled} data-part="degree" sx={{ ...partBounds(config.parts.degree, padding + numberWidth + gap, unitWidth), ...configuredSx(config.parts.degree) }}>{config.unit}</Box>
  </Box>;
}
