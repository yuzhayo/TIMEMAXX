import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { DateCalendar, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/id';
import SectionCard from '@ui/SectionCard.jsx';
import ConfiguredPopover, { validatePopoverConfig } from '@ui/ConfiguredPopover.jsx';
import ConfiguredSelect from '@ui/ConfiguredSelect.jsx';
import { copyText } from '@ui/clipboard.mjs';
import { configuredSx, part } from '@ui/appearance.mjs';
import {
  formatDate, isValidDateValue, isValidLabelMode, monthName, parseDate, weekdayName,
} from '@input/logic/DateValue.mjs';

export const componentId = 'input.date';

export const partKeys = ['header', 'body', 'value', 'row', 'day', 'month', 'picker', 'pickerNav',
  'pickerNavButton', 'pickerTitle', 'pickerWeekday', 'pickerGrid', 'pickerCell'];
export const partConfigKeys = { picker: ['portal'] };
export const stateKeys = [];

const today = () => {
  const now = new Date();
  return formatDate({ day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear() });
};

// UI — the calendar is MUI's proven DateCalendar, not a hand-built grid. It
// lives in the shared popup; the section only supplies the DD/MM/YYYY value.
function Calendar({ value, locale, onPick }) {
  const parsed = parseDate(value);
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
      <DateCalendar data-date-calendar
        value={dayjs(`${parsed.year}-${parsed.month}-${parsed.day}`)}
        onChange={(next) => { if (next?.isValid()) onPick(next.format('DD/MM/YYYY')); }} />
    </LocalizationProvider>
  );
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
        <Calendar value={value} locale={locale} onPick={setValue} />
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
