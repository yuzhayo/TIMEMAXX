import React from 'react';
import Box from '@mui/material/Box';
import ActionButton, { hasActionIcon } from '@ui/ActionButton.jsx';
import { configuredSx, configuredBounds, fill } from '@ui/appearance.mjs';

export const componentId = 'file.controls';
export const configKeys = ['labels', 'icons'];
export const partKeys = ['load', 'save'];

// LOGIC — one baked file feature owns its parts; file operations retain their shared owner.
export function validateConfig(config, report) {
  let valid = true;
  for (const group of ['labels', 'icons']) {
    const values = config[group];
    if (!values || typeof values !== 'object' || Array.isArray(values)) { report(group, 'load/save options object', values); valid = false; continue; }
    for (const key of Object.keys(values)) if (!partKeys.includes(key)) { report(`${group}.${key}`, 'load | save', values[key]); valid = false; }
    for (const name of partKeys) {
      if (group === 'icons' ? !hasActionIcon(values[name]) : typeof values[name] !== 'string' || !values[name].trim()) {
        report(`${group}.${name}`, group === 'icons' ? 'registered shared action icon' : 'nonempty accessible label', values[name]); valid = false;
      }
    }
  }
  for (const name of partKeys) {
    const part = config.parts[name];
    if (!part.size || part.bounds) { report(`parts.${name}`, 'size-only button allocation in the file row', part); valid = false; }
  }
  if (config.content.direction !== 'row' || config.content.wrap !== 'nowrap') {
    report('content', 'one non-wrapping row for Load/Save', config.content); valid = false;
  }
  if (partKeys.reduce((width, name) => width + (config.parts[name].size?.width ?? 0), config.geometry.gap) > 100) {
    report('parts', 'button widths plus gap contained in the row', config.parts); valid = false;
  }
  return valid;
}

export default function FileControls({ config, state, actions }) {
  const disabled = (name) => state.busy || typeof actions[name] !== 'function' || (name === 'save' && !state.document);
  const activate = (name) => actions[name]({
    componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
    filePath: config.filePath, configPath: `${config.configPath}.parts.${name}`,
  });

  // UI — configured group/parts and the same shared icon-only button renderer.
  return <Box id={config.id} role="group" aria-label={config.label} sx={{ ...fill, ...configuredSx(config) }}>
    <Box data-file-content="true" sx={{ ...fill, position: 'relative', containerType: 'size',
      display: 'flex', flexDirection: config.content.direction, flexWrap: config.content.wrap,
      alignItems: config.content.verticalAlign, justifyContent: config.content.horizontalAlign, columnGap: `${config.geometry.gap}%`,
    }}>
      {partKeys.map((name) => {
        const part = config.parts[name];
        return <Box key={name} data-part={name} sx={{
          ...configuredBounds({ ...part, bounds: { x: 0, y: 0, width: part.size.width, height: part.size.height } }),
          position: 'relative', left: 'auto', top: 'auto', flexShrink: 0, containerType: 'size',
        }}>
          <ActionButton config={{ ...part, id: `${config.id}-${name}`, label: config.labels[name], icon: config.icons[name] }}
            disabled={disabled(name)} onClick={() => activate(name)} />
        </Box>;
      })}
    </Box>
  </Box>;
}
