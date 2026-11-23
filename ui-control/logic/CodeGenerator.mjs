// LOGIC — 14-character base-24 identifier, ported from the reference generator at
// D:\ARTIFACT\code-generator (CodeGenerator.cs). Pure rules only: no I/O, no DOM,
// and no randomness of its own — callers may inject the random source, so a value
// can be reproduced exactly in a test.
//
// Format rules (unchanged from the reference):
//   1. every code is exactly 14 characters;
//   2. only the 24 symbols below are used;
//   3. the first character never uses the three highest indices (4, 6, 9),
//      which follows from capping the value at 21 * 24^13.
export const ALPHABET = 'ABCDEGHKLMNPRTUWXY123469';
export const LENGTH = 14;

const BASE = 24n;
const LIMIT = 2n ** 64n;

// 21 * 24^13 = 18406255107772514304; anything at or above this is rejected, which
// is exactly why the leading digit can only reach index 20.
export const MAX_ENCODABLE = 18406255107772514304n;

// The three symbols that can never lead: indices 21, 22, 23 of the alphabet.
const UNREACHABLE_FIRST = '469';

// LOGIC — write the value base-24, most significant digit first, padded with the
// first alphabet symbol. Values below MAX_ENCODABLE never overflow 14 digits.
export function encode(value) {
  let remaining = BigInt(value);
  if (remaining < 0n || remaining >= LIMIT) throw new Error('value must be an unsigned 64-bit integer');
  const characters = new Array(LENGTH);
  for (let index = LENGTH - 1; index >= 0; index--) {
    characters[index] = ALPHABET[Number(remaining % BASE)];
    remaining /= BASE;
  }
  if (remaining > 0n) throw new Error(`value does not fit in ${LENGTH} base-24 digits`);
  return characters.join('');
}

// LOGIC — the exact inverse of encode; used to prove round-trips and to inspect a
// code without trusting it.
export function decode(code) {
  if (typeof code !== 'string' || code.length !== LENGTH) throw new Error(`code must be exactly ${LENGTH} characters`);
  let value = 0n;
  for (const character of code) {
    const index = ALPHABET.indexOf(character);
    if (index < 0) throw new Error(`code contains an unsupported symbol: ${character}`);
    value = value * BASE + BigInt(index);
  }
  return value;
}

// LOGIC — all three format rules in one predicate. A stored value that fails this
// is not a code, so the caller regenerates instead of displaying it.
export function isValidCode(code) {
  if (typeof code !== 'string' || code.length !== LENGTH) return false;
  for (const character of code) if (!ALPHABET.includes(character)) return false;
  return !UNREACHABLE_FIRST.includes(code[0]);
}

const cryptoRandomU64 = () => {
  const buffer = new Uint8Array(8);
  globalThis.crypto.getRandomValues(buffer);
  return new DataView(buffer.buffer).getBigUint64(0, true);
};

// LOGIC — draw uniformly over the 64-bit space and reject the top 0.22%, so the
// first-position restriction follows from the draw instead of a separate check.
// Rejection averages 1.002 iterations.
export function newCode(next = cryptoRandomU64) {
  for (;;) {
    const value = BigInt.asUintN(64, BigInt(next()));
    if (value < MAX_ENCODABLE) return encode(value);
  }
}
