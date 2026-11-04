// Placeholder art, drawn into canvas textures at boot so the game runs before the art pass (Task 11) and keeps
// running if an asset fails to load. The class figures are painted from shared/figures.ts, which the phone draws
// too. Everything is whole pixels, so the textures stay crisp at any zoom.
import Phaser from 'phaser';
import { FIGURES, type FigureRect } from '../../shared/figures';
import { PALETTE } from '../../shared/palette';

// The palette lives in shared/ so the phone paints from it too; host files go on importing it from here.
export { PALETTE };

/**
 * The characters of the `digits` bitmap font: damage numbers, enough for an "HP 100/400" label, and the M and W of the
 * Fog of Demand's "20 MW" (bosses.ts). M and W fill their whole 5 px cell, so a label that sets them side by side adds
 * a pixel of letter spacing.
 */
export const DIGIT_CHARS = '0123456789+-.%/ HPMW';

/** A rectangle of colour, as the class figures are drawn from (shared/figures.ts). */
type Rect = FigureRect;

/** Draws whole-pixel shapes on a texture's canvas. */
export class Painter {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  rects(list: readonly Rect[]): void {
    for (const [x, y, w, h, colour] of list) {
      this.ctx.fillStyle = colour;
      this.ctx.fillRect(x, y, w, h);
    }
  }

  /** A filled circle of whole pixels around (cx, cy). */
  disc(cx: number, cy: number, r: number, colour: string): void {
    this.ctx.fillStyle = colour;
    const reach = Math.ceil(r);
    for (let y = -reach; y <= reach; y++) {
      for (let x = -reach; x <= reach; x++) {
        if (x * x + y * y <= r * r + r * 0.6) this.ctx.fillRect(Math.round(cx + x), Math.round(cy + y), 1, 1);
      }
    }
  }

  /** A ring of whole pixels, with gaps where `open(angle)` says so (the cracks in the core). */
  ring(cx: number, cy: number, outer: number, inner: number, colour: string, open: (angle: number) => boolean = () => false): void {
    this.ctx.fillStyle = colour;
    for (let y = -outer; y <= outer; y++) {
      for (let x = -outer; x <= outer; x++) {
        const d = x * x + y * y;
        if (d <= outer * outer + outer * 0.6 && d >= inner * inner && !open(Math.atan2(y, x))) this.ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }

  /** Pixels from rows of text: '#' paints, anything else is left clear. */
  bits(x0: number, y0: number, rows: readonly string[], colour: string): void {
    this.ctx.fillStyle = colour;
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] === '#') this.ctx.fillRect(x0 + x, y0 + y, 1, 1);
    });
  }
}

/** Paints a canvas texture once: a key that already exists, a loaded asset say, is left alone. */
export function texture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (p: Painter) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, width, height);
  if (tex === null) return;
  draw(new Painter(tex.getContext()));
  tex.refresh();
}

const P = PALETTE;

// ---- Bosses, 64 x 48 ------------------------------------------------------------------------------------

function gridWyrm(p: Painter): void {
  // A serpent of chain coiling up to the right, its head raised, lightning above.
  const steps = 18;
  const at = (i: number) => {
    const t = i / (steps - 1);
    return { x: 6 + t * 44, y: 40 - Math.sin(t * Math.PI * 2.2) * 8 - t * 16, r: 5 - t * 1.6 };
  };
  for (let i = 0; i < steps; i++) p.disc(at(i).x, at(i).y + 1, at(i).r + 1, P.outline);
  for (let i = 0; i < steps; i++) p.disc(at(i).x, at(i).y, at(i).r, i % 2 === 0 ? P.stoneLight : P.stone);
  p.disc(54, 14, 6, P.outline);
  p.disc(54, 13, 5.5, P.stoneLight);
  p.rects([[57, 15, 6, 2, P.stone], [51, 11, 2, 2, P.amber], [56, 11, 2, 2, P.amber]]);
  p.bits(20, 2, ['##.....', '.##....', '..###..', '....##.', '.....##'], P.bone);
  p.bits(36, 4, ['#....', '.#...', '.###.', '...#.', '....#'], P.boneDim);
}

function debtGolem(p: Painter): void {
  p.rects([
    [19, 36, 10, 12, P.stoneDark], [35, 36, 10, 12, P.stoneDark],
    [14, 14, 36, 23, P.stone], [20, 18, 24, 14, P.stoneLight],
    [26, 3, 12, 11, P.stone], [27, 4, 10, 1, P.stoneLight], [29, 8, 2, 2, P.amber], [33, 8, 2, 2, P.amber],
    [4, 15, 10, 21, P.stone], [50, 15, 10, 21, P.stone], [3, 33, 12, 9, P.stoneLight], [49, 33, 12, 9, P.stoneLight],
    [24, 21, 1, 7, P.outline], [25, 27, 4, 1, P.outline], [38, 19, 1, 5, P.outline], [36, 24, 3, 1, P.outline],
  ]);
  // A chain across the chest.
  for (let i = 0; i < 9; i++) p.rects([[15 + i * 4, 30 - i, 2, 2, P.boneDim]]);
}

function fogOfDemand(p: Painter): void {
  const puffs: readonly (readonly [number, number, number])[] = [
    [10, 34, 8], [22, 38, 9], [36, 37, 10], [50, 34, 8], [16, 26, 7], [46, 25, 7], [30, 30, 9],
  ];
  p.ctx.globalAlpha = 0.55;
  for (const [x, y, r] of puffs) p.disc(x, y, r, P.stonePale);
  p.ctx.globalAlpha = 1;
  // The wraith: a hood with a pale face and amber eyes, its body fraying into the fog.
  p.rects([
    [27, 4, 10, 4, P.clothDark], [25, 8, 14, 14, P.clothDark], [27, 22, 10, 6, P.clothDark], [29, 28, 6, 4, P.clothDark],
    [28, 10, 8, 7, P.outline], [29, 12, 2, 2, P.amber], [33, 12, 2, 2, P.amber],
  ]);
  p.ctx.globalAlpha = 0.7;
  for (const [x, y, r] of [[18, 40, 6], [44, 41, 6], [31, 42, 7]] as const) p.disc(x, y, r, P.stoneLight);
  p.ctx.globalAlpha = 1;
}

function deadlockCore(p: Painter): void {
  // The exposed heart inside a cracked ring.
  const cracked = (a: number) => Math.abs(Math.sin(a * 3 + 0.4)) < 0.12;
  p.ring(32, 24, 22, 17, P.stoneLight, cracked);
  p.ring(32, 24, 17, 15, P.stone, cracked);
  p.disc(32, 24, 10, P.ember);
  p.disc(32, 24, 6, P.amber);
  p.disc(32, 24, 2, P.bone);
}

// ---- Tiles and props ------------------------------------------------------------------------------------

const GROUND: readonly Rect[] = [
  [0, 0, 16, 16, P.stoneDark], [0, 0, 16, 2, P.stoneLight], [0, 2, 16, 1, P.stone],
  [0, 7, 16, 1, P.stoneDeep], [0, 12, 16, 1, P.stoneDeep],
  [5, 3, 1, 4, P.stoneDeep], [12, 3, 1, 4, P.stoneDeep], [2, 8, 1, 4, P.stoneDeep], [9, 8, 1, 4, P.stoneDeep],
  [6, 13, 1, 3, P.stoneDeep], [13, 13, 1, 3, P.stoneDeep], [3, 4, 1, 1, P.stone], [10, 10, 1, 1, P.stone],
];

const PLATFORM: readonly Rect[] = [
  [0, 0, 16, 2, P.stonePale], [0, 2, 16, 1, P.stoneLight], [0, 3, 16, 10, P.stone], [0, 13, 16, 3, P.stoneDark],
  [7, 3, 1, 10, P.stoneDark], [15, 3, 1, 10, P.stoneDark], [3, 6, 1, 1, P.stoneLight], [11, 9, 1, 1, P.stoneLight],
  [0, 15, 16, 1, P.outline],
];

/** A case exhibit: a scroll with an amber seal. */
const EXHIBIT: readonly Rect[] = [
  [2, 3, 8, 6, P.bone], [1, 2, 2, 8, P.boneDim], [9, 2, 2, 8, P.boneDim],
  [4, 5, 4, 1, P.stoneLight], [4, 7, 3, 1, P.stoneLight], [7, 7, 2, 2, P.amber],
];

/** The arena gate: a stone arch with a portcullis and two torches. */
function gate(p: Painter): void {
  p.rects([
    [0, 0, 32, 10, P.stone], [0, 0, 32, 1, P.stonePale], [0, 10, 6, 38, P.stone], [26, 10, 6, 38, P.stone],
    [6, 10, 20, 38, P.outline], [6, 10, 3, 2, P.stone], [23, 10, 3, 2, P.stone], [6, 12, 1, 1, P.stone], [25, 12, 1, 1, P.stone],
    [5, 10, 1, 38, P.stoneDark], [26, 10, 1, 38, P.stoneDark],
  ]);
  for (const x of [9, 13, 17, 21]) p.rects([[x, 12, 2, 36, P.stoneLight]]);
  for (const y of [18, 28, 38]) p.rects([[6, y, 20, 2, P.stoneLight]]);
  p.rects([[2, 16, 2, 3, P.amber], [28, 16, 2, 3, P.amber], [2, 19, 2, 3, P.wood], [28, 19, 2, 3, P.wood]]);
}

// ---- The digits font: 4 x 6 glyphs (M and W 5 x 6) in 5 x 6 cells ----------------------------------------

const GLYPHS: Record<string, readonly string[]> = {
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['.#..', '##..', '.#..', '.#..', '.#..', '###.'],
  '2': ['.##.', '#..#', '..#.', '.#..', '#...', '####'],
  '3': ['###.', '...#', '.##.', '...#', '...#', '###.'],
  '4': ['#..#', '#..#', '####', '...#', '...#', '...#'],
  '5': ['####', '#...', '###.', '...#', '...#', '###.'],
  '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '.#..', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
  '+': ['....', '.#..', '###.', '.#..', '....', '....'],
  '-': ['....', '....', '###.', '....', '....', '....'],
  '.': ['....', '....', '....', '....', '....', '.#..'],
  '%': ['#..#', '...#', '..#.', '.#..', '#...', '#..#'],
  '/': ['...#', '...#', '..#.', '.#..', '#...', '#...'],
  ' ': ['....', '....', '....', '....', '....', '....'],
  H: ['#..#', '#..#', '####', '#..#', '#..#', '#..#'],
  P: ['###.', '#..#', '#..#', '###.', '#...', '#...'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
};
const CELL_W = 5;
const CELL_H = 6;

function digits(scene: Phaser.Scene): void {
  texture(scene, 'digits', CELL_W * DIGIT_CHARS.length, CELL_H, (p) => {
    [...DIGIT_CHARS].forEach((ch, i) => p.bits(i * CELL_W, 0, GLYPHS[ch], P.white));
  });
  if (scene.cache.bitmapFont.exists('digits') || !scene.textures.exists('digits')) return;
  // Parse returns the whole cache entry ({ data, frame, texture }), whatever its type declaration says, so it goes
  // into the cache as it is. Wrapping it in another entry leaves BitmapText without its glyphs.
  const entry = Phaser.GameObjects.RetroFont.Parse(scene, {
    image: 'digits', width: CELL_W, height: CELL_H, chars: DIGIT_CHARS, charsPerRow: DIGIT_CHARS.length,
    'offset.x': 0, 'offset.y': 0, 'spacing.x': 0, 'spacing.y': 0, lineSpacing: 1,
  });
  scene.cache.bitmapFont.add('digits', entry);
}

/**
 * Creates every placeholder texture once per game: `class-citizen`, `class-government`, `class-business`,
 * `class-microsoft` (12 x 16), `tile-ground` and `tile-platform` (16 x 16), `exhibit` (12 x 12), `gate` (32 x 48),
 * `boss-grid`, `boss-debt`, `boss-fog`, `boss-core` (64 x 48), and the bitmap font `digits` (6 px tall, white,
 * tint it). A key that already exists, a real asset loaded first say, is left alone.
 */
export function makePlaceholders(scene: Phaser.Scene): void {
  texture(scene, 'class-citizen', 12, 16, (p) => p.rects(FIGURES.citizen));
  texture(scene, 'class-government', 12, 16, (p) => p.rects(FIGURES.government));
  texture(scene, 'class-business', 12, 16, (p) => p.rects(FIGURES.business));
  texture(scene, 'class-microsoft', 12, 16, (p) => p.rects(FIGURES.microsoft));
  texture(scene, 'tile-ground', 16, 16, (p) => p.rects(GROUND));
  texture(scene, 'tile-platform', 16, 16, (p) => p.rects(PLATFORM));
  texture(scene, 'exhibit', 12, 12, (p) => p.rects(EXHIBIT));
  texture(scene, 'gate', 32, 48, gate);
  texture(scene, 'boss-grid', 64, 48, gridWyrm);
  texture(scene, 'boss-debt', 64, 48, debtGolem);
  texture(scene, 'boss-fog', 64, 48, fogOfDemand);
  texture(scene, 'boss-core', 64, 48, deadlockCore);
  digits(scene);
}
