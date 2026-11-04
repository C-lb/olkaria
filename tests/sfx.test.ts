import { expect, it } from 'vitest';
import { hitFor, JOIN_GAP_MS, joinHz, SFX } from '../host/audio/sfx';
import { noteHz } from '../host/audio/score';

it('every effect is short, in range and in order', () => {
  for (const [id, steps] of Object.entries(SFX)) {
    expect(steps.length, id).toBeGreaterThan(0);
    let at = -1;
    for (const s of steps) {
      expect(s.at, id).toBeGreaterThanOrEqual(at);
      at = s.at;
      expect(Number.isFinite(s.hz), id).toBe(true);
      expect(s.ms, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeLessThanOrEqual(1);
      if (s.hzTo !== undefined) expect(Number.isFinite(s.hzTo), id).toBe(true);
    }
    expect(at + steps[steps.length - 1].ms, id).toBeLessThanOrEqual(1500);
  }
  expect(SFX.join.map((s) => s.hz)).toEqual([noteHz('E5'), noteHz('G5')]);
  expect(SFX.rallyYes.map((s) => s.hz)).toEqual(['C5', 'E5', 'G5', 'C6'].map(noteHz));
});
it('a bigger hit is lower and longer', () => {
  const small = hitFor(5, 100);
  const big = hitFor(100, 100);
  const tone = (steps: readonly { wave: string; hz: number; ms: number }[]) => steps.find((s) => s.wave === 'square')!;
  expect(tone(small).hz).toBeGreaterThan(tone(big).hz);
  expect(tone(small).ms).toBeLessThan(tone(big).ms);
  expect(tone(big).hz).toBe(110);
  expect(tone(small).hz).toBeLessThanOrEqual(440);
  expect(hitFor(0, 0).some((s) => s.wave === 'noise')).toBe(true);
});
it('join blips step up the scale and stop at the eighth', () => {
  expect(joinHz(0)).toBe(noteHz('E5'));
  expect(joinHz(1)).toBe(noteHz('F5'));
  expect(joinHz(7)).toBe(joinHz(20));
  expect(JOIN_GAP_MS).toBe(120);
});
