import React, { useEffect, useRef, useState } from 'react';
import AdjustmentControls, { adjustmentPartKeys, validateAdjustmentConfig } from '@ui/AdjustmentControls.jsx';

export const componentId = 'photo.sizeControls';
export const requires = ['size', 'output'];
export const configKeys = ['labels', 'icons'];
export const partKeys = adjustmentPartKeys;
export const validateConfig = validateAdjustmentConfig;

export default function SizeControls({ config, state, actions }) {
  const settings = state.sizeSettings;
  const percent = state.sizePercent;
  const disabled = !state.photo || state.busy || !actions.updateSize;
  const [display, setDisplay] = useState(percent);
  const editing = useRef(false);
  const applied = useRef(percent);

  // LOGIC — Size adapts its state and commands to the shared adjustment sub-parent.
  useEffect(() => {
    if (!editing.current || percent !== applied.current) { editing.current = false; applied.current = percent; setDisplay(percent); }
  }, [percent]);
  useEffect(() => {
    const blur = () => { applied.current = actions.finishSize(); editing.current = false; setDisplay(applied.current); };
    window.addEventListener('blur', blur);
    return () => { window.removeEventListener('blur', blur); actions.finishSize(); };
  }, [actions]);
  const changeSlider = (event, next) => {
    editing.current = true;
    applied.current = actions.updateSize(next);
    setDisplay(applied.current);
  };
  const finishSlider = (event) => {
    if (event.type === 'keydown') return;
    editing.current = false; applied.current = actions.finishSize(); setDisplay(applied.current);
  };
  const sliderKeyUp = () => { if (!editing.current) actions.finishSize(); };
  const step = (direction) => {
    actions.finishSize();
    applied.current = actions.stepSize(direction);
    setDisplay(applied.current);
  };

  // UI — Size supplies content to the shared proportional sub-parent; it owns no parallel layout.
  return <AdjustmentControls config={config} disabled={disabled} contentName="size"
    buttonActions={{ decrease: () => step(-1), increase: () => step(1) }}
    valueControl={{ text: display === null ? '—' : `${display}%` }}
    sliderControl={{ value: display ?? settings.min, min: settings.min, max: settings.max, step: settings.step,
      onChange: changeSlider, onChangeCommitted: finishSlider, onBlur: sliderKeyUp, onKeyUp: sliderKeyUp }} />;
}
