import React from 'react';
import ActionButton, { validateActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'layout.orphanEdit';
export const configKeys = ['icon'];
export const validateConfig = validateActionIcon;

export default function OrphanButton({ config, actions }) {
  // LOGIC — translate the existing button into a launch-only command.
  const open = () => actions.openInputScreen({
    componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
    filePath: config.filePath, configPath: config.configPath,
  });

  // UI — preserve the standalone placement, pencil icon and shared renderer.
  return <ActionButton config={config} disabled={typeof actions.openInputScreen !== 'function'} onClick={open} />;
}
