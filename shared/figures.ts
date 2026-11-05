// The four role figures, 16 x 20 pixels each, as rectangles in palette colours. The host paints its class textures
// from these lists, and figureSvg gives the phone and the HUD the same pixels as inline SVG. Each figure faces right,
// toward the boss, and holds its weapon in that hand. Figures carry no option colour (spec 4.1), except the four
// colours of the Microsoft logo on Satya Nadella's chest. Plain strings, no DOM, because shared/ is type-checked by
// both the DOM program and the worker program.
import { PALETTE } from './palette';
import type { Role } from './types';

/** A block of whole pixels: its top left corner, its width and height, and its palette colour. */
export type FigureRect = readonly [x: number, y: number, w: number, h: number, colour: string];

export const FIGURE_W = 16;
export const FIGURE_H = 20;

type Shade = keyof typeof PALETTE;

/** The keys every figure's rows share; `k` is skin, which each figure sets for itself. */
const INK: Readonly<Record<string, Shade>> = {
  o: 'outline', h: 'hair', H: 'hairGrey', K: 'skinShade', j: 'suit', J: 'suitLight', w: 'bone', d: 'boneDim',
  g: 'bone', T: 'steel', t: 'steelDark', L: 'leather', W: 'wood', e: 'ember', a: 'amber', s: 'stone', S: 'stoneLight',
  D: 'denim', c: 'shirtKhaki', C: 'cloth',
  x: 'flagBlack', r: 'flagRed', n: 'flagGreen',
  R: 'msRed', G: 'msGreen', U: 'msBlue', Y: 'msYellow',
};

/**
 * Rows of keys to rectangles, one per run of a key along a row, so the figures can be drawn as pictures. Throws on a
 * row of the wrong width or a key with no colour, so a slip shows up the first time the module loads.
 */
function drawn(skin: Shade, rows: readonly string[]): FigureRect[] {
  if (rows.length !== FIGURE_H) throw new Error(`a figure is ${FIGURE_H} rows, not ${rows.length}`);
  const out: FigureRect[] = [];
  rows.forEach((row, y) => {
    if (row.length !== FIGURE_W) throw new Error(`row ${y} is ${row.length} wide: ${row}`);
    for (let x = 0; x < row.length;) {
      const key = row[x];
      let end = x + 1;
      while (row[end] === key) end++;
      if (key !== '.') {
        const name = key === 'k' ? skin : INK[key];
        if (name === undefined) throw new Error(`no colour for "${key}" in row ${y}`);
        out.push([x, y, end - x, 1, PALETTE[name]]);
      }
      x = end;
    }
  });
  return out;
}

/** Citizen: a cap, a work shirt and jeans, a pickaxe raised in the right hand. */
const CITIZEN = drawn('skinDeep', [
  '..........TTTTt.',
  '.........T..W..t',
  '....ooooo...W...',
  '...oCCCCCo..W...',
  '..oCCCCCCCCo.W..',
  '..ohhkkkkko..W..',
  '..ohKkkoko...W..',
  '..ohkkkkkkk..W..',
  '...okkkkko...W..',
  '...ooKkkoo...W..',
  '..occcccccco.W..',
  '.occcccccccckkk.',
  '.okocccccccckWk.',
  '.okoLLLLLLLo.W..',
  '..ooDDDDDDo..W..',
  '...oDDDoDDo..L..',
  '...oDDDoDDo.....',
  '...oDDDoDDo.....',
  '...oLLooLLo.....',
  '..oLLLooLLLo....',
]);

/** Government: formal dress, a sash in the Kenyan flag's black, red and green, a large gavel raised. */
const GOVERNMENT = drawn('skinDeep', [
  '.........LLeeeLL',
  '.........LLWWWLL',
  '....oooooLLWWWLL',
  '...oHHHHHo..W...',
  '..oHHHHHHHo.W...',
  '..oHkkkkko..W...',
  '..oHKkkoko..W...',
  '..oHkkkkkkk.W...',
  '...okkkkko..W...',
  '...ooKkkoo..W...',
  '..oxrndwwdo.W...',
  '.odwxrndwwdkkk..',
  '.odddxrnddokkk..',
  '.okodwxrndo.W...',
  '..oodddxrno.W...',
  '...odddoxrn.L...',
  '...otttotto.....',
  '...otttotto.....',
  '...oCCooCCo.....',
  '..oCCCooCCCo....',
]);

/** Local Businessman: a grey suit, a white shirt and a red tie, swinging a briefcase. */
const BUSINESS = drawn('skinDeep', [
  '................',
  '................',
  '....ooooo.......',
  '...ohhhhho......',
  '..ohhhhhhho.....',
  '..ohkkkkkko.....',
  '..ohKkkoko......',
  '..ohkkkkkkk.....',
  '...okkkkko......',
  '...ooKkkoo......',
  '..oSSwrwSSo.....',
  '.oSSSwrwSSSoooo.',
  '.oSssSrSssSkkko.',
  '.okosSrSsso.ooo.',
  '..oosssssooLLLLL',
  '...oSSsosSo.LaLL',
  '...oSSsosSo.LLLL',
  '...oSSsosSo.LLLL',
  '...oCCooCCo.....',
  '..oCCCooCCCo....',
]);

/** Satya Nadella: short dark hair, glasses, a trim beard, a dark jacket with the four-square logo, a sword. */
const MICROSOFT = drawn('skinTan', [
  '.............T..',
  '....ooooo...TTt.',
  '...ohhhhho..TTt.',
  '..ohhhhhhho.TTt.',
  '..ohHkkkkko.TTt.',
  '..ohkogoogo.TTt.',
  '..oKkkkkkkk.TTt.',
  '..ohhkhhhko.TTt.',
  '...ohHkkHo..TTt.',
  '....ohHhho..TTt.',
  '..ojjjwwjjo.TTt.',
  '.ojRRjjGGjjaaaaa',
  '.ojRRjjGGjjokkk.',
  '.ojjjjjjjjjokLk.',
  '.ojUUjjYYjjo.L..',
  '.okUUjjYYjo..a..',
  '..oojjjjjo......',
  '...oJJjoJJo.....',
  '...oCCooCCo.....',
  '..oCCCooCCCo....',
]);

/** The four role figures by role. */
export const FIGURES: Readonly<Record<Role, readonly FigureRect[]>> = {
  citizen: CITIZEN,
  government: GOVERNMENT,
  business: BUSINESS,
  microsoft: MICROSOFT,
};

/**
 * The markup of one figure as an inline SVG: svg.figure[data-role][width=16*scale][height=20*scale][viewBox="0 0 16 20"]
 * [shape-rendering=crispEdges][aria-hidden=true][focusable=false], one <rect x y width height fill> per FigureRect.
 * Constant data only, so the phone and the HUD may set it through innerHTML on a holder, as they draw the option shapes.
 */
export function figureSvg(role: Role, scale: number): string {
  const rects = FIGURES[role].map(([x, y, w, h, colour]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${colour}"/>`);
  return `<svg class="figure" data-role="${role}" width="${FIGURE_W * scale}" height="${FIGURE_H * scale}" viewBox="0 0 ${FIGURE_W} ${FIGURE_H}"`
    + ` shape-rendering="crispEdges" aria-hidden="true" focusable="false">${rects.join('')}</svg>`;
}
