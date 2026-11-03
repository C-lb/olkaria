// The four bosses (spec 4.2), one container each: the Grid Wyrm, the Debt Golem, the Fog of Demand and the core.
// Every part is a small texture painted once per game from rows of palette keys, so the art stays whole pixels at any
// zoom; a few particles and the digits font do the rest. A boss idles in a loop of tweens and, when hit, flashes bone
// white and recoils 3 px for 300 ms. Each one stays inside the box Battle keeps for it: x -40 to +38 and y -54 to 0
// about its feet, recoil included (world x 240 to 318 and y 30 to 84 at BOSS_X 280, the floor at 84), so the strike
// numbers and the HP bar never sit on it. The core's parts are also painted together as `boss-core`, the still image
// the Ending cracks.
import Phaser from 'phaser';
import { PALETTE, Painter, texture } from './placeholders';

export type BossId = 'grid' | 'debt' | 'fog' | 'core';

const P = PALETTE;
const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** A hit: the boss flashes bone for FLASH_MS and recoils RECOIL_PX, out fast and back slow, home after HIT_MS. */
const HIT_MS = 300;
const FLASH_MS = 100;
const RECOIL_PX = 3;
const BONE = hex(P.bone);

/** Sprite rows: each character is a palette colour, '.' is clear. */
const INK: Readonly<Record<string, string>> = {
  o: P.outline, n: P.night, D: P.stoneDeep, d: P.stoneDark, s: P.stone, l: P.stoneLight, p: P.stonePale,
  B: P.bone, b: P.boneDim, T: P.steel, t: P.steelDark, C: P.clothDark, c: P.cloth, e: P.ember, a: P.amber, W: P.white,
};

function paint(p: Painter, rows: readonly string[], x0 = 0, y0 = 0): void {
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const colour: string | undefined = INK[row[x]];
      if (colour === undefined) continue;
      p.ctx.fillStyle = colour;
      p.ctx.fillRect(x0 + x, y0 + y, 1, 1);
    }
  });
}

function sprite(scene: Phaser.Scene, key: string, rows: readonly string[]): void {
  texture(scene, key, rows[0].length, rows.length, (p) => paint(p, rows));
}

/** The same rows stood on end: a chain link turned a quarter. */
const upright = (rows: readonly string[]): string[] => [...rows[0]].map((_, x) => rows.map((row) => row[x]).join(''));

/** Rings every painted pixel of a grid of palette keys with outline on the clear pixels beside it. */
function outlined(cells: readonly (readonly string[])[]): string[] {
  const at = (x: number, y: number): string => cells[y]?.[x] ?? '.';
  return cells.map((row, y) => row.map((k, x) => {
    if (k !== '.') return k;
    const near = [at(x + 1, y), at(x - 1, y), at(x, y + 1), at(x, y - 1)];
    return near.some((n) => n !== '.' && n !== 'o') ? 'o' : '.';
  }).join(''));
}

// ---- Particles: white, so a tint gives the exact colour --------------------------------------------------

const SPARK = ['.W.', 'WWW', '.W.'];
const BOLT = ['..W.', '.W..', 'WWWW', '..W.', '.W..', 'W...'];
const MOTE = ['WW', 'WW'];

// ---- The Grid Wyrm: a serpent of chain links coiled up from the floor, lightning crawling over it ----------

const LINK_FACE = [
  '..ooooooo..',
  '.oTTTTTTlo.',
  'oTTo...olso',
  'oTo.....oso',
  'oTo.....oso',
  'oslo...osso',
  '.ossssssso.',
  '..ooooooo..',
];
const LINK_EDGE = [
  '.ooooooooo.',
  'oTTTTTTTTlo',
  'ossssssssso',
  '.ooooooooo.',
];
const WYRM_HEAD = [
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
/** Where each link lies, tail on the floor to the neck: its centre, and whether it stands on end at a turn of the coil. */
const WYRM_LINKS: readonly (readonly [x: number, y: number, upright: boolean])[] = [
  [26, -5, false], [20, -5, false], [14, -5, false], [7, -5, false], [1, -5, false], [-5, -7, false], [-11, -10, false],
  [-15, -14, true], [-16, -20, true], [-11, -24, false], [-5, -26, false], [1, -27, false], [8, -27, false],
  [14, -27, false], [20, -30, false], [22, -35, true], [17, -39, false], [11, -42, false], [5, -43, false],
  [-1, -43, false], [-7, -43, false],
];
/** The head's centre: it faces the party, left of the neck. */
const WYRM_HEAD_AT = { x: -20, y: -44 } as const;
/** The coil ripples: a wave runs up the chain, still at the tail and WAVE_PX at the neck, once every WAVE_MS. */
const WAVE_PX = 1.6;
const WAVE_MS = 2600;
const WAVE_STEP = 0.55;

// ---- The Debt Golem: stacked stone in chains, its debt figures carved into its chest ----------------------

const GOLEM_BODY = [
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
const GOLEM_LEGS = [
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollddddddsdddo....ollddddddsdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'ollsssssssdddo....ollsssssssdddo',
  'oddddddddddddo....oddddddddddddo',
  'oddddddddddddo....oddddddddddddo',
  'oddddddddddddo....oddddddddddddo',
];
/** A chain hanging from each fist. */
const SHACKLE = ['.T.', 'T.t', '.t.', '.T.', '.t.', '.T.', 'T.t', '.t.', '.T.', '.t.'];
/** The eyes flaring, laid over the eyes in GOLEM_BODY (columns 26 and 32, row 5). */
const GOLEM_EYES = ['BB....BB', 'aa....aa'];
/** The body hangs from its top-left corner here, about the feet; the chest's carved panel is columns 18 to 41, rows 16 to 28. */
const GOLEM_BODY_AT = { x: -32, y: -50 } as const;
const GOLEM_LEGS_AT = { x: -18, y: -12 } as const;
const GOLEM_CARVINGS = [{ text: '68%', col: 23, row: 16 }, { text: '48.5%', col: 18, row: 23 }] as const;
const GOLEM_FISTS = [8, 51] as const;

// ---- The Fog of Demand: a wraith in a cloud of figures that never agree -----------------------------------

const WRAITH = [
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
/** The wraith hovers this high, its feet in the fog. */
const WRAITH_AT = { x: 0, y: -6 } as const;
/** Sixty puffs drift about the wraith, more behind than in front, each fading in and out over FOG_MS. */
const FOG_MS = 4800;
const FOG_BACK = 36;
const FOG_FRONT = 24;
/** Where puffs start; at FOG_DRIFT px/s at most they end inside the box, half a doubled puff included. */
const FOG_ZONE = { x: -22, y: -38, w: 39, h: 24 } as const;
const FOG_DRIFT = 2;
/** The figures that never agree: where each floats, how it is tinted, and its own period. */
const FOG_FIGURES = [
  { text: '97.5%', x: -40, y: -45, tint: P.bone, ms: 1900, spacing: 0 },
  { text: '8.7%', x: 15, y: -40, tint: P.boneDim, ms: 2300, spacing: 0 },
  // M and W fill their whole cells (placeholders.ts), so a pixel of letter spacing keeps them apart.
  { text: '20 MW', x: -40, y: -14, tint: P.bone, ms: 2700, spacing: 1 },
] as const;

// ---- The core: a dark heart, beating behind a cracked ring ------------------------------------------------

const HEART = [
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
/** The fissures that glow with each beat, laid over HEART. */
const VEINS = [
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
/** The ring: three arcs between three cracks (degrees, y down), lit from the upper left. */
const RING = { size: 48, outer: 22, inner: 17, cracks: [-100, 20, 140], gap: 7 } as const;
/** Each arc strays a pixel out along its middle and back, so the ring never quite holds still. */
const RING_STRAY: readonly (readonly [dx: number, dy: number, ms: number])[] = [[1, -1, 1300], [0, 1, 1700], [-1, 0, 2100]];
/**
 * The core's middle, about its feet, and so the ring's: high enough that the lower arc, straying down, stays off the
 * floor. The Ending's still `boss-core` puts it in the same place.
 */
const CORE_AT = { x: 0, y: -25 } as const;
/** `boss-core` is 64 x 48 like the placeholder and stands on the floor, so the core's middle is this far into it. */
const STILL = { w: 64, h: 48, x: 32 + CORE_AT.x, y: 48 + CORE_AT.y } as const;
/** One beat: up, half down, up, then a long fall to the resting glow. */
const BEAT: readonly (readonly [alpha: number, ms: number])[] = [[1, 90], [0.5, 120], [1, 90], [0.3, 520]];
const VEINS_REST = 0.3;

function ringArc(i: number): string[] {
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

// ---- Textures ---------------------------------------------------------------------------------------------

/**
 * The textures each boss is built from, the digits font's among them where it carries figures; if any is missing the
 * boss falls back to its placeholder image.
 */
const ART: Record<BossId, readonly string[]> = {
  grid: ['wyrm-link-face', 'wyrm-link-edge', 'wyrm-link-face-up', 'wyrm-link-edge-up', 'wyrm-head', 'boss-spark', 'boss-bolt'],
  debt: ['golem-body', 'golem-legs', 'golem-shackle', 'golem-eyes', 'boss-mote', 'digits'],
  fog: ['fog-wraith', 'boss-puff', 'digits'],
  core: ['core-heart', 'core-veins', 'core-ring-0', 'core-ring-1', 'core-ring-2', 'boss-mote'],
};

/**
 * Paints every boss texture once per game, and `boss-core`, the whole core as one still image for the Ending. Boot
 * calls it before makePlaceholders, so the placeholder core is never painted over it; buildBoss calls it again, which
 * paints nothing twice.
 */
export function makeBossArt(scene: Phaser.Scene): void {
  sprite(scene, 'boss-spark', SPARK);
  sprite(scene, 'boss-bolt', BOLT);
  sprite(scene, 'boss-mote', MOTE);
  texture(scene, 'boss-puff', 7, 7, (p) => {
    p.ctx.globalAlpha = 0.5;
    p.disc(3, 3, 3.2, P.white);
    p.ctx.globalAlpha = 1;
    p.disc(3, 3, 2, P.white);
  });
  sprite(scene, 'wyrm-link-face', LINK_FACE);
  sprite(scene, 'wyrm-link-edge', LINK_EDGE);
  sprite(scene, 'wyrm-link-face-up', upright(LINK_FACE));
  sprite(scene, 'wyrm-link-edge-up', upright(LINK_EDGE));
  sprite(scene, 'wyrm-head', WYRM_HEAD);
  sprite(scene, 'golem-body', GOLEM_BODY);
  sprite(scene, 'golem-legs', GOLEM_LEGS);
  sprite(scene, 'golem-shackle', SHACKLE);
  sprite(scene, 'golem-eyes', GOLEM_EYES);
  sprite(scene, 'fog-wraith', WRAITH);
  sprite(scene, 'core-heart', HEART);
  sprite(scene, 'core-veins', VEINS);
  const arcs = RING.cracks.map((_, i) => ringArc(i));
  arcs.forEach((rows, i) => sprite(scene, `core-ring-${i}`, rows));
  // The Ending's still core: every part where the Battle's core puts it, the veins lit.
  texture(scene, 'boss-core', STILL.w, STILL.h, (p) => {
    paint(p, HEART, STILL.x - HEART[0].length / 2, STILL.y - HEART.length / 2);
    paint(p, VEINS, STILL.x - HEART[0].length / 2, STILL.y - HEART.length / 2);
    for (const rows of arcs) paint(p, rows, STILL.x - RING.size / 2, STILL.y - RING.size / 2);
  });
}

// ---- The boss -----------------------------------------------------------------------------------------------

type Part = Phaser.GameObjects.Image | Phaser.GameObjects.BitmapText;

/** What a boss's parts do: go back to where they rest, and start the idle loops. */
interface Rig {
  rest(): void;
  loop(): Phaser.Tweens.BaseTween[];
}

/** A loop that moves parts by whole pixels, from where they rest to (dx, dy) and back, in 2 x `ms`. */
function stray(scene: Phaser.Scene, parts: readonly Part[], dx: number, dy: number, ms: number, delay = 0): Phaser.Tweens.Tween {
  const home = parts.map((part) => ({ part, x: part.x, y: part.y }));
  const k = { t: 0 };
  return scene.tweens.add({
    targets: k, t: 1, duration: ms, delay, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    onUpdate: () => {
      for (const h of home) h.part.setPosition(h.x + Math.round(dx * k.t), h.y + Math.round(dy * k.t));
    },
  });
}

/** Out over the first third, back over the rest: 0, then 1 at a third, then 0 at the end. */
const kick = (t: number): number => (t < 1 / 3 ? 1 - (1 - 3 * t) ** 2 : 1 - ((t - 1 / 3) * 1.5) ** 2);

/**
 * A boss: its parts in one container at its feet, an idle loop, and a hit. idle() (re)starts the loop from rest, so
 * a scene that has killed every tween can call it again; reset() ends a hit early.
 */
export class Boss extends Phaser.GameObjects.Container {
  private readonly home: { x: number; y: number };
  /** The parts a hit flashes, and the tint each goes back to (null: none). */
  private readonly flashes: { part: Part; rest: number | null }[] = [];
  private readonly rig: Rig;
  private loops: Phaser.Tweens.BaseTween[] = [];
  private recoil: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, readonly bossId: BossId, x: number, y: number) {
    super(scene, x, y);
    this.home = { x, y };
    scene.add.existing(this);
    const art = ART[bossId].every((key) => scene.textures.exists(key));
    this.rig = art ? RIGS[bossId](scene, this) : placeholder(scene, this, bossId);
    // A boss destroyed before its scene stops takes its loops with it, so no tween keeps moving its parts.
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      for (const loop of this.loops) loop.stop();
      this.recoil?.stop();
    });
  }

  /** Adds a part that a hit flashes; `rest` is the tint it goes back to. */
  part<T extends Part>(part: T, rest: number | null = null): T {
    this.add(part);
    this.flashes.push({ part, rest });
    return part;
  }

  /** Starts the idle loop from rest, stopping the one before. */
  idle(): this {
    for (const loop of this.loops) loop.stop();
    this.reset();
    this.setPosition(this.home.x, this.home.y);
    this.rig.rest();
    this.loops = this.rig.loop();
    return this;
  }

  /** Bone white for FLASH_MS and a RECOIL_PX recoil, whole pixels; back where it stood after HIT_MS. A second hit restarts it. */
  hit(): this {
    this.recoil?.stop();
    this.flash(true);
    const k = { t: 0 };
    let lit = true;
    this.recoil = this.scene.tweens.add({
      targets: k, t: 1, duration: HIT_MS,
      onUpdate: () => {
        this.x = this.home.x + Math.round(RECOIL_PX * kick(k.t));
        if (lit && k.t * HIT_MS >= FLASH_MS) {
          lit = false;
          this.flash(false);
        }
      },
      onComplete: () => {
        this.recoil = null;
        this.reset();
      },
    });
    return this;
  }

  /** Ends a hit: untinted, back at its place. The idle loop carries on. */
  reset(): this {
    this.recoil?.stop();
    this.recoil = null;
    this.x = this.home.x;
    this.flash(false);
    return this;
  }

  private flash(on: boolean): void {
    for (const { part, rest } of this.flashes) {
      if (on) part.setTintFill(BONE);
      else if (rest === null) part.clearTint();
      else part.setTint(rest);
    }
  }
}

/** Particles start on a whole pixel somewhere in this rectangle, about the emitter. */
const within = (x: number, y: number, w: number, h: number): Phaser.Types.GameObjects.Particles.EmitZoneData => ({
  type: 'random',
  source: {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like): void => {
      point.x = x + Math.floor(Math.random() * w);
      point.y = y + Math.floor(Math.random() * h);
    },
  },
});

/** An image placed by its top-left corner, so odd sizes still land on whole pixels. */
const image = (scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image =>
  scene.add.image(x, y, key).setOrigin(0, 0);

/** An image whose middle is (x, y), its corner on the whole pixel at or before half its size. */
function centred(scene: Phaser.Scene, x: number, y: number, key: string): Phaser.GameObjects.Image {
  const img = image(scene, x, y, key);
  return img.setPosition(x - Math.floor(img.width / 2), y - Math.floor(img.height / 2));
}

function grid(scene: Phaser.Scene, boss: Boss): Rig {
  const n = WYRM_LINKS.length;
  const links = WYRM_LINKS.map(([x, y, up], i) =>
    boss.part(centred(scene, x, y, `wyrm-link-${i % 2 === 0 ? 'face' : 'edge'}${up ? '-up' : ''}`)));
  const head = boss.part(centred(scene, WYRM_HEAD_AT.x, WYRM_HEAD_AT.y, 'wyrm-head'));
  const rests = [...links, head].map((part) => ({ part, x: part.x, y: part.y }));
  // Each link ripples across the coil, along the chain's normal where it lies, more toward the neck; the head rides the last.
  const across = WYRM_LINKS.map((_, i) => {
    const [ax, ay] = WYRM_LINKS[Math.max(0, i - 1)];
    const [bx, by] = WYRM_LINKS[Math.min(n - 1, i + 1)];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const reach = WAVE_PX * (i / (n - 1)) ** 1.2;
    return { x: (-(by - ay) / len) * reach, y: ((bx - ax) / len) * reach };
  });
  const wave = { phase: 0 };
  const lay = (): void => {
    rests.forEach((r, i) => {
      const j = Math.min(i, n - 1);
      const s = Math.sin(wave.phase - j * WAVE_STEP);
      r.part.setPosition(r.x + Math.round(across[j].x * s), r.y + Math.round(across[j].y * s));
    });
  };
  // Lightning crawls over the chain: sparks off a link here and there, and now and then a bolt.
  const onChain = {
    getRandomPoint: (point: Phaser.Types.Math.Vector2Like): void => {
      const link = links[Math.floor(Math.random() * n)];
      point.x = link.x + link.width / 2 + Math.round((Math.random() - 0.5) * 6);
      point.y = link.y + link.height / 2 + Math.round((Math.random() - 0.5) * 4);
    },
  };
  // Sparks only rise, so none falls through the floor.
  boss.add(scene.add.particles(0, 0, 'boss-spark', {
    emitZone: { type: 'random', source: onChain }, frequency: 70, quantity: 1, lifespan: { min: 150, max: 300 },
    speedX: { min: -15, max: 15 }, speedY: { min: -22, max: -4 },
    tint: [hex(P.bone), hex(P.steel), hex(P.amber)], alpha: { start: 1, end: 0 },
  }));
  boss.add(scene.add.particles(0, 0, 'boss-bolt', {
    emitZone: { type: 'random', source: onChain }, frequency: 450, quantity: 1, lifespan: 110, speed: 0,
    scaleX: [-1, 1], tint: hex(P.bone), alpha: { start: 1, end: 0.2 },
  }));
  return {
    rest: () => {
      wave.phase = 0;
      lay();
    },
    loop: () => [
      scene.tweens.add({ targets: wave, phase: { from: 0, to: Math.PI * 2 }, duration: WAVE_MS, repeat: -1, onUpdate: lay }),
    ],
  };
}

function debt(scene: Phaser.Scene, boss: Boss): Rig {
  const { x: bx, y: by } = GOLEM_BODY_AT;
  boss.part(image(scene, GOLEM_LEGS_AT.x, GOLEM_LEGS_AT.y, 'golem-legs'));
  const body = boss.part(image(scene, bx, by, 'golem-body'));
  const eyes = boss.part(image(scene, bx + 26, by + 5, 'golem-eyes'));
  const carvings = GOLEM_CARVINGS.map(({ text, col, row }) =>
    boss.part(scene.add.bitmapText(bx + col, by + row, 'digits', text).setTint(hex(P.amber)), hex(P.amber)));
  // A chain from each fist, hung a pixel inside it so the two never part.
  const shackles = GOLEM_FISTS.map((col) => boss.part(image(scene, bx + col - 1, by + GOLEM_BODY.length - 2, 'golem-shackle')));
  // Stone crumbles off its shoulders now and then.
  boss.add(scene.add.particles(0, 0, 'boss-mote', {
    emitZone: within(bx + 4, by + 9, 52, 2), frequency: 650, quantity: 1,
    lifespan: 700, speedX: { min: -4, max: 4 }, speedY: 0, gravityY: 80, scale: 0.5,
    tint: [hex(P.stoneLight), hex(P.stone)], alpha: { start: 1, end: 0 },
  }));
  const breathing: Part[] = [body, eyes, ...carvings];
  const rests = [...breathing, ...shackles].map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      eyes.setAlpha(0.15);
    },
    loop: () => [
      stray(scene, breathing, 0, -1, 1100),
      stray(scene, shackles, 1, 0, 1700, 300),
      scene.tweens.add({ targets: eyes, alpha: 0.9, duration: 1300, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 }),
    ],
  };
}

function fog(scene: Phaser.Scene, boss: Boss): Rig {
  const puffs = (count: number, peak: number): Phaser.GameObjects.Particles.ParticleEmitter =>
    scene.add.particles(0, 0, 'boss-puff', {
      emitZone: within(FOG_ZONE.x, FOG_ZONE.y, FOG_ZONE.w, FOG_ZONE.h),
      lifespan: FOG_MS, frequency: FOG_MS / count, quantity: 1, maxAliveParticles: count, advance: FOG_MS,
      speedX: { min: -FOG_DRIFT, max: FOG_DRIFT }, speedY: { min: -FOG_DRIFT * 0.75, max: FOG_DRIFT * 0.25 },
      scale: [1, 1, 2], tint: [hex(P.stonePale), hex(P.stoneLight), hex(P.boneDim)],
      alpha: { onEmit: () => 0, onUpdate: (_particle, _key, t) => peak * Math.sin(Math.PI * t) },
    });
  boss.add(puffs(FOG_BACK, 0.4));
  const wraith = boss.part(scene.add.image(WRAITH_AT.x, WRAITH_AT.y, 'fog-wraith').setOrigin(0.5, 1));
  boss.add(puffs(FOG_FRONT, 0.22));
  const figures = FOG_FIGURES.map(({ text, x, y, tint, spacing }) =>
    boss.part(scene.add.bitmapText(x, y, 'digits', text).setLetterSpacing(spacing).setTint(hex(tint)), hex(tint)));
  const rests = [wraith, ...figures].map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      for (const f of figures) f.setAlpha(1);
    },
    loop: () => [
      stray(scene, [wraith], 0, -2, 1500),
      ...figures.flatMap((f, i) => [
        stray(scene, [f], 0, -2, FOG_FIGURES[i].ms, i * 400),
        scene.tweens.add({
          targets: f, alpha: 0.55, duration: FOG_FIGURES[i].ms / 2, delay: i * 250, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        }),
      ]),
    ],
  };
}

function core(scene: Phaser.Scene, boss: Boss): Rig {
  const { x, y } = CORE_AT;
  boss.part(scene.add.image(x, y, 'core-heart'));
  // The veins share the heart's top-left corner, as in `boss-core`.
  const veins = boss.part(image(scene, x - HEART[0].length / 2, y - HEART.length / 2, 'core-veins'));
  const arcs = RING.cracks.map((_, i) => boss.part(scene.add.image(x, y, `core-ring-${i}`)));
  // Embers rise from the heart through the ring.
  boss.add(scene.add.particles(0, 0, 'boss-mote', {
    emitZone: within(x - 8, y - 6, 16, 10), frequency: 300, quantity: 1,
    lifespan: 1000, speedX: { min: -3, max: 3 }, speedY: { min: -16, max: -8 }, scale: 0.5,
    tint: [hex(P.amber), hex(P.ember)], alpha: { start: 1, end: 0 },
  }));
  const rests = arcs.map((part) => ({ part, x: part.x, y: part.y }));
  return {
    rest: () => {
      for (const r of rests) r.part.setPosition(r.x, r.y);
      veins.setAlpha(VEINS_REST);
    },
    loop: () => [
      scene.tweens.chain({ targets: veins, loop: -1, tweens: BEAT.map(([alpha, duration]) => ({ alpha, duration })) }),
      ...arcs.map((arc, i) => stray(scene, [arc], RING_STRAY[i][0], RING_STRAY[i][1], RING_STRAY[i][2])),
    ],
  };
}

const RIGS: Record<BossId, (scene: Phaser.Scene, boss: Boss) => Rig> = { grid, debt, fog, core };

/** The boss's placeholder image, breathing a pixel up and down: what Battle showed before the art pass. */
function placeholder(scene: Phaser.Scene, boss: Boss, id: BossId): Rig {
  const img = boss.part(scene.add.image(0, 0, `boss-${id}`).setOrigin(0.5, 1));
  return {
    rest: () => img.setPosition(0, 0),
    loop: () => [stray(scene, [img], 0, -1, 900)],
  };
}

/** Builds a boss at its feet (x, y), with its idle loop not yet started: call idle() once it stands where it should. */
export function buildBoss(scene: Phaser.Scene, id: BossId, x: number, y: number): Boss {
  makeBossArt(scene);
  return new Boss(scene, id, x, y);
}
