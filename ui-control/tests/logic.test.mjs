import test from 'node:test';
import assert from 'node:assert/strict';
import { ALPHABET, LENGTH, MAX_ENCODABLE, encode, decode, newCode, isValidCode } from '../logic/CodeLogic.mjs';
import { DAYS, MONTHS, today, toIso, fromIso, formatDate, FORMATS } from '../logic/DateLogic.mjs';
import { maskDigits, digitsFromText, typeDigit, backspaceDigits, parseDigits, pickTime, renderTime } from '../logic/TimeLogic.mjs';
import { compactHeightPercent } from '../logic/CompactLayout.mjs';

test('code: encoding is a padded base-24 big-endian value', () => {
  assert.equal(ALPHABET.length, 24);
  assert.equal(LENGTH, 14);
  assert.equal(MAX_ENCODABLE, 18406255107772514304n);
  assert.equal(encode(0), 'AAAAAAAAAAAAAA');
  assert.equal(encode(1), 'AAAAAAAAAAAAAB');
  assert.equal(encode(23), 'AAAAAAAAAAAAA9');
  assert.equal(encode(24), 'AAAAAAAAAAAABA');
  for (const value of [0n, 1n, 23n, 24n, 12345678901234n, MAX_ENCODABLE - 1n]) {
    const code = encode(value);
    assert.equal(code.length, 14);
    assert.equal(decode(code), value);
  }
});

test('code: generation rejects values at the arithmetic limit and keeps valid shape', () => {
  let attempt = 0;
  assert.equal(newCode(() => [MAX_ENCODABLE, 0n][attempt++]), encode(0));
  assert.equal(attempt, 2);
  assert.equal(decode(encode(MAX_ENCODABLE - 1n)), MAX_ENCODABLE - 1n);
  const seen = new Set();
  for (let index = 0; index < 5000; index++) {
    const code = newCode();
    assert.equal(code.length, 14);
    assert.ok([...code].every((character) => ALPHABET.includes(character)));
    assert.ok(!'469'.includes(code[0]));
    assert.ok(decode(code) < MAX_ENCODABLE);
    seen.add(code);
  }
  assert.ok(seen.size > 4900);
  assert.equal(isValidCode(encode(0)), true);
  assert.equal(isValidCode('4AAAAAAAAAAAAA'), false);
  assert.equal(isValidCode('SHORT'), false);
});

test('code: malformed values and codes are rejected, never guessed', () => {
  assert.throws(() => encode(-1));
  assert.throws(() => encode(2n ** 64n));
  assert.throws(() => decode('AAAAAAAAAAAAA!'));
});

test('date: names resolve for every day of a leap year in both locales', () => {
  assert.deepEqual(DAYS.en.length, 7);
  assert.deepEqual(DAYS.id.length, 7);
  assert.equal(MONTHS.en.length, 12);
  assert.equal(MONTHS.id.length, 12);
  for (let month = 1; month <= 12; month++) {
    const days = new Date(2024, month, 0).getDate();
    for (let day = 1; day <= days; day++) {
      assert.ok(DAYS.en[new Date(2024, month - 1, day).getDay()]);
      assert.ok(DAYS.id[new Date(2024, month - 1, day).getDay()]);
      assert.ok(formatDate({ year: 2024, month, day }, 'dayName', 'en'));
      assert.ok(formatDate({ year: 2024, month, day }, 'dayName', 'id'));
    }
  }
});

test('date: the three configured formats match the reference output', () => {
  const date = { year: 2026, month: 3, day: 21 };
  assert.equal(formatDate(date, 'numeric', 'en'), '21/03/2026');
  assert.equal(formatDate(date, 'dayName', 'en'), 'Saturday, 21 March 2026');
  assert.equal(formatDate(date, 'dayName', 'id'), 'Sabtu, 21 Maret 2026');
  assert.equal(formatDate(date, 'monthName', 'en'), '21 March 2026');
  assert.equal(formatDate(date, 'monthName', 'id'), '21 Maret 2026');
  assert.deepEqual(FORMATS, ['numeric', 'dayName', 'monthName']);
});

test('date: ISO helpers round-trip and reject invalid values', () => {
  const date = { year: 2024, month: 2, day: 29 };
  assert.equal(toIso(date), '2024-02-29');
  assert.deepEqual(fromIso('2024-02-29'), date);
  assert.equal(fromIso('2023-02-29'), null);
  assert.equal(fromIso('garbage'), null);
  assert.equal(today(new Date(2026, 0, 2)).day, 2);
  assert.throws(() => formatDate({ year: 2023, month: 2, day: 29 }, 'numeric', 'en'));
});

test('time: the HH:MM mask skips the colon and shifts overflowing digits', () => {
  assert.equal(maskDigits(''), '  :  ');
  assert.equal(maskDigits('1'), '1 :  ');
  assert.equal(maskDigits('13'), '13:  ');
  assert.equal(maskDigits('134'), '13:4 ');
  assert.equal(maskDigits('1345'), '13:45');
  assert.equal(typeDigit('', '1'), '1');
  assert.equal(typeDigit('13', '4'), '134');
  assert.equal(typeDigit('1345', '6'), '3456');
  assert.equal(typeDigit('12', 'x'), '12');
  assert.equal(backspaceDigits('1345'), '134');
  assert.equal(digitsFromText('13:45'), '1345');
  assert.deepEqual(parseDigits('1345'), { hour: 13, minute: 45 });
  assert.equal(parseDigits('2459'), null);
  assert.equal(parseDigits('1260'), null);
  assert.equal(parseDigits('13'), null);
});

test('compact layout: content height is solved from measured slots and a parent percentage', () => {
  const sized = compactHeightPercent({ heights: [80, 40, 20], fractions: [40, 40, 20], headerFraction: 0.1, stackHeight: 1000 });
  assert.equal(sized.toFixed(2), '22.22');
  assert.equal(compactHeightPercent({ heights: [90, 45, 18], fractions: [40, 40, 20], headerFraction: 0.1, stackHeight: 1000 }).toFixed(2), '25.00');
  assert.equal(compactHeightPercent({ heights: [0], fractions: [0], headerFraction: 0.1, stackHeight: 1000 }), null);
  assert.equal(compactHeightPercent({ heights: [10], fractions: [50], headerFraction: 1, stackHeight: 1000 }), null);
  assert.equal(compactHeightPercent({ heights: [10], fractions: [50], headerFraction: 0.1, stackHeight: 0 }), null);
});

test('time: range generation normalises reversed bounds and renders both clocks', () => {
  assert.deepEqual(pickTime({ hour: 8, minute: 0 }, { hour: 17, minute: 0 }, 0), { hour: 8, minute: 0 });
  assert.deepEqual(pickTime({ hour: 8, minute: 0 }, { hour: 17, minute: 0 }, 540), { hour: 17, minute: 0 });
  assert.deepEqual(pickTime({ hour: 17, minute: 0 }, { hour: 8, minute: 0 }, 0), { hour: 8, minute: 0 });
  assert.deepEqual(pickTime({ hour: 10, minute: 0 }, { hour: 10, minute: 0 }, 999), { hour: 10, minute: 0 });
  for (let raw = 0; raw < 600; raw++) {
    const picked = pickTime({ hour: 8, minute: 0 }, { hour: 17, minute: 0 }, raw);
    assert.ok(picked.hour * 60 + picked.minute >= 480 && picked.hour * 60 + picked.minute <= 1020);
  }
  assert.equal(renderTime({ hour: 0, minute: 0 }, true), '00:00');
  assert.equal(renderTime({ hour: 23, minute: 59 }, true), '23:59');
  assert.equal(renderTime({ hour: 0, minute: 0 }, false), '12:00 AM');
  assert.equal(renderTime({ hour: 12, minute: 0 }, false), '12:00 PM');
  assert.equal(renderTime({ hour: 13, minute: 42 }, false), '01:42 PM');
  assert.equal(renderTime({ hour: 23, minute: 59 }, false), '11:59 PM');
});
