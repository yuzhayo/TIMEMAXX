import SectionCard from '@ui/SectionCard.jsx';
import ConfiguredSelect from '@ui/ConfiguredSelect.jsx';

export const componentId = 'input.language';

// Baked named parts: the shared card header/body plus this section's select.
export const partKeys = ['header', 'body', 'select'];
export const partConfigKeys = {};

// Persisted selections this section owns in state.json: one bucket per instance.
export const stateKeys = ['language'];

// UI — the shared card owns rendering; this section owns the global language
// choice and routes it through the session command.
export default function Language({ config, state, actions, languages }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)}>
      <ConfiguredSelect config={config} label={config.label} value={state.language ?? ''}
        onChange={actions.setLanguage} data-language-select
        options={languages.map((language) => ({ value: language.id, label: language.label }))} />
    </SectionCard>
  );
}
