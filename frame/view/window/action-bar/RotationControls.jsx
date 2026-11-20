import React, { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Slider from '@mui/material/Slider';
import ActionButton, { hasActionIcon } from '@ui/ActionButton.jsx';
import ConfiguredPopover from '@ui/ConfiguredPopover.jsx';
import { configuredSx, configuredAppearance, configuredBounds, boundsStyle, fill } from '@ui/appearance.mjs';
import { parseRotationDraft } from '@frame/logic/PhotoOperations.mjs';

export const componentId = 'photo.rotationControls';
export const requires = ['rotation', 'output'];
export const configKeys = ['unit', 'textSizing', 'labels', 'icons'];
export const partKeys = ['left', 'field', 'input', 'degree', 'slider', 'control', 'rail', 'track', 'thumb', 'right', 'popup'];
// LOGIC — one feature contract; the generic layout validates common visuals/bounds.
export function validateConfig(config, report) {
  let valid = true;
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, names, path) => {
    if (!object(value)) { report(path, 'configured object', value); return false; }
    for (const name of Object.keys(value)) if (!names.includes(name)) { report(`${path}.${name}`, 'supported property', value[name]); valid = false; }
    return true;
  };
  if (typeof config.unit !== 'string' || !config.unit.trim()) { report('unit', 'nonempty degree unit', config.unit); valid = false; }
  if (keys(config.labels, ['left', 'input', 'slider', 'right'], 'labels')) {
    for (const name of ['left', 'input', 'slider', 'right']) if (typeof config.labels[name] !== 'string' || !config.labels[name].trim()) { report(`labels.${name}`, 'accessible label', config.labels[name]); valid = false; }
  } else valid = false;
  if (keys(config.icons, ['left', 'right'], 'icons')) {
    for (const name of ['left', 'right']) if (!hasActionIcon(config.icons[name])) { report(`icons.${name}`, 'registered shared action icon', config.icons[name]); valid = false; }
  } else valid = false;
  const sizing = config.textSizing;
  if (keys(sizing, ['minDigits', 'maxCharacters', 'paddingCh', 'gapCh'], 'textSizing')) {
    for (const name of ['minDigits', 'maxCharacters']) if (!Number.isInteger(sizing[name]) || sizing[name] < 1) { report(`textSizing.${name}`, 'positive character count', sizing[name]); valid = false; }
    if (sizing.maxCharacters < sizing.minDigits) { report('textSizing.maxCharacters', 'at least minDigits', sizing.maxCharacters); valid = false; }
    for (const name of ['paddingCh', 'gapCh']) if (!Number.isFinite(sizing[name]) || sizing[name] < 0) { report(`textSizing.${name}`, 'nonnegative input-font character units', sizing[name]); valid = false; }
  } else valid = false;
  for (const name of ['control']) {
    const part = config.parts[name];
    if (!part.bounds) { report(`parts.${name}.bounds`, 'explicit parent-relative bounds', undefined); valid = false; }
    if (part.size) { report(`parts.${name}.size`, 'bounds-only positioned part', part.size); valid = false; }
  }
  for (const name of ['left', 'field', 'input', 'degree', 'slider', 'rail', 'track', 'thumb', 'right', 'popup']) {
    const part = config.parts[name];
    if (!part.size) { report(`parts.${name}.size`, 'explicit parent-relative size', undefined); valid = false; }
    if (part.bounds) { report(`parts.${name}.bounds`, 'size-only text or MUI-managed part', part.bounds); valid = false; }
  }
  for (const name of ['input', 'degree', 'rail', 'track']) if (config.parts[name].size?.width !== 100) {
    report(`parts.${name}.size.width`, '100% of its text allocation or control range', config.parts[name].size?.width); valid = false;
  }
  for (const name of partKeys) if (!['left', 'right'].includes(name) && config.parts[name].aspectRatio !== undefined) {
    report(`parts.${name}.aspectRatio`, 'aspect ratio belongs to the rotation button parts', config.parts[name].aspectRatio); valid = false;
  }
  if (config.content.direction !== 'row' || config.content.wrap !== 'nowrap') {
    report('content', 'one non-wrapping row for the baked rotation controls', config.content); valid = false;
  }
  return valid;
}

export default function RotationControls({ config, state, actions }) {
  const { left, field, input, degree, slider, control, rail, track, thumb, right, popup } = config.parts;
  const settings = state.rotationSettings;
  const value = state.document?.rotation;
  const disabled = !state.photo || state.busy || !actions.updateRotation;
  const [draft, setDraft] = useState(String(value ?? ''));
  const [pointerEditing, setPointerEditing] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const editing = useRef(false);
  const applied = useRef(value);
  const gesture = useRef({ pointer: false, canceled: false });

  // LOGIC — local text/gesture interaction; shared operations/history retain the math.
  useEffect(() => {
    if (pointerEditing && !disabled) return;
    if (disabled && pointerEditing) setPointerEditing(false);
    if (!editing.current || value !== applied.current || disabled) {
      editing.current = false; applied.current = value; setDraft(String(value ?? ''));
    }
  }, [value, state.photo?.photoId, disabled, pointerEditing]);
  useEffect(() => {
    const blur = () => {
      applied.current = actions.finishRotation(); editing.current = false;
      gesture.current = { pointer: false, canceled: true }; setPointerEditing(false);
      setDraft(String(applied.current ?? ''));
    };
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('blur', blur); actions.finishRotation(); };
  }, [actions]);
  const changeInput = (event) => {
    editing.current = true; setDraft(event.target.value);
    const number = parseRotationDraft(event.target.value);
    if (Number.isFinite(number)) applied.current = actions.updateRotation(number);
  };
  const finishInput = () => {
    editing.current = false; applied.current = actions.finishRotation();
    if (!gesture.current.pointer) setDraft(String(applied.current ?? ''));
  };
  const inputKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finishInput(); }
    if (event.key === 'Escape') {
      event.preventDefault(); editing.current = false;
      applied.current = actions.cancelRotation(); setDraft(String(applied.current ?? ''));
    }
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault(); editing.current = true;
      applied.current = actions.stepRotation(event.key === 'ArrowUp' ? 1 : -1); setDraft(String(applied.current));
    }
  };
  const changeSlider = (event, next) => {
    if (event.type === 'keydown' && !gesture.current.pointer) gesture.current.canceled = false;
    if (!gesture.current.canceled) actions.updateRotation(next);
  };
  const finishSlider = (event) => {
    if (event.type === 'keydown') return;
    gesture.current = { pointer: false, canceled: false }; setPointerEditing(false); finishInput();
    setPopupOpen(false);
  };
  const sliderKeyUp = () => { if (!gesture.current.pointer) actions.finishRotation(); };
  const pointerDown = (event) => {
    if (event.button !== 0 || disabled) return;
    actions.finishRotation(); gesture.current = { pointer: true, canceled: false };
    setPointerEditing(true);
    // LOGIC — a canceled drag ignores the rest of that gesture only; the next gesture starts clean.
    window.addEventListener('pointerup', () => { gesture.current = { pointer: false, canceled: false }; }, { once: true });
  };
  const cancelSlider = () => {
    gesture.current.canceled = true; setPointerEditing(false); setPopupOpen(false);
    applied.current = actions.cancelRotation(); editing.current = false; setDraft(String(applied.current ?? ''));
  };
  const sliderKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); cancelSlider(); } };
  // LOGIC — the popup closes on commit, cancellation or an outside press.
  const closePopup = () => { setPopupOpen(false); };
  const togglePopup = () => { if (disabled) return; setPopupOpen((open) => !open); };

  // UI — size to current text; the displayed value is held only during pointer dragging.
  const context = useMemo(() => document.createElement('canvas').getContext('2d'), []);
  const textWidth = (part, text) => {
    context.font = `${part.typography.weight} ${part.geometry.fontSize}px ${part.typography.family}`;
    return context.measureText(text).width;
  };
  const sizing = config.textSizing;
  const numberWidth = Math.ceil(Math.max(textWidth(input, '0'.repeat(sizing.minDigits)), textWidth(input, draft.slice(0, sizing.maxCharacters))));
  const unitWidth = Math.ceil(textWidth(degree, config.unit));
  const ch = textWidth(input, '0');
  const padding = Math.ceil(sizing.paddingCh * ch), gap = Math.ceil(sizing.gapCh * ch);
  const fieldWidth = numberWidth + unitWidth + 2 * padding + gap + 2 * field.geometry.borderWidth;
  const invalid = !disabled && !Number.isFinite(parseRotationDraft(draft));
  const id = (name) => `${config.id}-${name}`;
  const buttonConfig = (name, part) => ({ ...part, id: id(name), label: config.labels[name], icon: config.icons[name] });
  const textBounds = (part, x, width) => ({ position: 'absolute', left: `${x}px`, top: `${(100 - part.size.height) / 2}%`, width: `${width}px`, height: `${part.size.height}%` });
  const managedPart = (part) => ({ ...configuredSx(part), height: `${part.size.height}px` });
  // UI — the square button parts size against the group's own container, not themselves.
  const slot = (name, part, children) => <Box data-part={name} sx={{
    ...configuredBounds({ ...part, bounds: { x: 0, y: 0, width: part.size.width, height: part.size.height } }),
    position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, flexGrow: 0,
  }}>{children}</Box>;

  // UI — one baked feature; JSON owns the outline, proportional padding and every part.
  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...configuredSx(config) }}>
    <Box data-rotation-content="true" sx={{ ...fill, position: 'relative', containerType: 'size',
      display: 'flex', flexDirection: config.content.direction, flexWrap: config.content.wrap,
      alignItems: config.content.verticalAlign, justifyContent: config.content.horizontalAlign, columnGap: `${config.geometry.gap}%`,
    }}>
      {slot('left', left, <ActionButton config={buttonConfig('left', left)} disabled={disabled} onClick={() => actions.rotateBy(-settings.buttonStep)} />)}
      <Box data-part="field" sx={{ width: `min(${fieldWidth}px, ${field.size.width}cqw)`, height: `${field.size.height}%`,
        flexShrink: 0, containerType: 'size',
      }}>
        <Box id={id('field')} aria-disabled={disabled} sx={{ ...fill, ...configuredSx(field), width: `min(${fieldWidth}px, 100%)`, position: 'relative', containerType: 'size' }}>
          <InputBase value={draft} disabled={disabled} readOnly={pointerEditing} error={invalid} onChange={changeInput} onBlur={finishInput} onKeyDown={inputKeyDown}
            sx={{ ...textBounds(input, padding, numberWidth), '&.Mui-focused': configuredAppearance(input, 'focusVisible'), ...configuredSx(input) }}
            slotProps={{ input: { id: id('input'), 'aria-label': config.labels.input, 'aria-invalid': invalid, inputMode: 'decimal', autoComplete: 'off', className: 'configured-native-input', 'data-part': 'input' } }} />
          <ConfiguredPopover id={id('popup')} config={popup} open={popupOpen} onClose={closePopup}
            trigger={<Box component="span" aria-hidden="true" aria-disabled={disabled} data-part="degree"
              onClick={togglePopup}
              sx={{ ...textBounds(degree, padding + numberWidth + gap, unitWidth), ...configuredSx(degree), cursor: disabled ? 'default' : 'pointer' }}>{config.unit}</Box>}>
            <Box id={id('slider')} aria-disabled={disabled} sx={{ ...configuredSx(slider), position: 'relative', width: '100%', height: `${slider.size.height}px` }}>
              <Slider aria-label={config.labels.slider} disabled={disabled} value={value ?? settings.min}
                min={settings.min} max={settings.max} step={settings.step} shiftStep={settings.step}
                onChange={changeSlider} onChangeCommitted={finishSlider} onBlur={sliderKeyUp} onKeyUp={sliderKeyUp} onKeyDown={sliderKeyDown}
                onPointerDown={pointerDown} onPointerCancel={cancelSlider}
                sx={{ ...configuredSx(control) }}
                slotProps={{
                  rail: { 'data-part': 'rail', 'aria-disabled': disabled, sx: { ...managedPart(rail), width: `${rail.size.width}%` } },
                  track: { 'data-part': 'track', 'aria-disabled': disabled, sx: { ...managedPart(track), maxWidth: `${track.size.width}%` } },
                  thumb: { 'data-part': 'thumb', sx: { ...managedPart(thumb), width: `${thumb.size.width}px`, '&::before, &::after': { display: 'none' } } },
                }} />
            </Box>
          </ConfiguredPopover>
        </Box>
      </Box>
      {slot('right', right, <ActionButton config={buttonConfig('right', right)} disabled={disabled} onClick={() => actions.rotateBy(settings.buttonStep)} />)}
    </Box>
  </Box>;
}
