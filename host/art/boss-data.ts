// The bosses' data, which bosses.ts draws: the sprite rows, where every part sits about the boss's feet, how far its
// idle loop and a hit move it, and where its particles may go. No Phaser here, so tests/bosses.test.ts can hold each
// boss to the box Battle keeps for it.
import type { PALETTE } from './placeholders';

export type BossId = 'power' | 'demand' | 'competition' | 'risk' | 'core';
/** The bosses in round order, Q1 to Q5. */
export const BOSS_IDS: readonly BossId[] = ['power', 'demand', 'competition', 'risk', 'core'];
export type Shade = keyof typeof PALETTE;
/** A range of whole-pixel offsets, least to most. */
export type Span = readonly [min: number, max: number];

/** Sprite rows: each character names a palette shade, '.' is clear. */
export const INK: Readonly<Record<string, Shade>> = {
  o: 'outline', n: 'night', D: 'stoneDeep', d: 'stoneDark', s: 'stone', l: 'stoneLight', p: 'stonePale',
  B: 'bone', b: 'boneDim', T: 'steel', t: 'steelDark', C: 'clothDark', c: 'cloth', e: 'ember', a: 'amber', W: 'white',
  w: 'wood', L: 'leather',
};

/** A hit: bone for `flashMs`, a recoil of `recoilPx` to the right, out fast and back slow, home after `ms`. */
export const HIT = { ms: 300, flashMs: 100, recoilPx: 3 } as const;

/** A death: bone for `flashMs`, then it sinks `sinkPx` and fades out, gone after `ms`. */
export const DIE = { ms: 900, flashMs: 150, sinkPx: 8 } as const;

/** The digits font's cell (placeholders.ts): every glyph is drawn in one 5 x 6 cell. */
export const DIGIT_CELL = { w: 5, h: 6 } as const;

// ---- Sprite rows ---------------------------------------------------------------------------------------------

/** Particles, white, so a tint gives the exact colour. */
export const SPARK = ['.W.', 'WWW', '.W.'];
export const BOLT = ['..W.', '.W..', 'WWWW', '..W.', '.W..', 'W...'];
export const MOTE = ['WW', 'WW'];
/** A fog puff: a disc 7 px across (bosses.ts paints it soft-edged). */
export const PUFF_PX = 7;

export const LINK_FACE = [
  '..ooooooo..',
  '.oTTTTTTlo.',
  'oTTo...olso',
  'oTo.....oso',
  'oTo.....oso',
  'oslo...osso',
  '.ossssssso.',
  '..ooooooo..',
];
export const LINK_EDGE = [
  '.ooooooooo.',
  'oTTTTTTTTlo',
  'ossssssssso',
  '.ooooooooo.',
];
export const WYRM_HEAD = [
  '................ooBBo',
  '............oooobbooo',
  '.........ooolllbooobb',
  '....oooooTTTTTTlllboo',
  '...oTTTTTllllllTTTlo.',
  '...oooTTllllllaassslo',
  '.ooTTTlllaaaelllssslo',
  'oTTllllllaaallllssslo',
  'olllllllllllllllssslo',
  'olllllllllllllllssslo',
  '.oBooBooBooBossslssso',
  '.osbssbssbsssssssloo.',
  '.ossssssssssssssoo...',
  '..oooooooooooooo.....',
];

export const WRAITH = [
  '...........ooCccCCoo........',
  '..........oCccCCCCCCo.......',
  '.........oCccCCCCCCCCo......',
  '........oCccCCCCCCCCCCo.....',
  '........oCccCCCCCCCCCCo.....',
  '.......oCccCooooooCCCCCo....',
  '.......oCcCooooooooCCCCo....',
  '.......oCcCooooooooCCCCo....',
  '.......oCcCoaaooaaoCCCCo....',
  '.......oCcCoeooooeoCCCCo....',
  '.......oCcCooooooooCCCCo....',
  '.......oCcCooooooooCCCCo....',
  '.......oCcCCooooooCCCCCo....',
  '.......oCcCCCCCCCCCCCCCo....',
  '.......oCcCCCCCCCCCCCCCo....',
  '......ooCcCCCCCCCCCCCCCooo..',
  '....oocCCCCcCCCCcCCCcCCcCCo.',
  '..oocCCCCCCcCCCCcCCCcCCCCCo.',
  'oocCCCCCCCCcCCCCcCCCcCCCCCo.',
  'cCCCCCCCcCCCCCCCCCCCcCCCCCo.',
  'CCbBCCoCcCCcCCCCcCCCCCCCCCo.',
  'CbBCBooCcCCcCCCCcCCCcCCCCCo.',
  'CBobo.oCcCCcCCCCcCCCcCCCCCo.',
  'ooBoboCcCCCcCCCCcCCCcCCCCCo.',
  '..o.ooCcCCCCCCCCCCCCcCCCCCo.',
  '.....oCcCCCcCCCCcCCCCCCBCbo.',
  '.....oCcCCCcCCCCcCCCcCCCBo..',
  '.....oCcCCCcCCCCcCCCcCCbCo..',
  '....oCcCCCCcCCCCcCCCcCCCCCo.',
  '....oCcCCCCCCCCCCCCCcCCCCCo.',
  '....oCcCCCCcCCCCcCCCCCCCCCo.',
  '....oCcCCCCcCCCCcCCCcCCCCCo.',
  '...oCcCCCCCcCCCCcCCCcCCCCCCo',
  '....oCCCCCCCCCCCCCCCCCCCCCo.',
  '....oCCCCCCoCCCCCCCCCCCoCCo.',
  '....oCCoCCCoCCCoCCCoCCCoCCo.',
  '.....ododddodododddodododdo.',
  '.....odododododododododoodo.',
  '.....ododooododooodooodo.o..',
  '......oodo..oodo..o...o.....',
];

export const HEART = [
  '........oo..ocCCooooo.........',
  '.....oooCCoooCCCoCCCCooo......',
  '....oCCCCCCCCCCCCCCCCCCCo.....',
  '...oCCCCCCCCCCCCCCCCCCCCCo....',
  '..oCCCCCCcCCCCCCCCCCCCCCCCo...',
  '.oCCCCClcCCCCCCCCCCCCCCCCCCo..',
  '.oCCCCccCCCCCCCCCCCCCCCCCCCo..',
  '.oCCCCcCCCCCCCCCCCCCCCCCCCCo..',
  'oCCCCCCCCCCCCCCCCCCCCCCCCCCno.',
  'oCCCCCCCCCCCCCCCCCCCCCCCCCnno.',
  '.oCCCCCCCCCCCCCCCCCCCCCCCnno..',
  '.oCCCCCCCCCCCCCCCCCCCCCCnnno..',
  '.oCCCCCCCCCCCCCCCCCCCCCnnnno..',
  '..oCCCCCCCCCCCCCCCCCCCnnnno...',
  '...oCCCCCCCCCCCCCCCCCnnnno....',
  '....oCCCCCCCCCCCCCCCnnnno.....',
  '.....oooCCCCCCCCCCCnnooo......',
  '.......oCCCCCCCCCCnnno........',
  '........oCCCCCCCCnnno.........',
  '.........oCCCCCCnnno..........',
  '..........oCCCCnnno...........',
  '...........oCCnnno............',
  '...........oCnnnno............',
  '............onnno.............',
  '.............ono..............',
  '..............o...............',
];
/** The fissures that glow with each beat, laid over HEART from its top-left corner. */
export const VEINS = [
  '..............................',
  '..............................',
  '..............................',
  '..............ee..............',
  '..............ae..............',
  '...........e..ae...e..........',
  '..........e..eaa..e...........',
  '.........e...aaae.e...........',
  '......ee....eaBaa.e...ee......',
  '........e..eaaaae..ee.........',
  '.........ee.eaaa.ee...........',
  '...........e.ae.e.............',
  '..........e..ae..e............',
  '.........e...e....e...........',
  '.............ae...............',
  '..............e...............',
  '.............e................',
  '..............e...............',
];

/** The same rows stood on end: a chain link turned a quarter. */
export const upright = (rows: readonly string[]): string[] => [...rows[0]].map((_, x) => rows.map((row) => row[x]).join(''));

/** Rings every painted pixel of a grid of palette keys with outline on the clear pixels beside it. */
export function outlined(cells: readonly (readonly string[])[]): string[] {
  const at = (x: number, y: number): string => cells[y]?.[x] ?? '.';
  return cells.map((row, y) => row.map((k, x) => {
    if (k !== '.') return k;
    const near = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    return near.some((n) => n !== '.' && n !== 'o') ? 'o' : '.';
  }).join(''));
}

/** The core's ring: three arcs between three cracks (degrees, y down), lit from the upper left. */
export const RING = { size: 48, outer: 22, inner: 17, cracks: [-100, 20, 140], gap: 7 } as const;

/** The rows of the ring's arc `i`, on a RING.size square centred on the ring. */
export function ringArc(i: number): string[] {
  const { size, outer, inner, cracks, gap } = RING;
  const c = size / 2;
  const from = cracks[i];
  const to = cracks[(i + 1) % cracks.length] + (i === cracks.length - 1 ? 360 : 0);
  const cells = Array.from({ length: size }, (_, y) => Array.from({ length: size }, (__, x) => {
    const dx = x + 0.5 - c;
    const dy = y + 0.5 - c;
    const d = Math.hypot(dx, dy);
    if (d > outer + 0.3 || d < inner) return '.';
    let a = (Math.atan2(dy, dx) * 180) / Math.PI;
    while (a < from) a += 360;
    while (a >= from + 360) a -= 360;
    if (a < from + gap || a > to - gap) return '.';
    const lit = Math.cos(((a + 135) * Math.PI) / 180);
    if (d > outer - 1) return lit > 0.55 ? 'p' : lit > -0.2 ? 'l' : 's';
    if (d < inner + 1) return 'd';
    return lit > 0.3 ? 'l' : 's';
  }));
  return outlined(cells);
}

/** A grid of clear cells. */
const blank = (w: number, h: number): string[][] => Array.from({ length: h }, () => Array.from({ length: w }, () => '.'));

/** Sets every cell whose middle lies within `r` of (cx, cy), leaving cells off the grid alone. */
function stamp(cells: string[][], cx: number, cy: number, r: number, k: string, ry = r): void {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (cells[y]?.[x] === undefined) continue;
      if (((x + 0.5 - cx) / r) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) cells[y][x] = k;
    }
  }
}

/**
 * Shades the stone cells of a body lit from the upper left, as the ring is: pale where the cell up or left of it is
 * clear, dark where the cell down or right is, and a scatter of dark scales between.
 */
function shaded(cells: string[][]): void {
  const clear = (x: number, y: number): boolean => (cells[y]?.[x] ?? '.') === '.';
  const lit = cells.map((row, y) => row.map((k, x) => k === 's' && (clear(x - 1, y) || clear(x, y - 1))));
  const dark = cells.map((row, y) => row.map((k, x) => k === 's' && (clear(x + 1, y) || clear(x, y + 1))));
  cells.forEach((row, y) => row.forEach((k, x) => {
    if (k !== 's') return;
    if (lit[y][x]) row[x] = 'l';
    else if (dark[y][x]) row[x] = 'd';
    else if ((x + 3 * y) % 11 === 0) row[x] = 'd';
  }));
}

// The Hydra of Rivalry: one squat body and three necks, a head on each for a rival, every head snapping at the party.

/**
 * A head, facing left, its neck running off to the lower right. The three heads share it and each wears its own
 * crest, so the rivals are told apart without a logo.
 */
const HYDRA_HEAD = [
  '.....ooooo....',
  '...oollllsso..',
  '.oolllaolllso.',
  'ollllllllllsso',
  'oBoBoBollllsso',
  '.oeeeeeolsssso',
  'oBoBoBoolsssso',
  '.oooooooossso.',
  '........ossso.',
];
/** Horns, a fin and a row of spikes: two rows laid on top of the head, one crest per head. */
const CRESTS = [
  ['.........T..T.', '........Tt.Tt.'],
  ['......eee.....', '.....eeeee....'],
  ['.....B.B.B....', '.....BBBBBB...'],
];

/** A head with its crest, a pixel of margin all round, ringed with outline. */
function hydraHead(i: number): string[] {
  const rows = [...CRESTS[i], ...HYDRA_HEAD];
  const w = rows[0].length + 2;
  const cells = [Array(w).fill('.'), ...rows.map((row) => ['.', ...row, '.']), Array(w).fill('.')];
  return outlined(cells);
}

export const HYDRA = {
  /** The body's sprite covers the whole box, so its corner is the box's (necks and tail included). */
  body: { key: 'hydra-body', x: -40, y: -50, w: 76, h: 50 },
  /** Each head's corner, and where its neck leaves the body: left and low, high in the middle, right and lower. */
  heads: [{ x: -40, y: -40 }, { x: -24, y: -48 }, { x: -6, y: -42 }],
  shoulders: [{ x: -10, y: -15 }, { x: 0, y: -18 }, { x: 10, y: -16 }],
  /** Where a neck meets its head, about the head's corner. */
  throat: { x: 11, y: 10 },
  /** The body breathes a pixel up; each head dips a pixel on its own beat, so the three never move as one. */
  breath: { dx: 0, dy: -1, ms: 1300 },
  sway: [{ dx: 0, dy: 1, ms: 700 }, { dx: 0, dy: 1, ms: 950 }, { dx: 0, dy: 1, ms: 820 }],
  swayDelay: [0, 300, 150],
} as const;

/** The body: a squat trunk on the floor, a tail curled up behind, three necks reaching up to where the heads sit. */
function hydraBody(): string[] {
  const { body, heads, shoulders, throat } = HYDRA;
  const cells = blank(body.w, body.h);
  const at = (x: number, y: number): [number, number] => [x - body.x, y - body.y];
  // The necks, thick at the shoulder and thinner at the throat, bowed out to the left.
  heads.forEach((head, i) => {
    const [sx, sy] = at(shoulders[i].x, shoulders[i].y);
    const [ex, ey] = at(head.x + throat.x, head.y + throat.y);
    const [cx, cy] = [Math.min(sx, ex) - 3, (sy + ey) / 2 + 2];
    for (let t = 0; t <= 1; t += 0.02) {
      const x = (1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t ** 2 * ex;
      const y = (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t ** 2 * ey;
      stamp(cells, x, y, 3.4 - t * 1.2, 's');
    }
  });
  // The tail, curling up behind the trunk.
  for (let t = 0; t <= 1; t += 0.02) {
    const [x, y] = at(20 + 11 * Math.sin(t * 2.2), -6 - 12 * t + 4 * Math.sin(t * 3));
    stamp(cells, x, y, 4 - t * 2.6, 's');
  }
  // The trunk and its two stout legs, cut flat at the floor.
  stamp(cells, ...at(6, -9), 17, 's', 10);
  for (const lx of [-6, 16]) stamp(cells, ...at(lx, -3), 4, 's', 3.5);
  cells[body.h - 1].fill('.');
  shaded(cells);
  // Claws at the feet.
  for (const lx of [-9, -6, -3, 13, 16, 19]) {
    const [cx, cy] = at(lx, -2);
    cells[cy][cx] = 'B';
  }
  return outlined(cells);
}

// The Wraith of Risk: a hooded wraith whose body is an hourglass, running out while the party waits.

/** The hourglass's sizes, in rows and columns of its sprite. */
const GLASS = { w: 30, h: 46, mid: 15, plateTop: 13, bulbTop: 15, neck: 25, bulbBottom: 36, plateBottom: 37, half: 7 } as const;

/** The half-width of the glass's inside on a row: round bulbs pinched to a pixel at the neck. */
function bulb(y: number): number {
  const { bulbTop, bulbBottom, neck, half } = GLASS;
  const t = y <= neck ? (neck - y) / (neck - bulbTop) : (y - neck - 1) / (bulbBottom - neck - 1);
  return Math.max(1, Math.round(1 + (half - 1) * Math.sin(Math.min(1, t) * Math.PI * 0.62) / Math.sin(Math.PI * 0.62)));
}

/** The wraith: a hood over two eyes, a ragged mantle, the hourglass, a hem of tatters under it. */
function wraithGlass(): string[] {
  const { w, h, mid, plateTop, bulbTop, bulbBottom, plateBottom } = GLASS;
  const cells = blank(w, h);
  // The hood and the dark inside it.
  stamp(cells, mid, 7.5, 7, 'C', 7.5);
  stamp(cells, mid - 3, 6, 3, 'c', 4);
  stamp(cells, mid - 1, 8.5, 4.3, 'o', 4);
  cells[8][mid - 3] = 'a';
  cells[8][mid] = 'a';
  cells[9][mid - 3] = 'e';
  cells[9][mid] = 'e';
  // The mantle over the shoulders.
  for (let y = 11; y <= plateTop; y++) for (let x = 3 + (plateTop - y) * 2; x < w - 3 - (plateTop - y) * 2; x++) cells[y][x] = y === 11 ? 'c' : 'C';
  // The plates and the posts between them.
  for (const y of [plateTop + 1, plateBottom]) for (let x = 3; x < w - 3; x++) cells[y][x] = y === plateTop + 1 ? 'w' : 'L';
  for (let y = plateTop + 2; y < plateBottom; y++) {
    cells[y][4] = 'w';
    cells[y][w - 5] = 'L';
  }
  // The glass: a pale rim, dark inside, a glint down the left.
  for (let y = bulbTop + 1; y < bulbBottom + 1; y++) {
    const r = bulb(y);
    for (let x = mid - r; x < mid + r; x++) cells[y][x] = 'D';
    cells[y][mid - r - 1] = 'p';
    cells[y][mid + r] = 'l';
    if (r > 3) cells[y][mid - r + 1] = 'd';
  }
  // Tatters under the lower plate, uneven, thinning to nothing.
  const hem = [3, 5, 2, 6, 4, 3, 5, 2, 4, 6, 3, 5, 2, 4, 3, 5, 2, 6, 4, 3];
  hem.forEach((len, i) => {
    const x = 5 + i;
    for (let y = plateBottom + 1; y < Math.min(h - 1, plateBottom + 1 + len); y++) if ((y + i) % 4 !== 0 || y < plateBottom + 3) cells[y][x] = i % 3 === 0 ? 'C' : 'c';
  });
  return outlined(cells);
}

/** The sand, laid over the glass from its corner: a heap draining in the top bulb, a thread through the neck, a mound below. */
function wraithSand(): string[] {
  const { w, h, mid, neck, bulbBottom } = GLASS;
  const cells = blank(w, h);
  for (let y = neck - 4; y <= neck; y++) {
    const r = bulb(y);
    for (let x = mid - r; x < mid + r; x++) cells[y][x] = x >= mid + r - 1 ? 'e' : 'a';
  }
  for (let y = neck + 1; y < bulbBottom - 4; y++) cells[y][mid - 1] = 'a';
  for (let y = bulbBottom - 4; y <= bulbBottom; y++) {
    const r = Math.min(bulb(y), 1 + (y - (bulbBottom - 4)) * 2);
    for (let x = mid - r; x < mid + r; x++) cells[y][x] = x >= mid + r - 2 ? 'e' : 'a';
  }
  return cells.map((row) => row.join(''));
}

/** An arm: a ragged sleeve reaching down and out, bone fingers at its end. The right arm is the same turned over. */
const WRAITH_ARM = [
  '.......ooo',
  '......occo',
  '.....occCo',
  '.....occo.',
  '....occCo.',
  '...occco..',
  '...occCo..',
  '..occco...',
  '..occo....',
  '.oBBBo....',
  'oBoBoBo...',
  'oBoBo.....',
  '.o.o......',
];
const mirrored = (rows: readonly string[]): string[] => rows.map((row) => [...row].reverse().join(''));

/** Every sprite's rows by texture key, the ring's arcs included. */
export const SPRITES: Readonly<Record<string, readonly string[]>> = {
  'boss-spark': SPARK, 'boss-bolt': BOLT, 'boss-mote': MOTE,
  'wyrm-link-face': LINK_FACE, 'wyrm-link-edge': LINK_EDGE,
  'wyrm-link-face-up': upright(LINK_FACE), 'wyrm-link-edge-up': upright(LINK_EDGE), 'wyrm-head': WYRM_HEAD,
  'fog-wraith': WRAITH, 'core-heart': HEART, 'core-veins': VEINS,
  'hydra-body': hydraBody(), 'hydra-head-0': hydraHead(0), 'hydra-head-1': hydraHead(1), 'hydra-head-2': hydraHead(2),
  'risk-glass': wraithGlass(), 'risk-sand': wraithSand(), 'risk-arm-left': WRAITH_ARM, 'risk-arm-right': mirrored(WRAITH_ARM),
  ...Object.fromEntries(RING.cracks.map((_, i) => [`core-ring-${i}`, ringArc(i)])),
};

// ---- Layout: corners about the feet, idle motion, particles ------------------------------------------------

/** A part at rest: its texture and its top-left corner about the boss's feet. */
export interface Placed { key: string; x: number; y: number }

/** A figure in the digits font at rest: its top-left corner about the boss's feet. */
export interface Figure { text: string; x: number; y: number; spacing: number }

/** A whole-pixel loop from rest out to (dx, dy) and back, `ms` each way. */
export interface Stray { dx: number; dy: number; ms: number }

/** Where a sprite goes so its middle is (x, y): its corner on the whole pixel at or before half its size. */
function centred(key: string, x: number, y: number): Placed {
  const rows = SPRITES[key];
  return { key, x: x - Math.floor(rows[0].length / 2), y: y - Math.floor(rows.length / 2) };
}

// The Grid Wyrm: a serpent of chain links coiled up from the floor, lightning crawling over it.

/** Its links, tail on the floor to the neck: each link's middle, and whether it stands on end at a turn of the coil. */
export const WYRM_LINKS: readonly (readonly [x: number, y: number, upright: boolean])[] = [
  [26, -5, false], [20, -5, false], [14, -5, false], [7, -5, false], [1, -5, false], [-5, -7, false], [-11, -10, false],
  [-15, -14, true], [-16, -20, true], [-11, -24, false], [-5, -26, false], [1, -27, false], [8, -27, false],
  [14, -27, false], [20, -30, false], [22, -35, true], [17, -39, false], [11, -42, false], [5, -43, false],
  [-1, -43, false], [-7, -43, false],
];
/** The head's middle: it faces the party, left of the neck, its horns clear of the HP bar at the wave's peak. */
export const WYRM_HEAD_AT = { x: -20, y: -40 } as const;
/** The coil ripples: a wave runs up the chain, still at the tail and `px` across it at the neck, once every `ms`. */
export const WAVE = { px: 1.6, ms: 2600, step: 0.55 } as const;

/** A wyrm part at rest, and how the wave moves it: by round(across * sin(phase - i * WAVE.step)) on each axis. */
export interface WyrmPart extends Placed { across: { x: number; y: number }; i: number }

/** The links, tail first, then the head, which rides the wave of the last link. */
export function wyrmParts(): WyrmPart[] {
  const n = WYRM_LINKS.length;
  const across = WYRM_LINKS.map((_, i) => {
    const [ax, ay] = WYRM_LINKS[Math.max(0, i - 1)];
    const [bx, by] = WYRM_LINKS[Math.min(n - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const reach = WAVE.px * (i / (n - 1)) ** 1.2;
    return { x: (-(by - ay) / len) * reach, y: ((bx - ax) / len) * reach };
  });
  const links = WYRM_LINKS.map(([x, y, up], i) => ({
    ...centred(`wyrm-link-${i % 2 === 0 ? 'face' : 'edge'}${up ? '-up' : ''}`, x, y), across: across[i], i,
  }));
  return [...links, { ...centred('wyrm-head', WYRM_HEAD_AT.x, WYRM_HEAD_AT.y), across: across[n - 1], i: n - 1 }];
}

/**
 * Sparks fly off the first `links` links, up to `jitter` px about a link's middle, and only rise: from the coil's lower
 * turns, never the neck, so none rises into the HP bar.
 */
export const SPARKS = {
  links: 16, jitter: { x: 3, y: 2 }, everyMs: 70, lifeMs: { min: 150, max: 300 },
  speedX: 12, speedY: { min: -22, max: -4 },
} as const;
/** Now and then a bolt flickers where a spark would start, and stays put. */
export const BOLTS = { everyMs: 450, lifeMs: 110 } as const;

// The Fog of Demand: a wraith in a cloud of figures that never agree.

export const FOG = {
  wraith: { key: 'fog-wraith', x: -14, y: -46 },
  /** The wraith hovers, rising this far and back. */
  bob: { dx: 0, dy: -2, ms: 1500 },
  /** Sixty puffs, more behind than in front, each fading in and out over `ms`; a third of them are doubled. */
  ms: 4800, back: 36, front: 24, scales: [1, 1, 2], peak: { back: 0.4, front: 0.22 },
  /** Where puffs start, and how fast they drift, in px/s: either way across, mostly up, a doubled puff never reaching the HP bar. */
  zone: { x: -22, y: -34, w: 39, h: 22 },
  drift: { x: 2, up: 1.5, down: 0.5 },
  figures: [
    { text: '97.5%', x: -40, y: -45, shade: 'bone', ms: 1900, spacing: 0 },
    { text: '8.7%', x: 15, y: -40, shade: 'bone', ms: 2300, spacing: 0 },
    // M and W fill their whole cells (placeholders.ts), so a pixel of letter spacing keeps them apart.
    { text: '20 MW', x: -40, y: -14, shade: 'bone', ms: 2700, spacing: 1 },
  ],
  /** Each figure drifts up this far and back on its own period, and flickers down to `floor` alpha, never out of sight. */
  figureDrift: { dx: 0, dy: -2 },
  floor: 0.75,
} as const;

/** The hydra's parts at rest: the body, then a head on the end of each neck, left to right. */
export function hydraParts(): { body: Placed; heads: Placed[] } {
  const { body, heads } = HYDRA;
  return { body: { key: body.key, x: body.x, y: body.y }, heads: heads.map(({ x, y }, i) => ({ key: `hydra-head-${i}`, x, y })) };
}

export const WRAITH_OF_RISK = {
  /** The hourglass hangs a pixel clear of the floor, low enough that its hood, rising, stays under the HP bar. */
  glass: { key: 'risk-glass', x: -15, y: -47 },
  /** The arms hang from the mantle's ends (column 3 and 26 of the glass, row 11). */
  arms: [{ key: 'risk-arm-left', col: 3 - 8, row: 11 }, { key: 'risk-arm-right', col: 26 - 1, row: 11 }],
  /** The wraith hovers, rising this far and back; its arms reach a pixel lower on their own beat. */
  bob: { dx: 0, dy: -2, ms: 1500 },
  reach: { dx: 0, dy: 1, ms: 1100 },
  /** The eyes and the sand glow and dim, never out. */
  glow: { from: 0.7, to: 1, ms: 900 },
} as const;

/** Grains fall through the neck to the mound: where they start about the glass's corner, how fast and how long. */
export const SAND = { fall: { x: GLASS.mid - 1, y: GLASS.neck + 1, everyMs: 140, lifeMs: 450, speedY: 14, scale: 0.5 } } as const;

/** The wraith's parts at rest: the arms behind, the glass, the sand laid over the glass. */
export function wraithParts(): { glass: Placed; sand: Placed; arms: Placed[] } {
  const { glass, arms } = WRAITH_OF_RISK;
  return {
    glass: { key: glass.key, x: glass.x, y: glass.y },
    sand: { key: 'risk-sand', x: glass.x, y: glass.y },
    arms: arms.map(({ key, col, row }) => ({ key, x: glass.x + col, y: glass.y + row })),
  };
}

// The core: a dark heart, beating behind a cracked ring.

export const CORE = {
  /** The middle of the ring and the heart; the Ending's still `boss-core` puts it in the same place. */
  at: { x: 0, y: -25 },
  /** Each arc strays a pixel out along its middle and back, so the ring never quite holds still. */
  stray: [{ dx: 1, dy: -1, ms: 1300 }, { dx: 0, dy: 1, ms: 1700 }, { dx: -1, dy: 0, ms: 2100 }],
  /** One beat of the veins: up, half down, up, then a long fall to the resting glow. */
  beat: [[1, 90], [0.5, 120], [1, 90], [0.3, 520]],
  veinsRest: 0.3,
  /** Embers rise from the heart through the ring: where they start about the middle, how fast and how long. */
  embers: { x: -8, y: -6, w: 16, h: 10, everyMs: 300, lifeMs: 1000, speedX: 3, speedY: { min: -16, max: -8 }, scale: 0.5 },
} as const;

/** The core's parts at rest: the heart, the veins on its corner, the three arcs, all about CORE.at. */
export function coreParts(): { heart: Placed; veins: Placed; arcs: Placed[] } {
  const heart = centred('core-heart', CORE.at.x, CORE.at.y);
  return {
    heart,
    veins: { key: 'core-veins', x: heart.x, y: heart.y },
    arcs: RING.cracks.map((_, i) => centred(`core-ring-${i}`, CORE.at.x, CORE.at.y)),
  };
}

/** `boss-core` is 64 x 48 like the placeholder and the Ending stands it on the floor: the feet are its bottom middle. */
export const STILL = { w: 64, h: 48, feetX: 32, feetY: 48 } as const;
