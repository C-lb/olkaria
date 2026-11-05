// The role figures (shared/figures.ts): the pixel data the host paints and the phone draws, and the SVG markup for it.
import { it, expect } from 'vitest';
import { FIGURES, FIGURE_H, FIGURE_W, figureSvg } from '../shared/figures';
import { PALETTE } from '../shared/palette';
import { ROLES } from '../shared/types';

it('every figure is 16 by 20 of whole pixels in palette colours, one per role, no two alike', () => {
  expect([FIGURE_W, FIGURE_H]).toEqual([16, 20]);
  const colours = new Set<string>(Object.values(PALETTE));
  for (const role of ROLES) {
    const rects = FIGURES[role];
    expect(rects.length).toBeGreaterThan(10);
    for (const [x, y, w, h, colour] of rects) {
      expect([x, y, w, h].every(Number.isInteger)).toBe(true);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(FIGURE_W);
      expect(y + h).toBeLessThanOrEqual(FIGURE_H);
      expect(colours.has(colour)).toBe(true);
    }
  }
  expect(new Set(ROLES.map((r) => JSON.stringify(FIGURES[r]))).size).toBe(4);
});

it('Satya Nadella wears the four-colour logo', () => {
  const worn = new Set(FIGURES.microsoft.map((r) => r[4]));
  for (const colour of ['#f25022', '#7fba00', '#00a4ef', '#ffb900']) expect(worn.has(colour), colour).toBe(true);
});

it('every figure holds its weapon on the right, toward the boss', () => {
  const weapon = new Set<string>([PALETTE.steel, PALETTE.wood, PALETTE.leather]);
  const third = Math.ceil((FIGURE_W * 2) / 3);
  for (const role of ROLES) {
    expect(FIGURES[role].some(([x, , , , colour]) => x >= third && weapon.has(colour)), role).toBe(true);
  }
});

it('figureSvg draws every rectangle at the scale asked, crisp, and hidden from assistive tech', () => {
  const svg = figureSvg('citizen', 3);
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg).toContain('class="figure"');
  expect(svg).toContain('data-role="citizen"');
  expect(svg).toContain('width="48" height="60" viewBox="0 0 16 20"');
  expect(svg).toContain('shape-rendering="crispEdges"');
  expect(svg).toContain('aria-hidden="true"');
  expect(svg.match(/<rect /g)).toHaveLength(FIGURES.citizen.length);
});
