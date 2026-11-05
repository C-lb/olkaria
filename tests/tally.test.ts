// tests/tally.test.ts
import { it, expect } from 'vitest';
import { majorityOf, shares } from '../shared/tally';

it('gives each option its part of the whole, and zeros for an empty tally', () => {
  expect(shares({ A: 0, B: 0, C: 0 })).toEqual({ A: 0, B: 0, C: 0 });
  expect(shares({ A: 1, B: 3, C: 0 })).toEqual({ A: 0.25, B: 0.75, C: 0 });
});
it('has no majority for an empty tally', () => {
  expect(majorityOf({ A: 0, B: 0, C: 0 })).toEqual({ majority: null, tiedWith: [] });
});
it('picks the top option, and a tie goes to the earlier letter with the others listed', () => {
  expect(majorityOf({ A: 0, B: 1, C: 0 })).toEqual({ majority: 'B', tiedWith: [] });
  expect(majorityOf({ A: 1, B: 0, C: 4 })).toEqual({ majority: 'C', tiedWith: [] });
  expect(majorityOf({ A: 2, B: 1, C: 2 })).toEqual({ majority: 'A', tiedWith: ['C'] });
  expect(majorityOf({ A: 0, B: 3, C: 3 })).toEqual({ majority: 'B', tiedWith: ['C'] });
  expect(majorityOf({ A: 1, B: 1, C: 1 })).toEqual({ majority: 'A', tiedWith: ['B', 'C'] });
});
