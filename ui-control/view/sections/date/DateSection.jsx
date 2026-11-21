import React from 'react';
import SectionCard from '@ui/SectionCard.jsx';
export { validateSectionCard as validateConfig } from '@ui/SectionCardConfig.mjs';
export const componentId = 'input.date';

// UI — approved card foundation only; date controls/formatting are not implemented yet.
export default function DateSection({ config, state, actions }) {
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded} />;
}
