// LOGIC - pure time-range and HH:MM mask rules ported from the WinForms reference.
export const pad = (value) => String(value).padStart(2, '0');

// LOGIC - the colon is a fixed display slot; digits skip it.
export function maskDigits(digits) {
  const slots = [' ', ' ', ':', ' ', ' '];
  for (let index = 0; index < Math.min(4, digits.length); index++) {
    slots[index < 2 ? index : index + 1] = digits[index];
  }
  return slots.join('');
}

export const digitsFromText = (text) => String(text ?? '').replace(/\D/g, '').slice(-4);

export function typeDigit(digits, character) {
  if (!/^\d$/.test(character)) return digits;
  const shifted = digits.length >= 4 ? digits.slice(1) : digits;
  return shifted + character;
}

export const backspaceDigits = (digits) => digits.slice(0, -1);

// LOGIC - a time is accepted only when four valid digits are present.
export function parseDigits(digits) {
  if (!/^\d{4}$/.test(digits)) return null;
  const hour = Number(digits.slice(0, 2));
  const minute = Number(digits.slice(2));
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export const toMinutes = ({ hour, minute }) => hour * 60 + minute;

const randomUint32 = () => {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) throw new Error('Cryptographic random source is unavailable');
  return source.getRandomValues(new Uint32Array(1))[0];
};

// LOGIC - reversed ranges are normalised, matching the reference behaviour.
export function pickTime(from, to, random = randomUint32) {
  let start = toMinutes(from);
  let end = toMinutes(to);
  if (start > end) [start, end] = [end, start];
  const span = end - start + 1;
  const raw = typeof random === 'function' ? Number(random()) : Number(random);
  if (!Number.isInteger(raw) || raw < 0 || raw > 0xffffffff) throw new Error('Random source must return a uint32');
  const picked = start + (raw % span);
  return { hour: Math.floor(picked / 60), minute: picked % 60 };
}

export function renderTime({ hour, minute }, use24 = true) {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error('Invalid time');
  }
  if (use24) return `${pad(hour)}:${pad(minute)}`;
  const suffix = hour < 12 ? 'AM' : 'PM';
  let display = hour % 12;
  if (display === 0) display = 12;
  return `${pad(display)}:${pad(minute)} ${suffix}`;
}
