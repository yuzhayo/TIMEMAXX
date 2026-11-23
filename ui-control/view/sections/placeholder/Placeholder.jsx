import SectionCard from '@ui/SectionCard.jsx';

export const componentId = 'input.placeholder';

// Baked named parts: header is the always-visible expand/collapse toggle;
// body is the mount point where individual components are attached later.
export const partKeys = ['header', 'body'];
export const partConfigKeys = {};

// UI — thin registration: the shared card owns rendering, this section owns
// its expansion state and command wiring.
export default function Placeholder({ config, state, actions }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)} />
  );
}
