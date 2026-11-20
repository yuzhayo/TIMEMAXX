import React, { useEffect, useRef, useState } from 'react';
import AdjustmentControls, { adjustmentPartKeys, validateAdjustmentConfig } from '@ui/AdjustmentControls.jsx';
import { parseRotationDraft } from '@frame/logic/PhotoOperations.mjs';

export const componentId = 'photo.rotationControls';
export const requires = ['rotation', 'output'];
export const configKeys = ['unit', 'labels', 'icons'];
export const partKeys = adjustmentPartKeys;

// LOGIC — Rotation adds only its unit rule; the shared sub-parent owns the UI contract.
export function validateConfig(config, report) {
  const common = validateAdjustmentConfig(config, report);
  if (typeof config.unit !== 'string' || !config.unit.trim()) {
    report('unit', 'nonempty degree unit', config.unit); return false;
  }
  return common;
}

export default function RotationControls({ config, state, actions }) {
  const settings = state.rotationSettings;
  const value = state.document?.rotation;
  const disabled = !state.photo || state.busy || !actions.updateRotation;
  const [draft, setDraft] = useState(String(value ?? ''));
  const [pointerEditing, setPointerEditing] = useState(false);
  const editing = useRef(false);
  const applied = useRef(value);
  const gesture = useRef({ pointer: false, canceled: false });

  // LOGIC — Rotation adapts its draft/gesture behavior to the shared adjustment sub-parent.
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
  };
  const sliderKeyUp = () => { if (!gesture.current.pointer) actions.finishRotation(); };
  const pointerDown = (event) => {
    if (event.button !== 0 || disabled) return;
    actions.finishRotation(); gesture.current = { pointer: true, canceled: false };
    setPointerEditing(true);
    window.addEventListener('pointerup', () => { gesture.current = { pointer: false, canceled: false }; }, { once: true });
  };
  const cancelSlider = () => {
    gesture.current.canceled = true; setPointerEditing(false);
    applied.current = actions.cancelRotation(); editing.current = false; setDraft(String(applied.current ?? ''));
  };
  const sliderKeyDown = (event) => { if (event.key === 'Escape') { event.preventDefault(); cancelSlider(); } };

  // UI — Rotation supplies content to the shared proportional sub-parent; its old visual tree is gone.
  return <AdjustmentControls config={config} disabled={disabled} contentName="rotation"
    partNames={{ decrease: 'left', value: 'field', increase: 'right', input: 'input', unit: 'degree' }}
    buttonActions={{ decrease: () => actions.rotateBy(-settings.buttonStep), increase: () => actions.rotateBy(settings.buttonStep) }}
    valueControl={{ editor: { draft, unit: config.unit, invalid: !disabled && !Number.isFinite(parseRotationDraft(draft)),
      readOnly: pointerEditing, inputMode: 'decimal', onChange: changeInput, onBlur: finishInput, onKeyDown: inputKeyDown } }}
    sliderControl={{ value: value ?? settings.min, min: settings.min, max: settings.max, step: settings.step, shiftStep: settings.step,
      onChange: changeSlider, onChangeCommitted: finishSlider, onBlur: sliderKeyUp, onKeyUp: sliderKeyUp,
      onKeyDown: sliderKeyDown, onPointerDown: pointerDown, onPointerCancel: cancelSlider }} />;
}
