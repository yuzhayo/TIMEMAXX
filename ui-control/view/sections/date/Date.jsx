import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import SectionCard from '@ui/SectionCard.jsx';
import ConfiguredPopover, { validatePopoverConfig } from '@ui/ConfiguredPopover.jsx';
import ConfiguredSelect from '@ui/ConfiguredSelect.jsx';
import { copyText } from '@ui/clipboard.mjs';
import { configuredSx, part } from '@ui/appearance.mjs';
import {
  formatDate, isValidDateValue, isValidLabelMode, monthCells, monthName, parseDate,
  shiftMonth, weekdayName,
} from '@input/logic/DateValue.mjs';

export const componentId = 'input.date';

export const partKeys = ['header', 'body', 'value', 'row', 'day', 'month', 'picker', 'pickerNav',
  'pickerNavButton', 'pickerTitle', 'pickerWeekday', 'pickerGrid', 'pickerCell'];
export const partConfigKeys = { picker: ['portal'] };
export const stateKeys = [];

const WEEKDAY_HEADERS = {
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  id: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
};

const today = () => {
  const now = new Date();
  return formatDate({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() });
};

// UI — a full-month calendar grid. Navigation moves the cursor month; picking
// a cell writes one DD/MM/YYYY value back to the section owner.
function Calendar({ config, value, locale, onPick }) {
  const parsed = parseDate(value) ?? parseDate(today());
  const [cursor, setCursor] = useState({ year: parsed.year, month: parsed.month });
  useEffect(() => setCursor({ year: parsed.year, month: parsed.month }), [value]);
  const cells = monthCells(cursor.year, cursor.month);
  const headers = WEEKDAY_HEADERS[locale];
  return <>
    <Box sx={{ ...configuredSx(part(config, 'pickerNav')), width: '100%', flexShrink: 0 }}>
      <Box component="button" type="button" data-date-prev aria-label="Previous month"
        onClick={() => setCursor((current) => {
          const next = parseDate(shiftMonth(formatDate({ day: 1, month: current.month, year: current.year }), -1));
          return { year: next.year, month: next.month };
        })}
        sx={{ ...configuredSx(part(config, 'pickerNavButton')), cursor: 'pointer' }}>‹</Box>
      <Box sx={{ ...configuredSx(part(config, 'pickerTitle')), flex: '1 1 auto', minWidth: 0 }}>
        {`${monthName(cursor.month, locale)} ${cursor.year}`}
      </Box>
      <Box component="button" type="button" data-date-next aria-label="Next month"
        onClick={() => setCursor((current) => {
          const next = parseDate(shiftMonth(formatDate({ day: 1, month: current.month, year: current.year }), 1));
          return { year: next.year, month: next.month };
        })}
        sx={{ ...configuredSx(part(config, 'pickerNavButton')), cursor: 'pointer' }}>›</Box>
    </Box>
    <Box sx={{ ...configuredSx(part(config, 'pickerWeekday')), width: '100%', flexShrink: 0 }}>
      {headers.map((label, index) => <Box component="span" key={index} sx={{ flex: '1 1 0', minWidth: 0 }}>{label}</Box>)}
    </Box>
    <Box data-date-grid sx={{ ...configuredSx(part(config, 'pickerGrid')), width: '100%',
      flex: '1 1 auto', minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
      alignContent: 'start' }}>
      {cells.map((day, index) => day === null
        ? <Box key={`blank-${index}`} aria-hidden="true" />
        : <Box component="button" type="button" key={day} data-date-cell={`${cursor.year}-${cursor.month}-${day}`}
          className={parsed.year === cursor.year && parsed.month === cursor.month && parsed.day === day
            ? 'Mui-selected' : undefined}
          onClick={() => onPick(formatDate({ day, month: cursor.month, year: cursor.year }))}
          sx={{ ...configuredSx(part(config, 'pickerCell')), cursor: 'pointer' }}>{day}</Box>)}
    </Box>
  </>;
}

// UI — one date card: the DD/MM/YYYY box owns its picker and copy command, and
// two dropdowns switch the day/month label between full and short names.
export default function DateSection({ config, state, actions, resources }) {
  const expanded = state.expanded[config.id] ?? Boolean(config.expanded);
  const locale = state.language === 'id' ? 'id' : 'en';
  const stored = resources?.outputs?.date;
  const restored = stored && isValidDateValue(stored.value) ? stored : null;
  const [value, setValue] = useState(() => restored?.value ?? today());
  const [dayMode, setDayMode] = useState(() => isValidLabelMode(restored?.dayMode) ? restored.dayMode : 'long');
  const [monthMode, setMonthMode] = useState(() => isValidLabelMode(restored?.monthMode) ? restored.monthMode : 'long');
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const flash = useRef(null);
  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(flash.current); }, []);
  // LOGIC — every stored change is written as one atomic patch beside the code
  // and time buckets; the file owner never keeps a log.
  useEffect(() => {
    window.inputHost?.code?.save?.({ date: { value, dayMode, monthMode } })?.catch?.(() => undefined);
  }, [value, dayMode, monthMode]);
  const date = parseDate(value);
  const copy = async (event) => {
    clearTimeout(timer.current);
    await copyText(value, event.currentTarget);
    setCopied(true);
    clearTimeout(flash.current);
    flash.current = setTimeout(() => setCopied(false), 1100);
  };
  return (
    <SectionCard config={config} label={config.label} expanded={expanded}
      onToggle={() => actions.setExpanded(config.id, !expanded)}>
      <ConfiguredPopover id={`${config.id}-value`} config={part(config, 'picker')} open={open}
        onClose={() => setOpen(false)}
        triggerStyle={{ flex: '1 1 auto', width: 'auto', minWidth: 0 }}
        trigger={<Box component="input" type="text" readOnly value={value} data-date-value
          aria-label="Date value" title="Click for calendar · double-click to copy"
          className={copied ? 'Mui-selected' : undefined}
          onClick={() => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 220); }}
          onDoubleClick={copy}
          sx={{ ...configuredSx(part(config, 'value')), width: '100%', minWidth: 0 }} />}>
        <Calendar config={config} value={value} locale={locale} onPick={setValue} />
      </ConfiguredPopover>
      <Box sx={{ ...configuredSx(part(config, 'row')), width: '100%', minWidth: 0 }}>
        <ConfiguredSelect config={config} partName="day" label="Day" value={dayMode} onChange={setDayMode}
          data-date-day
          options={[
            { value: 'long', label: weekdayName(date, locale, 'long') },
            { value: 'short', label: weekdayName(date, locale, 'short') },
          ]} />
        <ConfiguredSelect config={config} partName="month" label="Month" value={monthMode} onChange={setMonthMode}
          data-date-month
          options={[
            { value: 'long', label: monthName(date.month, locale, 'long') },
            { value: 'short', label: monthName(date.month, locale, 'short') },
          ]} />
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
  return valid;
}
