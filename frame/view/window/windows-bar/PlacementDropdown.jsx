import React from 'react';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import { actionIconOf, hasActionIcon } from '@ui/ActionButton.jsx';
import { boundsStyle, fill } from '@ui/appearance.mjs';
import { inheritedTextSx, configuredHostSx, configuredSlotSx, fontRelativeSx, validateFontSpacing } from '@ui/ConfiguredContent.mjs';

export const componentId = 'photo.placement';
export const requires = ['output'];
export const configKeys = ['options'];
export const partKeys = ['menu', 'list', 'item', 'indicator'];
export const partConfigKeys = { ...Object.fromEntries(['menu', 'list', 'item'].map((name) => [name, ['paddingEm', 'gapEm']])), indicator: ['icon'] };

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
  for (const name of ['menu', 'list', 'item']) {
    const part = config.parts[name];
    if (part.bounds || part.size || part.aspectRatio !== undefined) { report(`parts.${name}`, 'intrinsic font-spaced part without competing bounds/size/aspect ratio', part); valid = false; }
    if (!validateFontSpacing(part, (property, expected, actual) => report(`parts.${name}.${property}`, expected, actual))) valid = false;
    if (name !== 'item') for (const state of ['', ...Object.keys(part.states)]) {
      const content = { ...part.content, ...(state ? part.states[state].content : null) };
      if (content.direction !== 'column' || content.wrap !== 'nowrap') {
        report(`parts.${name}.${state ? `states.${state}.` : ''}content`, 'one non-wrapping menu column', content); valid = false;
      }
    }
  }
  const indicator = config.parts.indicator;
  if (!indicator.bounds || indicator.size || indicator.aspectRatio !== undefined) { report('parts.indicator', 'explicit parent-relative indicator bounds only', indicator); valid = false; }
  if (!hasActionIcon(indicator.icon)) { report('parts.indicator.icon', 'registered shared action icon', indicator.icon); valid = false; }
  return valid;
}

export default function PlacementDropdown({ config, state, actions }) {
  const { menu, list, item, indicator } = config.parts;
  const disabled = !state.photo || state.busy || typeof actions.placePhoto !== 'function';
  const indicatorStyle = (style) => ({ ...style, ...boundsStyle(indicator.bounds), pointerEvents: 'none' });
  const focusSelector = '&:has(:where(.MuiSelect-select):focus-visible)';
  const activate = (event) => {
    const mode = event.target.value;
    try { actions.placePhoto(mode); }
    catch (error) {
      actions.reportUiFailure?.({ code: 'PLACEMENT_ACTION_FAILED', operation: mode, expected: 'successful configured photo placement',
        error, action: 'placement command stopped; current photo transform retained' },
      { componentId: config.componentId, instanceId: config.id, parentId: config.parentId, filePath: config.filePath, configPath: config.configPath });
    }
  };

  // UI — one configured action selector; it does not retain a fake placement mode.
  return <Select id={config.id} value="" displayEmpty renderValue={() => config.label} IconComponent={actionIconOf(indicator.icon)}
    inputProps={{ 'aria-label': config.label }} disabled={disabled} onChange={activate}
    variant="standard" disableUnderline MenuProps={{ slotProps: {
      paper: { 'data-part': 'placement-menu', sx: fontRelativeSx(menu) },
      list: { 'data-part': 'placement-list', disablePadding: true, sx: fontRelativeSx(list) },
    } }}
    sx={{ ...fill, ...configuredHostSx(config, focusSelector), containerType: 'size',
      '&& .MuiSelect-select': { ...fill, ...inheritedTextSx, padding: '0 !important', display: 'flex',
        alignItems: 'inherit', justifyContent: 'inherit', whiteSpace: 'inherit', overflow: 'inherit' },
      ...configuredSlotSx(indicator, '.MuiSelect-icon', indicatorStyle, focusSelector),
    }}>
    {config.options.map((option) => <MenuItem key={option.id} id={option.id} value={option.value}
      disableRipple sx={{ ...fontRelativeSx(item), width: '100%' }}>{option.label}</MenuItem>)}
  </Select>;
}
