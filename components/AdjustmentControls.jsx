import React, { useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Slider from '@mui/material/Slider';
import ActionButton, { hasActionIcon } from './ActionButton.jsx';
import ConfiguredPopover from './ConfiguredPopover.jsx';
import { configuredAppearance, configuredBounds, configuredSx, fill } from './appearance.mjs';

export const adjustmentPartKeys = ['decrease', 'value', 'increase', 'slider', 'control', 'rail', 'track', 'thumb', 'popup'];

// LOGIC — validate the reusable adjustment sub-parent once for every feature adapter.
export function validateAdjustmentConfig(config, report) {
  let valid = true;
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, names, path) => {
    if (!object(value)) { report(path, 'configured object', value); return false; }
    for (const name of Object.keys(value)) if (!names.includes(name)) { report(`${path}.${name}`, 'supported property', value[name]); valid = false; }
    return true;
  };
  const labels = ['decrease', 'value', 'slider', 'increase'];
  if (keys(config.labels, labels, 'labels')) {
    for (const name of labels) if (typeof config.labels[name] !== 'string' || !config.labels[name].trim()) {
      report(`labels.${name}`, 'accessible label', config.labels[name]); valid = false;
    }
  } else valid = false;
  if (keys(config.icons, ['decrease', 'increase'], 'icons')) {
    for (const name of ['decrease', 'increase']) if (!hasActionIcon(config.icons[name])) {
      report(`icons.${name}`, 'registered shared action icon', config.icons[name]); valid = false;
    }
  } else valid = false;
  const control = config.parts.control;
  if (!control.bounds) { report('parts.control.bounds', 'explicit parent-relative bounds', undefined); valid = false; }
  if (control.size) { report('parts.control.size', 'bounds-only positioned part', control.size); valid = false; }
  for (const name of adjustmentPartKeys.filter((name) => name !== 'control')) {
    const part = config.parts[name];
    if (!part.size) { report(`parts.${name}.size`, 'explicit parent-relative size', undefined); valid = false; }
    if (part.bounds) { report(`parts.${name}.bounds`, 'size-only adjustment part', part.bounds); valid = false; }
  }
  for (const name of ['rail', 'track']) if (config.parts[name].size?.width !== 100) {
    report(`parts.${name}.size.width`, '100% of its control range', config.parts[name].size?.width); valid = false;
  }
  for (const name of adjustmentPartKeys) if (!['decrease', 'increase'].includes(name) && config.parts[name].aspectRatio !== undefined) {
    report(`parts.${name}.aspectRatio`, 'aspect ratio belongs to the adjustment button parts', config.parts[name].aspectRatio); valid = false;
  }
  if (config.content.direction !== 'row' || config.content.wrap !== 'nowrap') {
    report('content', 'one non-wrapping adjustment row', config.content); valid = false;
  }
  return valid;
}

// UI — one proportional sub-parent for Size and Rotation. Features supply values and commands only.
export default function AdjustmentControls({
  config, disabled, contentName, partNames = {}, buttonActions, valueControl, sliderControl,
}) {
  const { decrease, value, increase, slider, control, rail, track, thumb, popup } = config.parts;
  const [popupOpen, setPopupOpen] = useState(false);
  const name = (role) => partNames[role] ?? role;
  const id = (role) => `${config.id}-${name(role)}`;
  const openPopup = () => { if (!disabled) setPopupOpen(true); };
  const closePopup = () => setPopupOpen(false);
  const managedPart = (part) => ({ ...configuredSx(part), height: `${part.size.height}px` });
  const buttonConfig = (role, part) => ({ ...part, id: id(role), label: config.labels[role], icon: config.icons[role] });
  const slot = (role, part, children) => <Box data-part={name(role)} sx={{
    ...configuredBounds({ ...part, bounds: { x: 0, y: 0, width: part.size.width, height: part.size.height } }),
    position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
  }}>{children}</Box>;
  const contentAttribute = contentName ? { [`data-${contentName}-content`]: 'true' } : {};
  const editor = valueControl.editor;
  const valueTrigger = editor
    ? <Box id={id('value')} aria-disabled={disabled} aria-invalid={editor.invalid} onClick={openPopup} sx={{
        ...fill, ...configuredSx(value), '&:focus-within': configuredAppearance(value, 'focusVisible'),
        cursor: disabled ? 'default' : 'pointer',
      }}>
        <InputBase value={editor.draft} disabled={disabled} readOnly={editor.readOnly} error={editor.invalid}
          onChange={editor.onChange} onBlur={editor.onBlur} onKeyDown={editor.onKeyDown}
          sx={{ height: '100%', minWidth: 0, flex: '1 1 auto', color: 'inherit', font: 'inherit' }}
          slotProps={{ input: { id: id('input'), 'aria-label': config.labels.value, 'aria-invalid': editor.invalid,
            inputMode: editor.inputMode, autoComplete: 'off', className: 'configured-native-input', 'data-part': name('input') } }} />
        <Box component="span" aria-hidden="true" aria-disabled={disabled} data-part={name('unit')}
          sx={{ height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {editor.unit}
        </Box>
      </Box>
    : <Box id={id('value')} component="output" aria-label={config.labels.value} aria-disabled={disabled}
        onClick={openPopup} sx={{ ...fill, ...configuredSx(value), cursor: disabled ? 'default' : 'pointer' }}>
        {valueControl.text}
      </Box>;
  const commitSlider = (event, next) => {
    sliderControl.onChangeCommitted?.(event, next);
    if (event.type !== 'keydown') closePopup();
  };
  const sliderKeyDown = (event) => {
    sliderControl.onKeyDown?.(event);
    if (event.key === 'Escape') closePopup();
  };
  const pointerCancel = (event) => { sliderControl.onPointerCancel?.(event); closePopup(); };

  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...configuredSx(config) }}>
    <Box {...contentAttribute} sx={{ ...fill, position: 'relative', containerType: 'size',
      display: 'flex', flexDirection: config.content.direction, flexWrap: config.content.wrap,
      alignItems: config.content.verticalAlign, justifyContent: config.content.horizontalAlign, columnGap: `${config.geometry.gap}%`,
    }}>
      {slot('decrease', decrease, <ActionButton config={buttonConfig('decrease', decrease)} disabled={disabled} onClick={buttonActions.decrease} />)}
      {slot('value', value, <ConfiguredPopover id={id('popup')} config={popup} open={popupOpen} onClose={closePopup} trigger={valueTrigger}>
        <Box id={id('slider')} aria-disabled={disabled} sx={{ ...configuredSx(slider), position: 'relative', width: '100%', height: `${slider.size.height}px` }}>
          <Slider aria-label={config.labels.slider} disabled={disabled} value={sliderControl.value}
            min={sliderControl.min} max={sliderControl.max} step={sliderControl.step} shiftStep={sliderControl.shiftStep ?? sliderControl.step}
            onChange={sliderControl.onChange} onChangeCommitted={commitSlider}
            onBlur={sliderControl.onBlur} onKeyUp={sliderControl.onKeyUp} onKeyDown={sliderKeyDown}
            onPointerDown={sliderControl.onPointerDown} onPointerCancel={pointerCancel}
            sx={{ ...configuredSx(control) }}
            slotProps={{
              rail: { 'data-part': 'rail', 'aria-disabled': disabled, sx: { ...managedPart(rail), width: `${rail.size.width}%` } },
              track: { 'data-part': 'track', 'aria-disabled': disabled, sx: { ...managedPart(track), maxWidth: `${track.size.width}%` } },
              thumb: { 'data-part': 'thumb', sx: { ...managedPart(thumb), width: `${thumb.size.width}px`, '&::before, &::after': { display: 'none' } } },
            }} />
        </Box>
      </ConfiguredPopover>)}
      {slot('increase', increase, <ActionButton config={buttonConfig('increase', increase)} disabled={disabled} onClick={buttonActions.increase} />)}
    </Box>
  </Box>;
}
