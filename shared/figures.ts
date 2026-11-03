// The four class figures, 12 x 16 pixels each, as rectangles in palette colours. The host paints its class textures
// from these lists, and figureSvg gives the phone and the HUD the same pixels as inline SVG. Class figures carry no
// option colour (spec 4.1): stone, bone and cloth only, told apart by silhouette. Plain strings, no DOM, because
// shared/ is type-checked by both the DOM program and the worker program.
import { PALETTE } from './palette';
import type { Role } from './types';

/** A block of whole pixels: its top left corner, its width and height, and its palette colour. */
export type FigureRect = readonly [x: number, y: number, w: number, h: number, colour: string];

export const FIGURE_W = 12;
export const FIGURE_H = 16;

const P = PALETTE;

/** Rogue: hood and cloak, a dagger in each hand. */
const ROGUE: readonly FigureRect[] = [
  [5, 0, 2, 1, P.cloth], [4, 1, 4, 1, P.cloth], [3, 2, 6, 5, P.cloth],
  [4, 4, 4, 2, P.outline], [5, 5, 1, 1, P.bone], [7, 5, 1, 1, P.bone],
  [3, 7, 6, 5, P.clothDark], [2, 10, 8, 2, P.clothDark], [3, 9, 6, 1, P.leather],
  [4, 12, 1, 3, P.cloth], [7, 12, 1, 3, P.cloth], [3, 15, 2, 1, P.leather], [7, 15, 2, 1, P.leather],
  [1, 6, 1, 4, P.steel], [0, 10, 3, 1, P.leather], [1, 11, 1, 1, P.leather],
  [10, 6, 1, 4, P.steel], [9, 10, 3, 1, P.leather], [10, 11, 1, 1, P.leather],
];

/** Knight: plumed helmet with a visor, plate, a shield on the left arm, a sword in the right. */
const KNIGHT: readonly FigureRect[] = [
  [5, 0, 2, 1, P.bone], [4, 1, 4, 1, P.steel], [3, 2, 6, 5, P.steel], [4, 4, 4, 1, P.outline],
  [4, 7, 4, 1, P.steelDark], [3, 8, 6, 4, P.steel], [3, 10, 6, 1, P.steelDark],
  [4, 12, 2, 3, P.steelDark], [6, 12, 2, 3, P.steelDark], [3, 15, 3, 1, P.stone], [6, 15, 3, 1, P.stone],
  [0, 7, 4, 6, P.stonePale], [0, 7, 4, 1, P.bone], [1, 9, 2, 2, P.bone], [1, 12, 2, 1, P.stoneLight],
  [10, 3, 1, 8, P.steel], [9, 11, 3, 1, P.leather], [10, 12, 1, 1, P.leather],
];

/** Bard: feathered cap, tunic, a lute across the body and a coin purse at the belt. */
const BARD: readonly FigureRect[] = [
  [3, 1, 6, 2, P.cloth], [8, 0, 3, 1, P.bone], [10, 1, 1, 1, P.bone],
  [4, 3, 4, 3, P.skin], [5, 4, 1, 1, P.outline], [7, 4, 1, 1, P.outline],
  [3, 6, 6, 6, P.cloth], [4, 6, 4, 1, P.boneDim], [3, 10, 6, 1, P.leather],
  [4, 12, 1, 3, P.clothDark], [7, 12, 1, 3, P.clothDark], [3, 15, 2, 1, P.leather], [7, 15, 2, 1, P.leather],
  [6, 8, 4, 4, P.wood], [7, 9, 1, 1, P.outline], [9, 5, 1, 3, P.leather], [10, 4, 1, 1, P.leather], [10, 3, 2, 1, P.wood],
  [1, 10, 2, 2, P.ember], [1, 9, 2, 1, P.leather],
];

/** Wizard: pointed hat, beard, robe to the ground, a staff with a lit stone and a tome. */
const WIZARD: readonly FigureRect[] = [
  [5, 0, 2, 1, P.cloth], [4, 1, 4, 2, P.cloth], [3, 3, 6, 1, P.cloth], [2, 4, 8, 1, P.clothDark],
  [4, 5, 4, 2, P.skin], [5, 5, 1, 1, P.outline], [7, 5, 1, 1, P.outline], [4, 7, 4, 2, P.bone],
  [3, 9, 6, 2, P.cloth], [2, 11, 8, 4, P.cloth], [2, 15, 8, 1, P.clothDark],
  [9, 8, 1, 2, P.skin], [10, 2, 1, 14, P.wood], [10, 1, 1, 1, P.amber], [9, 1, 1, 1, P.ember], [11, 1, 1, 1, P.ember],
  [1, 9, 3, 3, P.leather], [1, 9, 1, 3, P.bone],
];

/** The four class figures by role: citizen the Rogue, government the Knight, business the Bard, microsoft the Wizard. */
export const FIGURES: Readonly<Record<Role, readonly FigureRect[]>> = {
  citizen: ROGUE,
  government: KNIGHT,
  business: BARD,
  microsoft: WIZARD,
};

/**
 * The markup of one figure as an inline SVG: svg.figure[data-role][width=12*scale][height=16*scale][viewBox="0 0 12 16"]
 * [shape-rendering=crispEdges][aria-hidden=true][focusable=false], one <rect x y width height fill> per FigureRect.
 * Constant data only, so the phone and the HUD may set it through innerHTML on a holder, as they draw the option shapes.
 */
export function figureSvg(role: Role, scale: number): string {
  const rects = FIGURES[role].map(([x, y, w, h, colour]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colour}"/>`);
  return `<svg class="figure" data-role="${role}" width="${FIGURE_W * scale}" height="${FIGURE_H * scale}" viewBox="0 0 ${FIGURE_W} ${FIGURE_H}"`
    + ` shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects.join('')}</svg>`;
}
