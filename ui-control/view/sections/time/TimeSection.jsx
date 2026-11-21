import React from 'react';
import SectionCard from '@ui/SectionCard.jsx';
export { validateSectionCard as validateConfig } from '@ui/SectionCardConfig.mjs';
export const componentId = 'input.time';

// UI — approved card foundation only; time controls/range rules are not implemented yet.
export default function TimeSection({ config, state, actions }) {
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded} />;
}
