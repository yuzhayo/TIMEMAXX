import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import ConfiguredPopover, { validatePopoverConfig } from '@ui/ConfiguredPopover.jsx';
import ConfiguredSelect from '@ui/ConfiguredSelect.jsx';
import { copyText } from '@ui/clipboard.mjs';
import { configuredSx, part } from '@ui/appearance.mjs';
import {
  DEFAULT_HOUR_FORMAT, HOUR_FORMATS, RANGE_END, RANGE_START, formatTime, generateTime,
  isValidHourFormat, parseTime, renderTime,
} from '@input/logic/TimeValue.mjs';

export const componentId = 'input.time';

// Baked named parts: the shared card, the shared dropdown, the value rows and
// the one popup surface. The picker columns reuse this section's own parts.
export const partKeys = ['header', 'body', 'select', 'row', 'value', 'timeButton', 'range', 'from', 'to',
  'generate', 'picker', 'pickerHead', 'pickerColumns', 'pickerColumn', 'pickerOption'];
export const partConfigKeys = { picker: ['portal'] };

// The hour format is a selection, so it is persisted per section instance.
export const stateKeys = ['hourFormat'];

const HOURS = Array.from({ length: 24 }, (_, index) => index);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const pad = (value) => String(value).padStart(2, '0');

// LOGIC — the shared popup owns placement/dismissal; this picker owns the two
// scroll columns and writes one HH:MM value back to its owner on every choice.
function TimePicker({ config, id, value, onPick, trigger, triggerStyle }) {
  const [open, setOpen] = useState(false);
  const hours = useRef(null);
  const minutes = useRef(null);
  const parsed = parseTime(value) ?? { hour: 0, minute: 0 };
  const column = part(config, 'pickerColumn');
  const option = () => ({
    ...configuredSx(part(config, 'pickerOption')), width: '100%', flexShrink: 0,
    cursor: 'pointer',
  });
  // UI — no visible scrollbar: the picker is a short, focused list. Wheel
  // input is handled explicitly so scrolling never depends on a native bar.
  const columns = { ...configuredSx(column), flex: '1 1 0', minWidth: 0, overflowY: 'auto',
    scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } };
  const wheel = (event) => { event.currentTarget.scrollTop += event.deltaY; };

  // UI — opening the popup centers the current hour/minute, so a picked value is
  // visible without hunting through 60 rows.
  useEffect(() => {
    if (!open) return;
    const center = (container, index) => {
      const item = container?.children?.[index];
      if (item) container.scrollTop = item.offsetTop - (container.clientHeight - item.offsetHeight) / 2;
    };
    center(hours.current, parsed.hour);
    center(minutes.current, parsed.minute);
  }, [open]);

  return (
    <ConfiguredPopover id={id} config={part(config, 'picker')} open={open} onClose={() => setOpen(false)}
      triggerStyle={triggerStyle}
      trigger={<Box component="span" onClick={() => setOpen((current) => !current)}
        sx={{ display: 'flex', width: '100%', height: '100%', minWidth: 0 }}>{trigger}</Box>}>
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
    </ConfiguredPopover>
  );
}

// UI — the value box shows the chosen format; the stored time stays 24-hour
// HH:MM. Double-click copies exactly what the box shows.
function ValueBox({ config, value, format, copy, copied, attribute, label, title }) {
  return <Box component="input" type="text" readOnly value={renderTime(value, format)} title={title}
    data-time-value={attribute} aria-label={label} className={copied ? 'Mui-selected' : undefined}
    onDoubleClick={copy} sx={{ ...configuredSx(part(config, 'value')), flex: '1 1 auto', minWidth: 0 }} />;
}

// UI — the shared card owns rendering; this section owns the generated time,
// the range bounds, the hour format and the three popup pickers.
export default function Time({ config, state, actions }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  const format = isValidHourFormat(state.hourFormat) ? state.hourFormat : DEFAULT_HOUR_FORMAT;
  const [time, setTime] = useState(() => generateTime(RANGE_START, RANGE_END) ?? RANGE_START);
  const [from, setFrom] = useState(RANGE_START);
  const [to, setTo] = useState(RANGE_END);
  const [copied, setCopied] = useState(false);
  const flash = useRef(null);
  useEffect(() => () => clearTimeout(flash.current), []);
  const copy = async (event) => {
    await copyText(renderTime(time, format), event.currentTarget);
    setCopied(true);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setCopied(false), 1100);
  };
  const generate = () => setTime(generateTime(from, to) ?? time);
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)}>
      <ConfiguredSelect config={config} label={config.label} value={format} onChange={actions.setHourFormat}
        data-hour-format-select
        options={HOUR_FORMATS.map((hourFormat) => ({ value: hourFormat, label: `${hourFormat} hour` }))} />
      <Box sx={{ ...configuredSx(part(config, 'row')), width: '100%', minWidth: 0 }}>
        <ValueBox config={config} value={time} format={format} copy={copy} copied={copied} attribute="main"
          label="Time value" title="Double-click to copy" />
        <TimePicker config={config} id={`${config.id}-value`} value={time} onPick={setTime}
          triggerStyle={{ flexShrink: 0, width: 'auto' }}
          trigger={<Box component="button" type="button" data-time-open
            sx={{ ...configuredSx(part(config, 'timeButton')), height: '100%', cursor: 'pointer' }}>Time</Box>} />
      </Box>
      <Box sx={{ ...configuredSx(part(config, 'range')), width: '100%', minWidth: 0 }}>
        <TimePicker config={config} id={`${config.id}-from`} value={from} onPick={setFrom}
          triggerStyle={{ flex: '1 1 0', width: 'auto', minWidth: 0 }}
          trigger={<Box component="button" type="button" data-time-from title="Choose the range start"
            aria-label="Range start"
            sx={{ ...configuredSx(part(config, 'from')), width: '100%', height: '100%', cursor: 'pointer' }}>
            {renderTime(from, format)}
          </Box>} />
        <TimePicker config={config} id={`${config.id}-to`} value={to} onPick={setTo}
          triggerStyle={{ flex: '1 1 0', width: 'auto', minWidth: 0 }}
          trigger={<Box component="button" type="button" data-time-to title="Choose the range end"
            aria-label="Range end"
            sx={{ ...configuredSx(part(config, 'to')), width: '100%', height: '100%', cursor: 'pointer' }}>
            {renderTime(to, format)}
          </Box>} />
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
