// LOGIC — one date owner: the DD/MM/YYYY mask, locale day/month names and the
// full-month calendar. Display language comes from the global session locale;
// the stored value stays a plain DD/MM/YYYY string.
export const DATE_LOCALES = ['en', 'id'];
export const LABEL_MODES = ['long', 'short'];

const WEEKDAYS = {
  en: [{ long: 'Sunday', short: 'Sun' }, { long: 'Monday', short: 'Mon' }, { long: 'Tuesday', short: 'Tue' },
    { long: 'Wednesday', short: 'Wed' }, { long: 'Thursday', short: 'Thu' },
    { long: 'Friday', short: 'Fri' }, { long: 'Saturday', short: 'Sat' }],
  id: [{ long: 'Minggu', short: 'Min' }, { long: 'Senin', short: 'Sen' }, { long: 'Selasa', short: 'Sel' },
    { long: 'Rabu', short: 'Rab' }, { long: 'Kamis', short: 'Kam' },
    { long: 'Jumat', short: 'Jum' }, { long: 'Sabtu', short: 'Sab' }],
};
const MONTHS = {
  en: [{ long: 'January', short: 'Jan' }, { long: 'February', short: 'Feb' }, { long: 'March', short: 'Mar' },
    { long: 'April', short: 'Apr' }, { long: 'May', short: 'May' }, { long: 'June', short: 'Jun' },
    { long: 'July', short: 'Jul' }, { long: 'August', short: 'Aug' }, { long: 'September', short: 'Sep' },
    { long: 'October', short: 'Oct' }, { long: 'November', short: 'Nov' }, { long: 'December', short: 'Dec' }],
  id: [{ long: 'Januari', short: 'Jan' }, { long: 'Februari', short: 'Feb' }, { long: 'Maret', short: 'Mar' },
    { long: 'April', short: 'Apr' }, { long: 'Mei', short: 'Mei' }, { long: 'Juni', short: 'Jun' },
    { long: 'Juli', short: 'Jul' }, { long: 'Agustus', short: 'Agu' }, { long: 'September', short: 'Sep' },
    { long: 'Oktober', short: 'Okt' }, { long: 'November', short: 'Nov' }, { long: 'Desember', short: 'Des' }],
};

const pad = (value) => String(value).padStart(2, '0');

export function isValidLocale(value) {
  return DATE_LOCALES.includes(value);
}

export function isValidLabelMode(value) {
  return LABEL_MODES.includes(value);
}

export function daysInMonth(year, month) {
  if (!Number.isInteger(year) || year < 1 || !Number.isInteger(month) || month < 1 || month > 12) return 0;
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function parseDate(value) {
  if (typeof value !== 'string') return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  return day >= 1 && day <= daysInMonth(year, month) ? { day, month, year } : null;
}

export function isValidDateValue(value) {
  return parseDate(value) !== null;
}

export function formatDate(date) {
  return `${pad(date.day)}/${pad(date.month)}/${String(date.year).padStart(4, '0')}`;
}

export function weekdayIndex(date) {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

export function weekdayName(date, locale = 'en', mode = 'long') {
  const names = WEEKDAYS[isValidLocale(locale) ? locale : 'en'];
  return names[weekdayIndex(date)][isValidLabelMode(mode) ? mode : 'long'];
}

export function monthName(month, locale = 'en', mode = 'long') {
  const names = MONTHS[isValidLocale(locale) ? locale : 'en'];
  return names[month - 1]?.[isValidLabelMode(mode) ? mode : 'long'] ?? '';
}

// LOGIC — a Monday-first grid: the leading blanks line the 1st up with its
// weekday column. Every cell is a real date in the cursor month.
export function monthCells(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lead = (first + 6) % 7;
  const cells = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= daysInMonth(year, month); day++) cells.push(day);
  return cells;
}

export function shiftMonth(date, delta) {
  const parsed = typeof date === 'string' ? parseDate(date) : date;
  if (!parsed) return null;
  const monthIndex = parsed.month - 1 + delta;
  const year = parsed.year + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12 + 1;
  return formatDate({ day: Math.min(parsed.day, daysInMonth(year, month)), month, year });
}
