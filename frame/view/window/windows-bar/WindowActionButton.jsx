import React from 'react';
import ActionButton, { hasActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'window.action';
export const configKeys = ['action', 'icon', 'maximizedIcon'];

// LOGIC — native-window behavior has its own registration/options, not a file-action branch.
export function validateConfig(config, report) {
  let valid = true;
  if (!['minimize', 'toggleMaximize', 'toggleVerticalMaximize', 'close'].includes(config.action)) { report('action', 'minimize | toggleMaximize | toggleVerticalMaximize | close', config.action); valid = false; }
  if (!hasActionIcon(config.icon)) { report('icon', 'registered shared action icon', config.icon); valid = false; }
  if (['toggleMaximize', 'toggleVerticalMaximize'].includes(config.action)) {
    if (!hasActionIcon(config.maximizedIcon)) { report('maximizedIcon', 'registered shared restore icon', config.maximizedIcon); valid = false; }
  } else if (config.maximizedIcon !== undefined) { report('maximizedIcon', 'only used by maximize/restore actions', config.maximizedIcon); valid = false; }
  return valid;
}

export default function WindowActionButton({ config, state, actions }) {
  const activate = () => actions.windowAction(config.action, {
    componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
    filePath: config.filePath, configPath: config.configPath,
  });
  const maximized = config.action === 'toggleVerticalMaximize' ? state.windowState?.verticalMaximized
    : config.action === 'toggleMaximize' && state.windowState?.maximized;
  const icon = maximized ? config.maximizedIcon : config.icon;

  // UI — same renderer/preset as Load/Save, including the X instance.
  return <ActionButton config={config} disabled={typeof actions.windowAction !== 'function'}
    icon={icon} onClick={activate} />;
}
