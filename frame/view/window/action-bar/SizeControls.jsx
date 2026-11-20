import React, { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import ActionButton, { hasActionIcon } from '@ui/ActionButton.jsx';
import { configuredSx, configuredAppearance, configuredBounds, boundsStyle, fill } from '@ui/appearance.mjs';

export const componentId = 'photo.sizeControls';
export const requires = ['size', 'output'];
export const configKeys = ['labels', 'icons'];
export const partKeys = ['decrease', 'slider', 'value', 'increase', 'control', 'rail', 'track', 'thumb'];

// LOGIC — one feature contract; the generic layout validates common visuals/bounds.
export function validateConfig(config, report) {
  let valid = true;
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, names, path) => {
    if (!object(value)) { report(path, 'configured object', value); return false; }
    for (const name of Object.keys(value)) if (!names.includes(name)) { report(`${path}.${name}`, 'supported property', value[name]); valid = false; }
    return true;
  };
  if (keys(config.labels, ['decrease', 'slider', 'value', 'increase'], 'labels')) {
    for (const name of ['decrease', 'slider', 'value', 'increase']) if (typeof config.labels[name] !== 'string' || !config.labels[name].trim()) { report(`labels.${name}`, 'accessible label', config.labels[name]); valid = false; }
  } else valid = false;
  if (keys(config.icons, ['decrease', 'increase'], 'icons')) {
    for (const name of ['decrease', 'increase']) if (!hasActionIcon(config.icons[name])) { report(`icons.${name}`, 'registered shared action icon', config.icons[name]); valid = false; }
  } else valid = false;
  for (const name of ['control']) {
    const part = config.parts[name];
    if (!part.bounds) { report(`parts.${name}.bounds`, 'explicit parent-relative bounds', undefined); valid = false; }
    if (part.size) { report(`parts.${name}.size`, 'bounds-only positioned part', part.size); valid = false; }
  }
  for (const name of ['decrease', 'value', 'increase', 'slider', 'rail', 'track', 'thumb']) {
    const part = config.parts[name];
    if (!part.size) { report(`parts.${name}.size`, 'explicit parent-relative size', undefined); valid = false; }
    if (part.bounds) { report(`parts.${name}.bounds`, 'size-only text or MUI-managed part', part.bounds); valid = false; }
  }
  for (const name of ['rail', 'track']) if (config.parts[name].size?.width !== 100) {
    report(`parts.${name}.size.width`, '100% of its text allocation or control range', config.parts[name].size?.width); valid = false;
  }
  for (const name of partKeys) if (!['decrease', 'increase'].includes(name) && config.parts[name].aspectRatio !== undefined) {
    report(`parts.${name}.aspectRatio`, 'aspect ratio belongs to the size button parts', config.parts[name].aspectRatio); valid = false;
  }
  if (config.content.direction !== 'row' || config.content.wrap !== 'nowrap') {
    report('content', 'one non-wrapping row for the baked size controls', config.content); valid = false;
  }
  return valid;
}

export default function SizeControls({ config, state, actions }) {
  const { decrease, slider, value, increase, control, rail, track, thumb } = config.parts;
  const settings = state.sizeSettings;
  const percent = state.sizePercent;
  const disabled = !state.photo || state.busy || !actions.updateSize;
  const [display, setDisplay] = useState(percent);
  const editing = useRef(false);
  const applied = useRef(percent);

  // LOGIC — the shared size operation owns the math; this block only shows it.
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

  // UI — configured group/parts; MUI owns rail/track/thumb geometry.
  const id = (name) => `${config.id}-${name}`;
  const buttonConfig = (name, part) => ({ ...part, id: id(name), label: config.labels[name], icon: config.icons[name] });
  const managedPart = (part) => ({ ...configuredSx(part), height: `${part.size.height}cqh` });
  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...configuredSx(config) }}>
    <Box data-size-content="true" sx={{ ...fill, position: 'relative', containerType: 'size',
      display: 'flex', flexDirection: config.content.direction, flexWrap: config.content.wrap,
      alignItems: config.content.verticalAlign, justifyContent: config.content.horizontalAlign, columnGap: `${config.geometry.gap}%`,
    }}>
      <Box data-part="decrease" sx={{
        ...configuredBounds({ ...decrease, bounds: { x: 0, y: 0, width: decrease.size.width, height: decrease.size.height } }),
        position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
      }}>
        <ActionButton config={buttonConfig('decrease', decrease)} disabled={disabled} onClick={() => step(-1)} />
      </Box>
      <Box data-part="slider" sx={{ flexGrow: slider.size.width / 100, flexShrink: 1, flexBasis: 0, minWidth: 0, height: `${slider.size.height}%`, containerType: 'size' }}>
        <Box id={id('slider')} aria-disabled={disabled} sx={{ ...fill, ...configuredSx(slider), position: 'relative', containerType: 'size' }}>
          <Slider aria-label={config.labels.slider} disabled={disabled} value={display ?? settings.min}
            min={settings.min} max={settings.max} step={settings.step}
            onChange={changeSlider} onChangeCommitted={finishSlider} onBlur={sliderKeyUp} onKeyUp={sliderKeyUp}
            sx={{ ...boundsStyle(control.bounds), ...configuredSx(control), containerType: 'size' }}
            slotProps={{
              rail: { 'data-part': 'rail', 'aria-disabled': disabled, sx: { ...managedPart(rail), width: `${rail.size.width}%` } },
              track: { 'data-part': 'track', 'aria-disabled': disabled, sx: { ...managedPart(track), maxWidth: `${track.size.width}%` } },
              thumb: { 'data-part': 'thumb', sx: { ...managedPart(thumb), width: `${thumb.size.width}cqw`, '&::before, &::after': { display: 'none' } } },
            }} />
        </Box>
      </Box>
      <Box data-part="value" sx={{
        ...configuredBounds({ ...value, bounds: { x: 0, y: 0, width: value.size.width, height: value.size.height } }),
        position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
      }}>
        <Box id={id('value')} component="output" aria-label={config.labels.value} aria-disabled={disabled}
          sx={{ ...configuredSx(value), width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {display === null ? '—' : `${display}%`}
        </Box>
      </Box>
      <Box data-part="increase" sx={{
        ...configuredBounds({ ...increase, bounds: { x: 0, y: 0, width: increase.size.width, height: increase.size.height } }),
        position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
      }}>
        <ActionButton config={buttonConfig('increase', increase)} disabled={disabled} onClick={() => step(1)} />
      </Box>
    </Box>
  </Box>;
}
