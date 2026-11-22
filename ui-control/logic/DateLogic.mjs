// LOGIC - pure date naming/format rules ported from the WinForms reference.
// Plain {year, month, day} objects avoid timezone/Date-object drift in the UI.
export const DAYS = Object.freeze({
  en: Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']),
  id: Object.freeze(['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']),
});

export const MONTHS = Object.freeze({
  en: Object.freeze(['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']),
  id: Object.freeze(['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']),
});

export const FORMATS = Object.freeze(['numeric', 'dayName', 'monthName']);
export const LANGUAGES = Object.freeze(['en', 'id']);

const pad = (value) => String(value).padStart(2, '0');

export function today(now = new Date()) {
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

export const toIso = (date) => `${date.year}-${pad(date.month)}-${pad(date.day)}`;

export function fromIso(text) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text ?? '').trim());
  if (!match) return null;
  const date = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  try { formatDate(date, 'numeric', 'en'); } catch { return null; }
  return date;
}

function weekdayOf(date) {
  const candidate = new Date(date.year, date.month - 1, date.day);
  if (candidate.getFullYear() !== date.year || candidate.getMonth() !== date.month - 1 || candidate.getDate() !== date.day) {
    throw new Error('Date does not exist in the calendar');
  }
  return candidate.getDay();
}

export function formatDate(date, format = 'dayName', language = 'en') {
  if (!date || !Number.isInteger(date.year) || !Number.isInteger(date.month)
    || date.month < 1 || date.month > 12 || !Number.isInteger(date.day) || date.day < 1 || date.day > 31) {
    throw new Error('Invalid date');
  }
  if (!FORMATS.includes(format)) throw new Error('Unsupported date format');
  if (!LANGUAGES.includes(language)) throw new Error('Unsupported date language');

  const weekday = weekdayOf(date);
  const dayName = DAYS[language][weekday];
  const monthName = MONTHS[language][date.month - 1];

  if (format === 'numeric') return `${pad(date.day)}/${pad(date.month)}/${date.year}`;
  if (format === 'dayName') return `${dayName}, ${pad(date.day)} ${monthName} ${date.year}`;
  return `${pad(date.day)} ${monthName} ${date.year}`;
}
