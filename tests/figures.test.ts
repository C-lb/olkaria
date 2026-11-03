// The class figures (shared/figures.ts): the pixel data the host paints and the phone draws, and the SVG markup for it.
import { it, expect } from 'vitest';
import { FIGURES, FIGURE_H, FIGURE_W, figureSvg } from '../shared/figures';
import { PALETTE } from '../shared/palette';
import { ROLES } from '../shared/types';

it('every figure is 12 by 16 of whole pixels in palette colours, one per role, no two alike', () => {
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

it('figureSvg draws every rectangle at the scale asked, crisp, and hidden from assistive tech', () => {
  const svg = figureSvg('government', 3);
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg).toContain('class="figure"');
  expect(svg).toContain('data-role="government"');
  expect(svg).toContain('width="36"');
  expect(svg).toContain('height="48"');
  expect(svg).toContain('viewBox="0 0 12 16"');
  expect(svg).toContain('shape-rendering="crispEdges"');
  expect(svg).toContain('aria-hidden="true"');
  expect(svg.match(/<rect /g)).toHaveLength(FIGURES.government.length);
});
