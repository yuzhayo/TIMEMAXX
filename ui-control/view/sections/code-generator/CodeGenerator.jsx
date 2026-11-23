import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import { copyText } from '@ui/clipboard.mjs';
import { configuredSx, part } from '@ui/appearance.mjs';
import { isValidCode, newCode } from '@input/logic/CodeGenerator.mjs';

export const componentId = 'input.code-generator';

// Baked named parts: the shared card header/body plus this section's value box and button.
export const partKeys = ['header', 'body', 'value', 'generate'];
export const partConfigKeys = {};

// UI — the shared card owns rendering; this section owns the generated value.
// The value is an output kept in code.json (one dynamic value, never a log of
// old codes), so it declares no stateKeys: nothing here is a selection.
export default function CodeGenerator({ config, state, actions, resources }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  const restored = isValidCode(resources?.outputs?.code) ? resources.outputs.code : null;
  const [code, setCode] = useState(() => restored ?? newCode());
  const [copied, setCopied] = useState(false);
  const flash = useRef(null);
  const save = (value) => window.inputHost?.code?.save?.(value)?.catch?.(() => undefined);
  // A stored code survives reopening; a missing or malformed one is replaced and
  // the replacement becomes the stored value, so the file is never stale.
  useEffect(() => { if (!restored) save(code); }, []);
  useEffect(() => () => clearTimeout(flash.current), []);
  const generate = () => { const next = newCode(); setCode(next); save(next); };
  const copy = async (event) => {
    await copyText(code, event.currentTarget);
    setCopied(true);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setCopied(false), 1100);
  };
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)}>
      <Box component="input" type="text" readOnly data-code-value value={code} title="Double-click to copy"
        onDoubleClick={copy} className={copied ? 'Mui-selected' : undefined} aria-label={config.label}
        sx={{ ...configuredSx(part(config, 'value')), flex: '1 1 auto', minWidth: 0 }} />
      <Box component="button" type="button" data-code-generate onClick={generate}
        sx={{ ...configuredSx(part(config, 'generate')), flexShrink: 0, cursor: 'pointer' }}>
        Generate
      </Box>
    </SectionCard>
  );
}
