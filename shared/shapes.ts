// The shape bound to each option letter. The Global Constraints tie letter, colour and shape together on every screen,
// so the phone's vote buttons and the projector's letter badges draw the same four from here. Markup for a 24 x 24
// SVG drawn with a 2 px round stroke and no fill: plain strings, no DOM, because shared/ is type-checked by both the
// DOM program and the worker program.
import type { OptionId } from './types';

export type Shape = 'triangle' | 'diamond' | 'circle' | 'square';

/** A triangle, a diamond, a circle and a square, for A to D. */
export const OPTION_SHAPE: Record<OptionId, Shape> = { A: 'triangle', B: 'diamond', C: 'circle', D: 'square' };

/** What goes inside each shape's SVG. */
export const SHAPE_MARKUP: Record<Shape, string> = {
  triangle: '<path d="M12 4.5 20 18.5H4z"/>',
  diamond: '<path d="M12 3.5 20.5 12 12 20.5 3.5 12z"/>',
  circle: '<circle cx="12" cy="12" r="8"/>',
  square: '<rect x="4.5" y="4.5" width="15" height="15" rx="1.5"/>',
};
