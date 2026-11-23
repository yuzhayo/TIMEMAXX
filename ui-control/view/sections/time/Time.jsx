import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import ConfiguredPopover, { validatePopoverConfig } from '@ui/ConfiguredPopover.jsx';
import ConfiguredSelect from '@ui/ConfiguredSelect.jsx';
import { copyText } from '@ui/clipboard.mjs';
import { configuredSx, part } from '@ui/appearance.mjs';
import {
  DEFAULT_HOUR_FORMAT, HOUR_FORMATS, RANGE_END, RANGE_START, formatTime, generateTime,
  isValidHourFormat, parseTime, renderTime, typeTimeDigits,
} from '@input/logic/TimeValue.mjs';

export const componentId = 'input.time';

// Baked named parts: the shared card, the shared dropdown, the editable value
// boxes and the one popup surface with its own columns.
export const partKeys = ['header', 'body', 'select', 'row', 'value', 'from', 'to',
  'generate', 'picker', 'pickerHead', 'pickerColumns', 'pickerColumn', 'pickerOption'];
export const partConfigKeys = { picker: ['portal'] };

// The hour format is a selection, so it is persisted per section instance.
export const stateKeys = ['hourFormat'];

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const pad = (value) => String(value).padStart(2, '0');

// LOGIC — the shared popup owns placement/dismissal; this picker owns the two
// scroll columns and writes one HH:MM value back to its owner on every choice.
function PickerContent({ config, value, onPick }) {
  const hours = useRef(null);
  const minutes = useRef(null);
  const parsed = parseTime(value) ?? { hour: 0, minute: 0 };
  const option = () => ({
    ...configuredSx(part(config, 'pickerOption')), width: '100%', flexShrink: 0,
    cursor: 'pointer',
  });
  // UI — no visible scrollbar: the picker is a short, focused list. Wheel
  // input is handled explicitly so scrolling never depends on a native bar.
  const columns = { ...configuredSx(part(config, 'pickerColumn')), flex: '1 1 0', minWidth: 0,
    overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } };
  const wheel = (event) => { event.currentTarget.scrollTop += event.deltaY; };

  // UI — opening the popup centers the current hour/minute, so a picked value is
  // visible without hunting through 60 rows.
  useEffect(() => {
    const center = (container, index) => {
      const item = container?.children?.[index];
      if (item) container.scrollTop = item.offsetTop - (container.clientHeight - item.offsetHeight) / 2;
    };
    center(hours.current, parsed.hour);
    center(minutes.current, parsed.minute);
  }, []);

  return <>
    <Box data-picker-labels sx={{ ...configuredSx(part(config, 'pickerHead')), width: '100%', flexShrink: 0 }}>
      <Box component="span" sx={{ flex: '1 1 0', minWidth: 0 }}>Hour</Box>
      <Box component="span" sx={{ flex: '1 1 0', minWidth: 0 }}>Minute</Box>
    </Box>
    <Box sx={{ ...configuredSx(part(config, 'pickerColumns')), width: '100%', flex: '1 1 auto', minHeight: 0 }}>
      <Box ref={hours} data-picker-hour sx={columns} onWheel={wheel}>
        {HOURS.map((hour) => <Box component="button" type="button" key={hour} data-time-option={`hour-${pad(hour)}`}
          aria-label={`Hour ${pad(hour)}`} aria-pressed={hour === parsed.hour}
          className={hour === parsed.hour ? 'Mui-selected' : undefined}
          onClick={() => onPick(formatTime(hour, parsed.minute))} sx={option()}>{pad(hour)}</Box>)}
      </Box>
      <Box ref={minutes} data-picker-minute sx={columns} onWheel={wheel}>
        {MINUTES.map((minute) => <Box component="button" type="button" key={minute} data-time-option={`minute-${pad(minute)}`}
          aria-label={`Minute ${pad(minute)}`} aria-pressed={minute === parsed.minute}
          className={minute === parsed.minute ? 'Mui-selected' : undefined}
          onClick={() => onPick(formatTime(parsed.hour, minute))} sx={option()}>{pad(minute)}</Box>)}
      </Box>
    </Box>
  </>;
}

// UI — one editable value box. Four typed digits normalize to HH:MM; a single
// click opens this box's own picker, and double-click copies the displayed text.
function TimeValueBox({ config, attribute, partName, value, format, onPick, copy, copied, pickerId, label }) {
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const cancel = () => clearTimeout(timer.current);
  const click = () => { cancel(); timer.current = setTimeout(() => setOpen(true), 220); };
  const change = (event) => {
    cancel();
    const result = typeTimeDigits(event.target.value);
    if (result.value !== null) { setDraft(null); onPick(result.value); }
    else setDraft(result.draft);
  };
  // The main box sits in the body column; the range boxes share a row.
  const growing = attribute !== 'main';
  const input = <Box component="input" type="text" value={draft === null ? renderTime(value, format) : draft}
    onChange={change} onClick={click} onBlur={() => { cancel(); setDraft(null); }}
    onDoubleClick={(event) => { cancel(); copy(attribute, value, event.currentTarget); }}
    data-time-value={attribute} aria-label={label} title="Type HHMM · click for picker · double-click to copy"
    className={copied ? 'Mui-selected' : undefined}
    sx={{ ...configuredSx(part(config, partName)), width: '100%', minWidth: 0 }} />;
  return (
    <Box sx={{ ...configuredSx(part(config, 'row')), width: growing ? undefined : '100%',
      flex: growing ? '1 1 0' : '0 0 auto', minWidth: 0 }}>
      <ConfiguredPopover id={pickerId} config={part(config, 'picker')} open={open}
        onClose={() => { cancel(); setOpen(false); }} trigger={input}
        triggerStyle={{ flex: '1 1 auto', width: 'auto', minWidth: 0 }}>
        <PickerContent config={config} value={value} onPick={onPick} />
      </ConfiguredPopover>
    </Box>
  );
}

// UI — the shared card owns rendering; this section owns the generated time,
// the range bounds, the hour format and one picker per value box.
export default function Time({ config, state, actions }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  const format = isValidHourFormat(state.hourFormat) ? state.hourFormat : DEFAULT_HOUR_FORMAT;
  const [time, setTime] = useState(() => generateTime(RANGE_START, RANGE_END) ?? RANGE_START);
  const [from, setFrom] = useState(RANGE_START);
  const [to, setTo] = useState(RANGE_END);
  const [copiedBox, setCopiedBox] = useState(null);
  const flash = useRef(null);
  useEffect(() => () => clearTimeout(flash.current), []);
  const copy = async (key, value, element) => {
    await copyText(renderTime(value, format), element);
    setCopiedBox(key);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setCopiedBox(null), 1100);
  };
  const generate = () => setTime(generateTime(from, to) ?? time);
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)}>
      <ConfiguredSelect config={config} label={config.label} value={format} onChange={actions.setHourFormat}
        data-hour-format-select
        options={HOUR_FORMATS.map((hourFormat) => ({ value: hourFormat, label: `${hourFormat} hour` }))} />
      <TimeValueBox config={config} attribute="main" partName="value" value={time} format={format}
        onPick={setTime} copy={copy} copied={copiedBox === 'main'} pickerId={`${config.id}-value`} label="Time value" />
      <Box sx={{ ...configuredSx(part(config, 'range')), width: '100%', minWidth: 0 }}>
        <TimeValueBox config={config} attribute="from" partName="from" value={from} format={format}
          onPick={setFrom} copy={copy} copied={copiedBox === 'from'} pickerId={`${config.id}-from`} label="Range start" />
        <TimeValueBox config={config} attribute="to" partName="to" value={to} format={format}
          onPick={setTo} copy={copy} copied={copiedBox === 'to'} pickerId={`${config.id}-to`} label="Range end" />
      </Box>
      <Box component="button" type="button" data-time-generate onClick={generate}
        sx={{ ...configuredSx(part(config, 'generate')), width: '100%', flexShrink: 0, cursor: 'pointer' }}>
        Generate
      </Box>
    </SectionCard>
  );
}

// LOGIC — section-local options: every baked part must exist and the one popup
// must satisfy the shared placement contract before this section can mount.
export function validateConfig(config, report) {
  let valid = true;
  for (const name of partKeys) if (!config.parts?.[name]) {
    report(`parts.${name}`, 'configured part', config.parts?.[name]); valid = false;
  }
  if (config.parts?.picker && !validatePopoverConfig(config.parts.picker,
    (property, expected, actual) => report(`parts.picker.${property}`, expected, actual))) valid = false;
  for (const name of ['body', 'row', 'range']) {
    const expected = name === 'body' ? 'column' : 'row';
    if (config.parts?.[name]?.content?.direction !== expected) {
      report(`parts.${name}.content.direction`, expected, config.parts?.[name]?.content?.direction); valid = false;
    }
  }
  return valid;
}
