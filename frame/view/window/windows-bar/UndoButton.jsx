import React from 'react';
import ActionButton, { validateActionIcon } from '@ui/ActionButton.jsx';

export const componentId = 'history.undo';
export const configKeys = ['icon'];
export const validateConfig = validateActionIcon;

// LOGIC — history state/action arrive through the same interface in any section.
export default function UndoButton({ config, state, actions }) {
  const disabled = state.busy || !state.canUndo;
  const undo = () => actions.undo();

  // UI — geometry/colors/states/icon size are resolved from this instance's JSON.
  return <ActionButton config={config} disabled={disabled} onClick={undo} />;
}
