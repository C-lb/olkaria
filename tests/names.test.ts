// tests/names.test.ts
import { it, expect } from 'vitest';
import { generateName, sanitizeName, sanitizeTeam, TEAMS } from '../shared/names';
it('generates a stable two-word name per seed', () => {
  expect(generateName('abc')).toBe(generateName('abc'));
  expect(generateName('abc').split(' ')).toHaveLength(2);
  expect(generateName('abc')).not.toBe(generateName('abd'));
});
it('sanitises names', () => {
  expect(sanitizeName('  Sarah\u0007  ', 's')).toBe('Sarah');
  expect(sanitizeName('AVeryLongNameIndeed', 's')).toBe('AVeryLongNameInd');
  expect(sanitizeName('   ', 's')).toBe(generateName('s'));
  expect(sanitizeName(undefined, 's')).toBe(generateName('s'));
});
it('strips bidi and zero-width controls, and cuts by code point so an emoji is never split', () => {
  expect(sanitizeName('Ann\u202Eevil', 's')).toBe('Annevil');
  for (const cc of [0x200b, 0x200f, 0x202a, 0x202e, 0x2066, 0x2069]) expect(sanitizeName(`A${String.fromCharCode(cc)}B`, 's')).toBe('AB');
  const cut = sanitizeName('\u{1F600}'.repeat(20), 's');
  expect(Array.from(cut)).toHaveLength(16);
  expect(cut).toBe('\u{1F600}'.repeat(16));
  expect(cut).not.toMatch(/\uFFFD|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
});
it('lists Team 1 to Team 8 and accepts exactly those', () => {
  expect(TEAMS).toEqual(['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6', 'Team 7', 'Team 8']);
  for (const team of TEAMS) expect(sanitizeTeam(team)).toBe(team);
  expect(sanitizeTeam('Team 3')).toBe('Team 3');
  expect(sanitizeTeam('Team 9')).toBeNull();
  expect(sanitizeTeam(undefined)).toBeNull();
  for (const bad of ['', ' Team 3', 'team 3', 'Team 3 ', 'Table 3', 'Front row', 3, null, {}, ['Team 3']]) expect(sanitizeTeam(bad)).toBeNull();
});

import { NAME_FIRST_WORDS, NAME_SECOND_WORDS } from '../shared/names';

it('keeps both word lists at 24 entries', () => {
  expect(NAME_FIRST_WORDS).toHaveLength(24);
  expect(NAME_SECOND_WORDS).toHaveLength(24);
});
it('keeps every pairing within the 16-character cap that typed names obey', () => {
  const tooLong = NAME_FIRST_WORDS.flatMap((first) => NAME_SECOND_WORDS.map((second) => `${first} ${second}`)).filter((name) => name.length > 16);
  expect(tooLong).toEqual([]);
});
it('builds every generated name from two capitalised words', () => {
  for (let i = 0; i < 500; i++) expect(generateName(`seed-${i}`)).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
});
it('draws from two lists of 24 words each, independently', () => {
  const names = Array.from({ length: 4000 }, (_, i) => generateName(`client-${i}`));
  expect(new Set(names.map((n) => n.split(' ')[0])).size).toBe(24);
  expect(new Set(names.map((n) => n.split(' ')[1])).size).toBe(24);
  expect(new Set(names).size).toBe(24 * 24);
});
it('strips control characters wherever they sit and before counting the 16 characters', () => {
  expect(sanitizeName('Sa\u0000ra\u007fh\n', 's')).toBe('Sarah');
  expect(sanitizeName('a\u0007bcdefghijklmnopqrstuv', 's')).toBe('abcdefghijklmnop');
});
it('falls back when nothing but control characters and spaces is left', () => {
  expect(sanitizeName('\u0007\u0001', 's')).toBe(generateName('s'));
});
it('treats a name that is not a string as missing', () => {
  expect(sanitizeName(123 as unknown as string, 's')).toBe(generateName('s'));
});
it('never leaves a trailing space after the 16-character cut', () => {
  expect(sanitizeName('Abcdefghijklmno pqr', 's')).toBe('Abcdefghijklmno');
});
