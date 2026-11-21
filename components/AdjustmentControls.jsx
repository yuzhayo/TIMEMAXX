import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import Slider from '@mui/material/Slider';
import ActionButton, { hasActionIcon } from './ActionButton.jsx';
import ConfiguredPopover, { validatePopoverConfig } from './ConfiguredPopover.jsx';
import { boundsStyle, configuredBounds, configuredSx, fill } from './appearance.mjs';

export const adjustmentPartKeys = ['decrease', 'value', 'increase', 'slider', 'control', 'rail', 'track', 'thumb', 'popup'];
export const adjustmentPartConfigKeys = { popup: ['portal'] };
const sliderStepKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'];

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
  if (!validatePopoverConfig(config.parts.popup, (property, expected, actual) => report(`parts.popup.${property}`, expected, actual))) valid = false;
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
  const operations = useRef(sliderControl);
  const gesture = useRef(null);
  const pointerListeners = useRef(null);
  const popupGeneration = useRef(0);
  const mounted = useRef(false);
  const availability = useRef({ disabled, open: popupOpen });
  operations.current = sliderControl;
  availability.current = { disabled, open: popupOpen };
  const generation = popupGeneration.current;
  const name = (role) => partNames[role] ?? role;
  const id = (role) => `${config.id}-${name(role)}`;
  const openPopup = () => {
    if (disabled || availability.current.open) return;
    popupGeneration.current += 1;
    setPopupOpen(true);
  };
  const publishValue = (next) => {
    if (next !== undefined) operations.current.onValue?.(next);
    return next;
  };
  // LOGIC — every callback carries the edit it owns; stale callbacks cannot settle a different edit.
  const removePointerListeners = useCallback(() => {
    const listeners = pointerListeners.current;
    pointerListeners.current = null;
    if (!listeners) return;
    window.removeEventListener('pointerup', listeners.up);
    window.removeEventListener('pointercancel', listeners.cancel);
    if (listeners.element?.hasPointerCapture(listeners.id)) listeners.element.releasePointerCapture(listeners.id);
  }, []);
  const settleSlider = useCallback((reason, close = true, notify = true) => {
    const previous = gesture.current;
    gesture.current = null;
    removePointerListeners();
    if (close) {
      availability.current.open = false;
      if (mounted.current) setPopupOpen(false);
    }
    if (!previous) return;
    const active = previous.operations.isActive(previous.edit);
    const cancel = reason === 'escape' || reason === 'pointercancel';
    const next = cancel ? previous.operations.cancel(previous.edit) : previous.operations.finish(previous.edit);
    if (notify && mounted.current && active && next !== undefined) previous.operations.onValue?.(next);
  }, [removePointerListeners]);
  const closePopup = useCallback((reason) => settleSlider(reason), [settleSlider]);
  const beginSlider = (kind, event) => {
    if (!mounted.current || generation !== popupGeneration.current || availability.current.disabled || !availability.current.open) return false;
    const previous = gesture.current;
    if (previous && previous.operations.isActive(previous.edit)) {
      if (kind === 'keyboard' || previous.kind === kind && previous.pointerId === event.pointerId) return true;
      return false;
    }
    settleSlider('superseded', false, false);
    const owner = operations.current;
    const edit = owner.begin();
    if (!edit) return false;
    gesture.current = { kind, edit, operations: owner, pointerId: event?.pointerId };
    if (kind === 'pointer') {
      const pointerId = event.pointerId;
      const up = (next) => { if (next.pointerId === pointerId && gesture.current?.edit === edit) settleSlider('commit'); };
      const cancel = (next) => { if (next.pointerId === pointerId && gesture.current?.edit === edit) settleSlider('pointercancel'); };
      pointerListeners.current = { id: pointerId, element: event.currentTarget, up, cancel };
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
    }
    return true;
  };
  useEffect(() => {
    mounted.current = true;
    const blur = () => settleSlider('blur');
    const unsubscribe = operations.current.subscribe(() => {
      const current = gesture.current;
      if (current && !current.operations.isActive(current.edit)) settleSlider('invalidated');
    });
    window.addEventListener('blur', blur);
    return () => {
      mounted.current = false;
      unsubscribe();
      window.removeEventListener('blur', blur);
      settleSlider('unmount', true, false);
    };
  }, [sliderControl.subscribe, settleSlider]);
  useEffect(() => { if (disabled) settleSlider('disabled'); }, [disabled, settleSlider]);
  // UI — managed rail/track/thumb dimensions query the positioned control's own axes.
  const managedPart = (part) => ({ ...configuredSx(part), height: `${part.size.height}cqh` });
  const buttonConfig = (role, part) => ({ ...part, id: id(role), label: config.labels[role], icon: config.icons[role] });
  const slot = (role, part, children) => <Box data-part={name(role)} sx={{
    ...configuredBounds({ ...part, bounds: { x: 0, y: 0, width: part.size.width, height: part.size.height } }),
    position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
  }}>{children}</Box>;
  const contentAttribute = contentName ? { [`data-${contentName}-content`]: 'true' } : {};
  const editor = valueControl.editor;
  const valueTrigger = <ActionButton config={{ ...value, id: id('value'), label: config.labels.value }}
    disabled={disabled} onClick={openPopup} editable={Boolean(editor)} invalid={editor?.invalid}>
    {editor ? <>
        <InputBase value={editor.draft} disabled={disabled} readOnly={editor.readOnly} error={editor.invalid}
          onChange={editor.onChange} onBlur={editor.onBlur} onKeyDown={editor.onKeyDown} onKeyUp={editor.onKeyUp}
          sx={{ height: '100%', minWidth: 0, flex: '1 1 auto', color: 'inherit', font: 'inherit' }}
          slotProps={{ input: { id: id('input'), 'aria-label': config.labels.value, 'aria-invalid': editor.invalid,
            inputMode: editor.inputMode, autoComplete: 'off', className: 'configured-native-input', 'data-part': name('input') } }} />
        <Box component="span" aria-hidden="true" aria-disabled={disabled} data-part={name('unit')}
          sx={{ height: '100%', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          {editor.unit}
        </Box>
      </> : valueControl.text}
    </ActionButton>;
  const changeSlider = (event, next) => {
    const current = gesture.current;
    if (!mounted.current || generation !== popupGeneration.current || !current) return;
    if (availability.current.disabled || !current.operations.isActive(current.edit)) { settleSlider('invalidated'); return; }
    const applied = current.operations.update(next, current.edit);
    if (gesture.current === current && applied !== undefined) current.operations.onValue?.(applied);
  };
  const commitSlider = () => {
    if (generation === popupGeneration.current && gesture.current?.kind === 'pointer') settleSlider('commit');
  };
  const pointerDown = (event) => {
    if (event.button !== 0 || disabled) return;
    if (!beginSlider('pointer', event)) event.preventDefault();
  };
  const pointerCancel = (event) => {
    if (generation === popupGeneration.current && gesture.current?.kind === 'pointer'
      && event.pointerId === gesture.current.pointerId) settleSlider('pointercancel');
  };
  const sliderKeyDownCapture = (event) => {
    if (generation !== popupGeneration.current) return;
    if (event.key === 'Escape') { event.preventDefault(); settleSlider('escape'); return; }
    if (sliderStepKeys.includes(event.key)
      && !event.defaultPrevented && !event.isComposing) beginSlider('keyboard', event);
  };
  const sliderKeyUp = (event) => {
    if (generation === popupGeneration.current && sliderStepKeys.includes(event.key)
      && gesture.current?.kind === 'keyboard') settleSlider('commit', false);
  };
  const sliderBlur = () => { if (generation === popupGeneration.current) settleSlider('blur'); };
  const activateButton = (action) => {
    settleSlider('commit');
    publishValue(action());
  };

  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...configuredSx(config) }}>
    <Box {...contentAttribute} sx={{ ...fill, position: 'relative', containerType: 'size',
      display: 'flex', flexDirection: config.content.direction, flexWrap: config.content.wrap,
      alignItems: config.content.verticalAlign, justifyContent: config.content.horizontalAlign, columnGap: `${config.geometry.gap}%`,
    }}>
      {slot('decrease', decrease, <ActionButton config={buttonConfig('decrease', decrease)} disabled={disabled} onClick={() => activateButton(buttonActions.decrease)} />)}
      {slot('value', value, <ConfiguredPopover id={id('popup')} config={popup} open={popupOpen} onClose={closePopup} trigger={valueTrigger}>
        <Box id={id('slider')} aria-disabled={disabled} sx={{ ...configuredSx(slider), position: 'relative',
          width: `${slider.size.width}%`, height: `${slider.size.height}%`, containerType: 'size' }}>
          <Slider aria-label={config.labels.slider} disabled={disabled} value={sliderControl.value}
            min={sliderControl.min} max={sliderControl.max} step={sliderControl.step} shiftStep={sliderControl.shiftStep ?? sliderControl.step}
            onChange={changeSlider} onChangeCommitted={commitSlider}
            onBlur={sliderBlur} onKeyUp={sliderKeyUp} onKeyDownCapture={sliderKeyDownCapture}
            onPointerDown={pointerDown} onPointerCancel={pointerCancel}
            sx={{ ...configuredSx(control), ...boundsStyle(control.bounds), boxSizing: 'border-box', containerType: 'size' }}
            slotProps={{
              rail: { 'data-part': 'rail', 'aria-disabled': disabled, sx: { ...managedPart(rail), width: `${rail.size.width}%` } },
              track: { 'data-part': 'track', 'aria-disabled': disabled, sx: { ...managedPart(track), maxWidth: `${track.size.width}%` } },
              thumb: { 'data-part': 'thumb', sx: { ...managedPart(thumb), width: `${thumb.size.width}cqw`, '&::before, &::after': { display: 'none' } } },
            }} />
        </Box>
      </ConfiguredPopover>)}
      {slot('increase', increase, <ActionButton config={buttonConfig('increase', increase)} disabled={disabled} onClick={() => activateButton(buttonActions.increase)} />)}
    </Box>
  </Box>;
}
