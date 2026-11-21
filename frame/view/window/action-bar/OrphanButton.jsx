import React from 'react';
import ActionButton, { validateActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'layout.orphanEdit';
export const configKeys = ['icon'];
export const validateConfig = validateActionIcon;

// UI — intentionally standalone visual button; no command is attached yet.
export default function OrphanButton({ config }) {
  return <ActionButton config={config} />;
}
