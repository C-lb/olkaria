// tests/codes.test.ts
import { it, expect } from 'vitest';
import { makeRoomCode, isValidCode } from '../shared/codes';
it('makes 4-letter codes without I or O', () => {
  for (let i = 0; i < 200; i++) {
    const code = makeRoomCode(Math.random);
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(isValidCode(code)).toBe(true);
  }
  expect(isValidCode('ABIO')).toBe(false);
  expect(isValidCode('abcd')).toBe(false);
  expect(isValidCode('ABCDE')).toBe(false);
});

it('maps the rng onto the 24-letter alphabet and steps over I and O', () => {
  expect(makeRoomCode(() => 0)).toBe('AAAA');
  expect(makeRoomCode(() => 0.999999)).toBe('ZZZZ');
  const draws = [7.5, 8.5, 12.5, 13.5].map((i) => i / 24);
  let n = 0;
  expect(makeRoomCode(() => draws[n++])).toBe('HJNP');
});
it('stays inside the alphabet when an rng returns exactly 1', () => {
  expect(makeRoomCode(() => 1)).toBe('ZZZZ');
});
it('accepts the codes it makes and nothing else', () => {
  expect(isValidCode('HJNP')).toBe(true);
  for (const bad of ['', 'ABC', 'ABC1', 'ABCI', 'ABCO', 'abcd', ' ABC', 'ABCD\n', 'ÀBCD']) expect(isValidCode(bad)).toBe(false);
});
