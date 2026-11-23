// LOGIC — one time owner: parsing, display formatting and the reference range
// draw. Times are stored in 24-hour HH:MM and rendered for the chosen hour
// format. The separator is always a colon; a locale's dotted time mark never
// reaches this UI.
export const HOUR_FORMATS = ['24', '12'];
export const DEFAULT_HOUR_FORMAT = '24';
export const RANGE_START = '08:00';
export const RANGE_END = '17:00';

const pad = (value) => String(value).padStart(2, '0');
const word = () => {
  if (globalThis.crypto?.getRandomValues) {
    const buffer = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buffer);
    return buffer[0];
  }
  return Math.floor(Math.random() * 2 ** 32);
};

export function isValidHourFormat(value) {
  return HOUR_FORMATS.includes(value);
}

export function parseTime(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export function isValidTime(value) {
  return parseTime(value) !== null;
}

export function formatTime(hour, minute) {
  return `${pad(hour)}:${pad(minute)}`;
}

export function toMinutes(value) {
  const parsed = parseTime(value);
  return parsed ? parsed.hour * 60 + parsed.minute : null;
}

export function fromMinutes(minutes) {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 1439) return null;
  return formatTime(Math.floor(minutes / 60), minutes % 60);
}

// UI — display only: the stored value stays 24-hour HH:MM. The 12-hour form
// keeps the zero-padded hour and the AM/PM mark of the reference app.
export function renderTime(value, format = DEFAULT_HOUR_FORMAT) {
  const parsed = parseTime(value);
  if (!parsed) return '--:--';
  if (format === '12') {
    const suffix = parsed.hour < 12 ? 'AM' : 'PM';
    const hour = parsed.hour % 12 === 0 ? 12 : parsed.hour % 12;
    return `${pad(hour)}:${pad(parsed.minute)} ${suffix}`;
  }
  return formatTime(parsed.hour, parsed.minute);
}

// LOGIC — a reversed range is a valid range, not an error: the bounds are
// normalized. The draw is inclusive like the reference GenerateTime.
export function normalizeRange(from, to) {
  const start = toMinutes(from), end = toMinutes(to);
  if (start === null || end === null) return null;
  return start <= end ? { start, end } : { start: end, end: start };
}

export function generateTime(from, to, draw = word) {
  const range = normalizeRange(from, to);
  if (!range) return null;
  const span = range.end - range.start + 1;
  const raw = Number(draw());
  const offset = Number.isFinite(raw) ? Math.abs(Math.trunc(raw)) % span : 0;
  return fromMinutes(range.start + offset);
}
