import React, { useEffect, useRef, useState } from 'react';
import AdjustmentControls, { adjustmentPartKeys, adjustmentPartConfigKeys, validateAdjustmentConfig } from '@ui/AdjustmentControls.jsx';
import { parseRotationDraft } from '@frame/logic/PhotoOperations.mjs';

export const componentId = 'photo.rotationControls';
export const requires = ['rotation', 'output'];
export const configKeys = ['unit', 'labels', 'icons'];
export const partKeys = adjustmentPartKeys;
export const partConfigKeys = adjustmentPartConfigKeys;

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
  const inputEdit = useRef(null);
  const applied = useRef(value);

  // LOGIC — Rotation adapts its draft/gesture behavior to the shared adjustment sub-parent.
  useEffect(() => {
    if (!actions.isPhotoEditActive(inputEdit.current) || value !== applied.current || disabled) {
      inputEdit.current = null; applied.current = value; setDraft(String(value ?? ''));
    }
  }, [value, state.photo?.photoId, disabled, actions]);
  useEffect(() => {
    const blur = () => {
      const edit = inputEdit.current; inputEdit.current = null;
      applied.current = actions.finishRotation(edit);
      setDraft(String(applied.current ?? ''));
    };
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('blur', blur);
      const edit = inputEdit.current; inputEdit.current = null;
      actions.finishRotation(edit);
    };
  }, [actions]);
  const beginInput = () => {
    if (!actions.isPhotoEditActive(inputEdit.current)) inputEdit.current = actions.beginRotation();
    return inputEdit.current;
  };
  const changeInput = (event) => {
    const edit = beginInput(); setDraft(event.target.value);
    const number = parseRotationDraft(event.target.value);
    if (Number.isFinite(number)) applied.current = actions.updateRotation(number, edit);
  };
  const finishInput = () => {
    const edit = inputEdit.current; inputEdit.current = null;
    applied.current = actions.finishRotation(edit);
    setDraft(String(applied.current ?? ''));
  };
  const inputKeyDown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); finishInput(); }
    if (event.key === 'Escape') {
      event.preventDefault();
      const edit = inputEdit.current; inputEdit.current = null;
      applied.current = actions.cancelRotation(edit); setDraft(String(applied.current ?? ''));
    }
    if (['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      applied.current = actions.stepRotation(event.key === 'ArrowUp' ? 1 : -1, beginInput()); setDraft(String(applied.current));
    }
  };
  const acceptSliderValue = (next) => {
    if (actions.isPhotoEditActive(inputEdit.current)) return;
    inputEdit.current = null; applied.current = next; setDraft(String(next ?? ''));
  };

  // UI — Rotation supplies content to the shared proportional sub-parent; its old visual tree is gone.
  return <AdjustmentControls config={config} disabled={disabled} contentName="rotation"
    partNames={{ decrease: 'left', value: 'field', increase: 'right', input: 'input', unit: 'degree' }}
    buttonActions={{ decrease: () => actions.rotateBy(-settings.buttonStep), increase: () => actions.rotateBy(settings.buttonStep) }}
    valueControl={{ editor: { draft, unit: config.unit, invalid: !disabled && !Number.isFinite(parseRotationDraft(draft)),
      inputMode: 'decimal', onChange: changeInput, onBlur: finishInput, onKeyDown: inputKeyDown } }}
    sliderControl={{ value: value ?? settings.min, min: settings.min, max: settings.max, step: settings.step, shiftStep: settings.step,
      begin: actions.beginRotation, update: actions.updateRotation, finish: actions.finishRotation,
      cancel: actions.cancelRotation, onValue: acceptSliderValue, isActive: actions.isPhotoEditActive, subscribe: actions.subscribe }} />;
}
