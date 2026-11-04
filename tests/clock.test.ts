// The vote clock's m:ss, the one formatter the projector and the phone share.
import { expect, it } from 'vitest';
import { clockText } from '../shared/clock';

it('reads whole seconds as minutes and seconds, and nothing left as 0:00', () => {
  expect(clockText(120)).toBe('2:00');
  expect(clockText(119)).toBe('1:59');
  expect(clockText(60)).toBe('1:00');
  expect(clockText(9)).toBe('0:09');
  expect(clockText(0)).toBe('0:00');
  expect(clockText(-3)).toBe('0:00');
  expect(clockText(600)).toBe('10:00');
});
