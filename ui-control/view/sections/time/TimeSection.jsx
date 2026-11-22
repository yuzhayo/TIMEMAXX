import React, { useState } from 'react';
import Box from '@mui/material/Box';
import InputBase from '@mui/material/InputBase';
import SectionCard from '@ui/SectionCard.jsx';
import { boundsStyle, configuredSx } from '@ui/appearance.mjs';
import { inheritedTextSx } from '@ui/ConfiguredContent.mjs';
import Choice from '../../components/Choice.jsx';
import { maskDigits, typeDigit, backspaceDigits, parseDigits, pickTime, renderTime, pad } from '@input/logic/TimeLogic.mjs';
import { copyText } from '../../util/clipboard.mjs';
import { validateTimeConfig } from './TimeConfig.mjs';

export { pickTime, renderTime } from '@input/logic/TimeLogic.mjs';
export { validateTimeConfig as validateConfig } from './TimeConfig.mjs';
export const componentId = 'input.time';

const digitsOf = (time) => `${pad(time.hour)}${pad(time.minute)}`;

function TimeInput({ part, digits, onChange, onRestore }) {
  const keyDown = (event) => {
    if (/^\d$/.test(event.key)) { event.preventDefault(); onChange(typeDigit(digits, event.key)); }
    else if (event.key === 'Backspace') { event.preventDefault(); onChange(backspaceDigits(digits)); }
    else if (event.key === 'Escape') { event.preventDefault(); onRestore(); event.currentTarget.blur(); }
  };
  const blur = () => { if (!parseDigits(digits)) onRestore(); };

  // UI - fixed HH:MM mask; only the digits come from the owner's state.
  return <InputBase value={maskDigits(digits)} readOnly inputProps={{ 'aria-label': part.label }}
    onKeyDown={keyDown} onBlur={blur}
    sx={{ ...boundsStyle(part.bounds), ...configuredSx(part),
      '& input': { ...inheritedTextSx, textAlign: 'center', colorScheme: 'dark' } }} />;
}

export default function TimeSection({ config, state, actions }) {
  const [from, setFrom] = useState({ hour: 8, minute: 0 });
  const [to, setTo] = useState({ hour: 17, minute: 0 });
  const [fromDigits, setFromDigits] = useState(() => digitsOf({ hour: 8, minute: 0 }));
  const [toDigits, setToDigits] = useState(() => digitsOf({ hour: 17, minute: 0 }));
  const [use24, setUse24] = useState(true);
  const [picked, setPicked] = useState(() => pickTime({ hour: 8, minute: 0 }, { hour: 17, minute: 0 }));
  const [status, setStatus] = useState('');
  const { from: fromPart, to: toPart, generate, copy, h24, h12, result } = config.parts;

  const changeFrom = (digits) => {
    setFromDigits(digits);
    const parsed = parseDigits(digits);
    if (parsed) setFrom(parsed);
  };
  const changeTo = (digits) => {
    setToDigits(digits);
    const parsed = parseDigits(digits);
    if (parsed) setTo(parsed);
  };
  const regenerate = () => { setPicked(pickTime(from, to)); setStatus('Generated'); };
  const copyResult = async () => { setStatus((await copyText(renderTime(picked, use24))) ? 'Copied' : 'Failed'); };

  // UI - every control resolves its placement/visual from configured parts.
  return <SectionCard config={config} expanded={state.expanded[config.id]} onExpandedChange={actions.setExpanded}>
    <Box sx={{ ...boundsStyle(config.parts.fromLabel.bounds), ...configuredSx(config.parts.fromLabel) }}>{config.parts.fromLabel.label}</Box>
    <Box sx={{ ...boundsStyle(config.parts.toLabel.bounds), ...configuredSx(config.parts.toLabel) }}>{config.parts.toLabel.label}</Box>
    <TimeInput part={fromPart} digits={fromDigits} onChange={changeFrom} onRestore={() => setFromDigits(digitsOf(from))} />
    <TimeInput part={toPart} digits={toDigits} onChange={changeTo} onRestore={() => setToDigits(digitsOf(to))} />
    <Choice config={generate} onClick={regenerate} />
    <Choice config={copy} onClick={copyResult} />
    <Choice config={h24} selected={use24} onClick={() => setUse24(true)} />
    <Choice config={h12} selected={!use24} onClick={() => setUse24(false)} />
    <Box data-time-result sx={{ ...boundsStyle(result.bounds), ...configuredSx(result) }}>{renderTime(picked, use24)}</Box>
    <Box data-time-status sx={{ ...boundsStyle(config.parts.status.bounds), ...configuredSx(config.parts.status) }}>{status}</Box>
  </SectionCard>;
}
