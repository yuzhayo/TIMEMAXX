import React, { useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import SectionCard from '@ui/SectionCard.jsx';
import { boundsStyle, configuredSx } from '@ui/appearance.mjs';
import { inheritedTextSx } from '@ui/ConfiguredContent.mjs';
import Choice from '../../components/Choice.jsx';
import { today, toIso, fromIso, formatDate, FORMATS } from '@input/logic/DateLogic.mjs';
import { copyText } from '../../util/clipboard.mjs';
import { validateDateConfig } from './DateConfig.mjs';

export { today, formatDate, FORMATS } from '@input/logic/DateLogic.mjs';
export { validateDateConfig as validateConfig } from './DateConfig.mjs';
export const componentId = 'input.date';

export default function DateSection({ config, state, actions }) {
  const [date, setDate] = useState(() => today());
  const [format, setFormat] = useState('dayName');
  const [status, setStatus] = useState('');
  const { field, result, copy } = config.parts;
  const formatted = formatDate(date, format, state.language);
  const chooseDate = (event) => { const next = fromIso(event.target.value); if (next) setDate(next); };
  const copyResult = async () => { setStatus((await copyText(formatted)) ? 'Copied' : 'Failed'); };

  // UI - format choices and result are configured parts; no local palette.
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded}>
    <InputBase type="date" value={toIso(date)} onChange={chooseDate}
      inputProps={{ 'aria-label': field.label }}
      sx={{ ...boundsStyle(field.bounds), ...configuredSx(field),
        '& input': { ...inheritedTextSx, colorScheme: 'dark' } }} />
    {FORMATS.map((name) => <Choice key={name} config={config.parts[name]}
      selected={format === name} onClick={() => setFormat(name)} />)}
    <Box data-date-result sx={{ ...boundsStyle(result.bounds), ...configuredSx(result) }}>{formatted}</Box>
    <Choice config={copy} onClick={copyResult} />
    <Box data-date-status sx={{ ...boundsStyle(config.parts.status.bounds), ...configuredSx(config.parts.status) }}>{status}</Box>
  </SectionCard>;
}
