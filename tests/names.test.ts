// tests/names.test.ts
import { it, expect } from 'vitest';
import { generateName, sanitizeName, sanitizeTable } from '../shared/names';
it('generates a stable two-word name per seed', () => {
  expect(generateName('abc')).toBe(generateName('abc'));
  expect(generateName('abc').split(' ')).toHaveLength(2);
  expect(generateName('abc')).not.toBe(generateName('abd'));
});
it('sanitises names and tables', () => {
  expect(sanitizeName('  Sarah\u0007  ', 's')).toBe('Sarah');
  expect(sanitizeName('AVeryLongNameIndeed', 's')).toBe('AVeryLongNameInd');
  expect(sanitizeName('   ', 's')).toBe(generateName('s'));
  expect(sanitizeName(undefined, 's')).toBe(generateName('s'));
  expect(sanitizeTable('  Table 3 ')).toBe('Table 3');
  expect(sanitizeTable('')).toBeNull();
  expect(sanitizeTable(undefined)).toBeNull();
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
  expect(sanitizeTable('\u0007 ')).toBeNull();
});
it('treats a name or table that is not a string as missing', () => {
  expect(sanitizeName(123 as unknown as string, 's')).toBe(generateName('s'));
  expect(sanitizeTable({} as unknown as string)).toBeNull();
});
it('never leaves a trailing space after the 16-character cut', () => {
  expect(sanitizeName('Abcdefghijklmno pqr', 's')).toBe('Abcdefghijklmno');
  expect(sanitizeTable('Abcdefghijklmno pqr')).toBe('Abcdefghijklmno');
});
