import React from 'react';
import ActionButton, { validateActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'history.redo';
export const configKeys = ['icon'];
export const validateConfig = validateActionIcon;

// LOGIC — shared history is independent of this control's folder and parent.
export default function RedoButton({ config, state, actions }) {
  const disabled = state.busy || !state.canRedo;
  const redo = () => actions.redo();

  // UI — no parent geometry or appearance is chosen inside this file.
  return <ActionButton config={config} disabled={disabled} onClick={redo} />;
}
