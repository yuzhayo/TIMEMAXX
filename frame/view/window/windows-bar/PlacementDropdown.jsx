import React from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { configuredSx, fill } from '@ui/appearance.mjs';

export const componentId = 'photo.placement';
export const requires = ['output'];
export const configKeys = ['options'];
export const partKeys = ['menu'];

// LOGIC — validate the three commands; placement math remains in PhotoOperations.
export function validateConfig(config, report) {
  if (!Array.isArray(config.options)) { report('options', 'Fit/Fill/Center option array', config.options); return false; }
  let valid = true;
  const expected = ['fit', 'fill', 'center'];
  const values = [];
  for (const [index, option] of config.options.entries()) {
    const path = `options[${index}]`;
    if (!option || typeof option !== 'object' || Array.isArray(option)) { report(path, 'placement option object', option); valid = false; continue; }
    for (const key of Object.keys(option)) if (!['id', 'value', 'label'].includes(key)) { report(`${path}.${key}`, 'id | value | label', option[key]); valid = false; }
    if (typeof option.id !== 'string' || !/^[A-Za-z][\w.-]*$/.test(option.id)) { report(`${path}.id`, 'stable option ID', option.id); valid = false; }
    if (!expected.includes(option.value)) { report(`${path}.value`, expected.join(' | '), option.value); valid = false; }
    if (typeof option.label !== 'string' || !option.label.trim()) { report(`${path}.label`, 'nonempty option label', option.label); valid = false; }
    values.push(option.value);
  }
  if (config.options.length !== expected.length || new Set(values).size !== expected.length || expected.some((value) => !values.includes(value))) {
    report('options', 'exactly one Fit, Fill and Center command', config.options); valid = false;
  }
  return valid;
}

export default function PlacementDropdown({ config, state, actions }) {
  const menu = config.parts.menu;
  const disabled = !state.photo || state.busy || typeof actions.placePhoto !== 'function';

  // UI — one configured action selector; it does not retain a fake placement mode.
  return <Select id={config.id} value="" displayEmpty renderValue={() => config.label}
    inputProps={{ 'aria-label': config.label }} disabled={disabled} onChange={(event) => actions.placePhoto(event.target.value)}
    variant="standard" disableUnderline MenuProps={{ slotProps: {
      paper: { sx: { ...configuredSx(menu), display: 'block', padding: 0 } },
      list: { disablePadding: true },
    } }}
    sx={{ ...fill, ...configuredSx(config),
      '& .MuiSelect-select': { ...fill, padding: '0 !important', display: 'flex', alignItems: config.content.verticalAlign,
        justifyContent: config.content.horizontalAlign, textAlign: config.content.textAlign },
      '& .MuiSelect-icon': { color: 'inherit', width: `${config.geometry.iconWidth}%`, height: `${config.geometry.iconHeight}%`,
        top: `${(100 - config.geometry.iconHeight) / 2}%`, right: `${config.geometry.paddingX}%` },
    }}>
    {config.options.map((option) => <MenuItem key={option.id} id={option.id} value={option.value}
      sx={{ ...configuredSx(menu), width: '100%', minHeight: 'auto', padding: `${menu.surfacePadding} !important` }}>{option.label}</MenuItem>)}
  </Select>;
}
