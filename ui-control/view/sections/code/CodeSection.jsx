import React, { useState } from 'react';
import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import { boundsStyle, configuredSx } from '@ui/appearance.mjs';
import Choice from '../../components/Choice.jsx';
import { newCode, isValidCode } from '@input/logic/CodeLogic.mjs';
import { copyText } from '../../util/clipboard.mjs';
import { validateCodeConfig } from './CodeConfig.mjs';

export { newCode, isValidCode } from '@input/logic/CodeLogic.mjs';
export { validateCodeConfig as validateConfig } from './CodeConfig.mjs';
export const componentId = 'input.code';

export default function CodeSection({ config, state, actions }) {
  const [code, setCode] = useState(() => newCode());
  const [status, setStatus] = useState('');
  const { field, generate, copy, status: note } = config.parts;

  const regenerate = () => { setCode(newCode()); setStatus('Generated'); };
  const copyCode = async () => { setStatus((await copyText(code)) ? 'Copied' : 'Failed'); };

  // UI - every visual value comes from this instance's configured parts.
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded}>
    <Box data-code-value sx={{ ...boundsStyle(field.bounds), ...configuredSx(field) }}>{code}</Box>
    <Choice config={generate} onClick={regenerate} />
    <Choice config={copy} onClick={copyCode} />
    <Box data-code-status sx={{ ...boundsStyle(note.bounds), ...configuredSx(note) }}>{status}</Box>
  </SectionCard>;
}
