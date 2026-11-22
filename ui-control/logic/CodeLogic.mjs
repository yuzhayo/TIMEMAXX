// LOGIC - pure 14-character base-24 code rules ported from the WinForms reference.
// No React, DOM, renderer, Frame or file/Node access lives here.
export const ALPHABET = 'ABCDEGHKLMNPRTUWXY123469';
export const LENGTH = 14;
const BASE = BigInt(ALPHABET.length);
const U64_LIMIT = 1n << 64n;

// 21 * 24^13. Values at or above this cannot produce a valid leading digit.
export const MAX_ENCODABLE = 21n * (BASE ** BigInt(LENGTH - 1));

const asBigInt = (value) => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value)) return BigInt(value);
  throw new Error('Code value must be a safe integer or BigInt');
};

// LOGIC - least significant digit last, zero-filled with the first alphabet symbol.
export function encode(value) {
  let remaining = asBigInt(value);
  if (remaining < 0n || remaining >= U64_LIMIT) throw new Error('Value must be an unsigned 64-bit integer');
  const chars = new Array(LENGTH).fill(ALPHABET[0]);
  for (let index = LENGTH - 1; index >= 0; index--) {
    chars[index] = ALPHABET[Number(remaining % BASE)];
    remaining /= BASE;
  }
  return chars.join('');
}

// LOGIC - exact inverse of encode; rejects malformed codes instead of guessing.
export function decode(code) {
  if (typeof code !== 'string' || code.length !== LENGTH) throw new Error('Code must be exactly 14 characters');
  let value = 0n;
  for (const character of code) {
    const digit = ALPHABET.indexOf(character);
    if (digit < 0) throw new Error('Code contains a symbol outside the 24-character alphabet');
    value = value * BASE + BigInt(digit);
  }
  return value;
}

const randomU64 = () => {
  const source = globalThis.crypto;
  if (!source?.getRandomValues) throw new Error('Cryptographic random source is unavailable');
  const bytes = new Uint8Array(8);
  source.getRandomValues(bytes);
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
};

// LOGIC - rejection sampling keeps the leading digit inside its arithmetic limit.
export function newCode(random = randomU64) {
  for (;;) {
    const value = typeof random === 'function' ? asBigInt(random()) : asBigInt(random);
    if (value < 0n || value >= U64_LIMIT) throw new Error('Random source must return an unsigned 64-bit integer');
    if (value < MAX_ENCODABLE) return encode(value);
  }
}

export const isValidCode = (code) => {
  try { return decode(code) < MAX_ENCODABLE; }
  catch { return false; }
};
