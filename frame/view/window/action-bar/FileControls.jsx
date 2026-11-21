import React from 'react';
import ActionButton, { hasActionIcon } from '@ui/ActionButton.jsx';
import ConfiguredRow, { validateConfiguredRow } from '@ui/ConfiguredRow.jsx';

export const componentId = 'file.controls';
export const configKeys = ['labels', 'icons', 'order'];
export const partKeys = ['load', 'reset', 'save'];

// LOGIC — one baked file feature owns its parts; file operations retain their shared owner.
export function validateConfig(config, report) {
  let valid = true;
  for (const group of ['labels', 'icons']) {
    const values = config[group];
    if (!values || typeof values !== 'object' || Array.isArray(values)) { report(group, 'load/save/reset options object', values); valid = false; continue; }
    for (const key of Object.keys(values)) if (!partKeys.includes(key)) { report(`${group}.${key}`, 'load | save | reset', values[key]); valid = false; }
    for (const name of partKeys) {
      if (group === 'icons' ? !hasActionIcon(values[name]) : typeof values[name] !== 'string' || !values[name].trim()) {
        report(`${group}.${name}`, group === 'icons' ? 'registered shared action icon' : 'nonempty accessible label', values[name]); valid = false;
      }
    }
  }
  if (!validateConfiguredRow(config, partKeys, report)) valid = false;
  return valid;
}

export default function FileControls({ config, state, actions }) {
  const disabled = (name) => {
    if (state.busy) return true;
    if (name === 'reset') return !state.photo || typeof actions.reset !== 'function';
    return typeof actions[name] !== 'function' || (name === 'save' && !state.document);
  };
  const activate = (name) => actions[name]({
    componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
    filePath: config.filePath, configPath: `${config.configPath}.parts.${name}`,
  });

  // UI — configured group/parts and the same shared icon-only button renderer.
  return <ConfiguredRow config={config} contentName="file" renderPart={(name, part) =>
    <ActionButton config={{ ...part, id: `${config.id}-${name}`, label: config.labels[name], icon: config.icons[name] }}
      disabled={disabled(name)} onClick={() => activate(name)} />} />;
}
