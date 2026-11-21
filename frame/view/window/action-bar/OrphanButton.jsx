import React from 'react';
import ActionButton, { validateActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'layout.orphanEdit';
export const configKeys = ['icon'];
export const validateConfig = validateActionIcon;

export default function OrphanButton({ config, actions }) {
  // LOGIC — translate the existing button into Input's open/close toggle.
  const toggle = () => actions.toggleInputScreen({
    componentId: config.componentId, instanceId: config.id, parentId: config.parentId,
    filePath: config.filePath, configPath: config.configPath,
  });

  // UI — preserve the standalone placement, pencil icon and shared renderer.
  return <ActionButton config={config} disabled={typeof actions.toggleInputScreen !== 'function'} onClick={toggle} />;
}
