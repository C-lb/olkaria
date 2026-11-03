// The bosses' data, which bosses.ts draws: the sprite rows, where every part sits about the boss's feet, how far its
// idle loop and a hit move it, and where its particles may go. No Phaser here, so tests/bosses.test.ts can hold each
// boss to the box Battle keeps for it.
import type { PALETTE } from './placeholders';

export type BossId = 'grid' | 'debt' | 'fog' | 'core';
export type Shade = keyof typeof PALETTE;
/** A range of whole-pixel offsets, least to most. */
export type Span = readonly [min: number, max: number];

/** Sprite rows: each character names a palette shade, '.' is clear. */
export const INK: Readonly<Record<string, Shade>> = {
  o: 'outline', n: 'night', D: 'stoneDeep', d: 'stoneDark', s: 'stone', l: 'stoneLight', p: 'stonePale',
  B: 'bone', b: 'boneDim', T: 'steel', t: 'steelDark', C: 'clothDark', c: 'cloth', e: 'ember', a: 'amber', W: 'white',
};

/** A hit: bone for `flashMs`, a recoil of `recoilPx` to the right, out fast and back slow, home after `ms`. */
export const HIT = { ms: 300, flashMs: 100, recoilPx: 3 } as const;

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

export const GOLEM_BODY = [
  '......................osppppppppppppso......................',
  '......................ollsssssoossdddo......................',
  '......................ollsssssssosdddo......................',
  '......................ollsssssssssdddo......................',
  '......................oldddddddddddddo......................',
  '......................olloaaossoaaoddo......................',
  '......................olloaaossoaaoddo......................',
  '......................ollsssssssssdddo......................',
  '....oooooooooo........ollsssssssssdddo........oooooooooo....',
  '...olllllllllsooooooooollsoooooooodddooooooooolllllllllso...',
  '..olllpllllllppppppppppsssssssssssdddpppppppppplpllllllsso..',
  '..ollpssssssllllllllllllllllllllllllllllllllllllssssssssso..',
  '..ollsossssslllsssssssssssssssssssssssssssssddddssssssssso..',
  '..ollssoossslllsssssssssssssssssssssssssssssddddssssssssso..',
  '..ollssssssslllsssssssssssssssssssssssssssssddddssssssssso..',
  '..ollsssossslllssoooooooooooooooooooooooooosddddssssssssso..',
  '..ossssssssslllssoddddddddddddddddddddddddlsddddssssssssso..',
  '..ossdddddddlllssoddddddddddddddddddddddddlsddddddddddddso..',
  '..ossdddddddllossoddddddddddddddddddddddddlsddddddddddddso..',
  '...osllssssdlllosoddddddddddddddddddddddddlsddddlssssddso...',
  '....ollssssdlllosoddddddddddddddddddddddddlsddddlssssddo....',
  '....ollssssdllossoddddddddddddddddddddddddlsddddlssssddo....',
  '....oTTssssTTlossoddddddddddddddddddddddddlsdddTTssssTToooo.',
  '...oTooTTTTooTTTToddddddddddddddddddddddddlsddTooTTTTooTTTTo',
  '....ottssssttllssoddddddddddddddddddddddddlsdddttssssttoooo.',
  '....ollssssdlllssoddddddddddddddddddddddddlsddddlssssddo....',
  '...oollssssdlllssoddddddddddddddddddddddddlsddodlssssddo....',
  '..oTTllssTTdlllssoddddddddddddddddddddddddlsdodTTssssTToooo.',
  '.oTooTTTTooTTTTssoddddddddddddddddddddddddlsdoTooTTTTooTTTTo',
  '..ottllllttllllssolllllllllllllllllllllllllsddottllllttlloo.',
  '..ollllllllllllsssssssssssssssssssssssssssssddddlllllllllo..',
  '..ollssssssslTTssssTTssssTTssssTTssssTTssssTTdddssssssdddo..',
  '..ollsssssssTooTTTTooTTTTooTTTTooTTTTooTTTTooTTTTsssssdddo..',
  '..ollsdssdsslttssssttssssttssssttssssttssssttddddssdssdddo..',
  '..ollsdssdsslllsssssssssssssssssssssssssssssdddddssdssdddo..',
  '..ollsdssdssdddddddddddddddddddddddddddddddddddddssdssdddo..',
  '..ollsssssssddddddddddddddddddddddddddddddddddddssssssdddo..',
  '..oldddddddddddddddddddddddddddddddddddddddddddddddddddddo..',
  '..osddddddddddsoooooooooooooooooooooooooooooosddddddddddso..',
  '...osssssssssso..............................osssssssssso...',
];
export const GOLEM_LEGS = [
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollddddddsdddo....ollddddddsdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'oddddddddddddo....oddddddddddddo',
  'oddddddddddddo....oddddddddddddo',
  'oddddddddddddo....oddddddddddddo',
];
/** A chain hanging from each fist. */
export const SHACKLE = ['.T.', 'T.t', '.t.', '.T.', '.t.', '.T.', 'T.t', '.t.', '.T.', '.t.'];
/** The eyes flaring, laid over the eyes in GOLEM_BODY (columns 26 and 32, row 5). */
export const GOLEM_EYES = ['BB....BB', 'aa....aa'];

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

/** Every sprite's rows by texture key, the ring's arcs included. */
export const SPRITES: Readonly<Record<string, readonly string[]>> = {
  'boss-spark': SPARK, 'boss-bolt': BOLT, 'boss-mote': MOTE,
  'wyrm-link-face': LINK_FACE, 'wyrm-link-edge': LINK_EDGE,
  'wyrm-link-face-up': upright(LINK_FACE), 'wyrm-link-edge-up': upright(LINK_EDGE), 'wyrm-head': WYRM_HEAD,
  'golem-body': GOLEM_BODY, 'golem-legs': GOLEM_LEGS, 'golem-shackle': SHACKLE, 'golem-eyes': GOLEM_EYES,
  'fog-wraith': WRAITH, 'core-heart': HEART, 'core-veins': VEINS,
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

// The Debt Golem: stacked stone in chains, its debt figures carved into its chest.

export const GOLEM = {
  /** Low enough that its head, breathing, stays clear of the HP bar: the torso's bottom edge is the legs' top row. */
  legs: { key: 'golem-legs', x: -18, y: -10 },
  body: { key: 'golem-body', x: -32, y: -48 },
  /** The eyes, the carved figures (the panel is columns 18 to 41, rows 16 to 28) and the fists, about the body's corner. */
  eyes: { col: 26, row: 5 },
  carvings: [{ text: '68%', col: 23, row: 16 }, { text: '48.5%', col: 18, row: 23 }],
  carvingShade: 'amber',
  fists: [8, 51],
  /** It breathes a pixel up (body, eyes, figures), its chains sway a pixel right, and its eyes flare. */
  breath: { dx: 0, dy: -1, ms: 1100 },
  sway: { dx: 1, dy: 0, ms: 1700 },
  swayDelay: 300,
  eyeGlow: { from: 0.15, to: 0.9, ms: 1300 },
  /** Stone falls from the shoulders: where it starts about the body's corner, how fast and how long. */
  dust: { x: 4, y: 9, w: 52, h: 2, everyMs: 650, lifeMs: 700, speedX: 4, gravityY: 80, scale: 0.5 },
} as const;

/** The golem's parts at rest: legs, body, the eyes over it, a chain from each fist (hung a pixel inside it), the figures. */
export function golemParts(): { legs: Placed; body: Placed; eyes: Placed; shackles: Placed[]; carvings: Figure[] } {
  const { body } = GOLEM;
  return {
    legs: GOLEM.legs,
    body,
    eyes: { key: 'golem-eyes', x: body.x + GOLEM.eyes.col, y: body.y + GOLEM.eyes.row },
    shackles: GOLEM.fists.map((col) => ({
      key: 'golem-shackle', x: body.x + col - Math.floor(SHACKLE[0].length / 2), y: body.y + GOLEM_BODY.length - 2,
    })),
    carvings: GOLEM.carvings.map(({ text, col, row }) => ({ text, x: body.x + col, y: body.y + row, spacing: 0 })),
  };
}

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
