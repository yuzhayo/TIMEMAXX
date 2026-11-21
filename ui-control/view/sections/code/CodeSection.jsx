import React from 'react';
import SectionCard from '@ui/SectionCard.jsx';
export { validateSectionCard as validateConfig } from '@ui/SectionCardConfig.mjs';
export const componentId = 'input.code';

// UI — approved card foundation only; code controls/operations are not implemented yet.
export default function CodeSection({ config, state, actions }) {
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded} />;
}
