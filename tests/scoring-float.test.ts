// tests/scoring-float.test.ts
// Shares are ratios of whole numbers, so values that are equal on paper can differ in the last bit.
// Each input below is one where plain ===, >= or Math.round gets the answer on paper wrong.
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { blendShares, majorityOf, computeDamage, speedBonus } from '../shared/scoring';
const c = loadContent(raw);
const T = (A: number, B: number, C: number, D: number) => ({ A, B, C, D });
const Z = T(0, 0, 0, 0);

describe('floating-point slack', () => {
  it('flags a tie that differs only in the last bit and keeps the earliest letter', () => {
    // C is (2/3 + 1/6) / 2 and D is (0 + 5/6) / 2, both 5/12. As floats D is one bit ahead.
    expect(majorityOf(blendShares(T(0, 1, 2, 0), T(0, 0, 1, 5)))).toEqual({ majority: 'C', tied: true });
  });
  it('awards focus when the blended top share equals the threshold on paper', () => {
    // B is (3/5 + 7/10) / 2 = 0.65, but 0.6 + 0.7 is 1.2999999999999998 as a float.
    const tuned = { ...c, scoring: { ...c.scoring, focusThreshold: 0.65 } };
    const d = computeDamage({ content: tuned, roundIndex: 0, lead: T(2, 3, 0, 0), support: T(3, 7, 0, 0), prior: [], exhibits: 0, rallies: 0 });
    expect(d.tied).toBe(false); expect(d.focus).toBe(15);
  });
  it('rounds a total that is x.5 on paper up', () => {
    // Support only, shares 1/6 1/3 1/3 1/6 on scores 40 80 15 55: 47.5 on paper, 47.49999999999999 as a float.
    const d = computeDamage({ content: c, roundIndex: 0, lead: Z, support: T(1, 2, 2, 1), prior: [], exhibits: 0, rallies: 0 });
    expect(d.total).toBe(48);
  });
  it('rounds a speed bonus that is x.5 on paper up', () => {
    expect(speedBonus(6750, 10000, 20)).toBe(7); // 20 * (1 - 0.675) = 6.5
  });
});
