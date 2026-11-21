import React from 'react';
import AdjustmentControls, { adjustmentPartKeys, adjustmentPartConfigKeys, validateAdjustmentConfig } from '@ui/AdjustmentControls.jsx';

export const componentId = 'photo.sizeControls';
export const requires = ['size', 'output'];
export const configKeys = ['labels', 'icons'];
export const partKeys = adjustmentPartKeys;
export const partConfigKeys = adjustmentPartConfigKeys;
export const validateConfig = validateAdjustmentConfig;

export default function SizeControls({ config, state, actions }) {
  const settings = state.sizeSettings;
  const percent = state.sizePercent;
  const disabled = !state.photo || state.busy || !actions.updateSize;

  // UI — Size supplies values and owned operations; shared adjustment mechanics live in one place.
  return <AdjustmentControls config={config} disabled={disabled} contentName="size"
    buttonActions={{ decrease: () => actions.stepSize(-1), increase: () => actions.stepSize(1) }}
    valueControl={{ text: percent === null ? '—' : `${percent}%` }}
    sliderControl={{ value: percent ?? settings.min, min: settings.min, max: settings.max, step: settings.step,
      begin: actions.beginSize, update: (next, edit) => actions.updateSize(next, undefined, edit),
      finish: actions.finishSize, cancel: actions.cancelSize, isActive: actions.isPhotoEditActive, subscribe: actions.subscribe }} />;
}
