import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import { configuredSx, part } from '@ui/appearance.mjs';

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
      <Box component="select" data-language-select aria-label={config.label} value={state.language ?? ''}
        onChange={(event) => actions.setLanguage(event.target.value)}
        sx={{ ...configuredSx(part(config, 'select')), width: '100%', minWidth: 0, cursor: 'pointer' }}>
        {languages.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}
      </Box>
    </SectionCard>
  );
}
