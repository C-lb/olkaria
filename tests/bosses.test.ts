// tests/bosses.test.ts
// The bosses' data (host/art/boss-data.ts), checked without Phaser. Every pixel of every boss, at rest, through its
// idle loop and through a hit's recoil, and every particle it can throw, stays inside the box Battle keeps for it:
// clear of the HP bar over it and of the lane the strike numbers rise in. Every sprite is a rectangle of palette keys,
// and every figure a boss carries is in the digits font, which leaves out any glyph it lacks without a word.
import { describe, expect, it, vi } from 'vitest';
import {
  BOLT, BOLTS, BOSS_IDS, CORE, coreParts, DIE, DIGIT_CELL, FOG, HIT, HYDRA, hydraParts, INK, MOTE, PUFF_PX, SAND, SPARK,
  SPARKS, SPRITES, WRAITH_OF_RISK, wraithParts, wyrmParts, type BossId, type Figure, type Placed, type Span, type Stray,
} from '../host/art/boss-data';
import { DIGIT_CHARS } from '../host/art/placeholders';

// placeholders.ts paints with Phaser, which needs a browser; the font's charset needs none of it.
vi.mock('phaser', () => ({ default: {} }));

/** Battle stands the boss with its feet at BOSS_X on the floor (Battle.ts). */
const FEET = { x: 280, y: 84 } as const;
/** Pixels the boss may use: columns 240 to 317, rows 30 to 83. */
const BOX = { left: 240, right: 318, top: 30, floor: 84 } as const;
/** The HP bar (ui/HpBar.ts at 260, 18) covers columns 259 to 312 down to row 33: under it the boss starts at row 35. */
const HP = { left: 259, right: 313, clear: 35 } as const;
/** Where the strike numbers rise: columns 111 to 200, rows 38 to 49 (Battle.ts). */
const LANE = { left: 111, right: 201, top: 38, bottom: 50 } as const;

/** A swept extent in world pixels: left and top inclusive, right and bottom exclusive. */
interface Extent { what: string; x0: number; y0: number; x1: number; y1: number }

const still: Span = [0, 0];
const strayed = (s: Pick<Stray, 'dx' | 'dy'>): { dx: Span; dy: Span } =>
  ({ dx: [Math.min(0, s.dx), Math.max(0, s.dx)], dy: [Math.min(0, s.dy), Math.max(0, s.dy)] });
/** The offsets round(a * sin) can take. */
const waved = (a: number): Span => [Math.round(-Math.abs(a)), Math.round(Math.abs(a))];

/** The painted pixels of a sprite: its first and last painted column and row (right and bottom exclusive). */
function painted(rows: readonly string[]): { c0: number; c1: number; r0: number; r1: number } {
  const cols = rows.flatMap((row) => [...row].flatMap((k, x) => (k === '.' ? [] : [x])));
  const lines = rows.flatMap((row, y) => (/[^.]/.test(row) ? [y] : []));
  return { c0: Math.min(...cols), c1: Math.max(...cols) + 1, r0: Math.min(...lines), r1: Math.max(...lines) + 1 };
}

/** A sprite part swept through its idle motion and the recoil. */
function part({ key, x, y }: Placed, dx: Span = still, dy: Span = still): Extent {
  const p = painted(SPRITES[key]);
  return {
    what: key,
    x0: FEET.x + x + p.c0 + dx[0], x1: FEET.x + x + p.c1 + dx[1] + HIT.recoilPx,
    y0: FEET.y + y + p.r0 + dy[0], y1: FEET.y + y + p.r1 + dy[1],
  };
}

/** A figure in the digits font, every cell of it, swept the same way. */
function figure({ text, x, y, spacing }: Figure, dx: Span = still, dy: Span = still): Extent {
  const w = text.length * (DIGIT_CELL.w + spacing) - spacing;
  return {
    what: `"${text}"`,
    x0: FEET.x + x + dx[0], x1: FEET.x + x + w + dx[1] + HIT.recoilPx,
    y0: FEET.y + y + dy[0], y1: FEET.y + y + DIGIT_CELL.h + dy[1],
  };
}

/** Where particle middles may start: first to last, about the feet. */
interface Starts { x0: number; x1: number; y0: number; y1: number }

/** Particles starting anywhere in `at`, moving up to `move`, each drawn `half` px either side of its middle. */
function particles(what: string, at: Starts, move: { dx: Span; dy: Span }, half: { x: number; y: number }): Extent {
  return {
    what,
    x0: FEET.x + at.x0 + move.dx[0] - half.x, x1: FEET.x + at.x1 + move.dx[1] + half.x + HIT.recoilPx,
    y0: FEET.y + at.y0 + move.dy[0] - half.y, y1: FEET.y + at.y1 + move.dy[1] + half.y,
  };
}

/** A whole-pixel start somewhere in a zone (bosses.ts `within`): its first to last pixel. */
const zone = (x: number, y: number, w: number, h: number): Starts => ({ x0: x, x1: x + w - 1, y0: y, y1: y + h - 1 });

const sized = (rows: readonly string[], scale = 1): { x: number; y: number } => ({ x: (rows[0].length * scale) / 2, y: (rows.length * scale) / 2 });

function extents(id: BossId): Extent[] {
  switch (id) {
    case 'power': {
      const parts = wyrmParts();
      const sparks = parts.slice(0, SPARKS.links).map((link) => {
        const rows = SPRITES[link.key];
        const mid = { x: link.x + rows[0].length / 2, y: link.y + rows.length / 2 };
        const [wx0, wx1] = waved(link.across.x);
        const [wy0, wy1] = waved(link.across.y);
        const { jitter } = SPARKS;
        const at = { x0: mid.x - jitter.x + wx0, x1: mid.x + jitter.x + wx1, y0: mid.y - jitter.y + wy0, y1: mid.y + jitter.y + wy1 };
        // A spark rises for at most its longest life; a bolt stays where it starts.
        const life = SPARKS.lifeMs.max / 1000;
        const rise = { dx: [-SPARKS.speedX * life, SPARKS.speedX * life] as const, dy: [SPARKS.speedY.min * life, 0] as const };
        return [
          particles(`spark off ${link.key} ${link.i}`, at, rise, sized(SPARK)),
          particles(`bolt on ${link.key} ${link.i}`, at, { dx: still, dy: still }, sized(BOLT)),
        ];
      });
      expect(BOLTS.lifeMs).toBeGreaterThan(0);
      return [...parts.map((p) => part(p, waved(p.across.x), waved(p.across.y))), ...sparks.flat()];
    }
    case 'competition': {
      const at = hydraParts();
      const body = strayed(HYDRA.breath);
      return [
        part(at.body, body.dx, body.dy),
        ...at.heads.map((h, i) => {
          const sway = strayed(HYDRA.sway[i]);
          // A head rides the body's breath as well as its own sway.
          return part(h, [sway.dx[0] + body.dx[0], sway.dx[1] + body.dx[1]], [sway.dy[0] + body.dy[0], sway.dy[1] + body.dy[1]]);
        }),
      ];
    }
    case 'risk': {
      const at = wraithParts();
      const bob = strayed(WRAITH_OF_RISK.bob);
      const { fall } = SAND;
      const life = fall.lifeMs / 1000;
      return [
        part(at.glass, bob.dx, bob.dy),
        part(at.sand, bob.dx, bob.dy),
        ...at.arms.map((a) => {
          const reach = strayed(WRAITH_OF_RISK.reach);
          return part(a, [bob.dx[0] + reach.dx[0], bob.dx[1] + reach.dx[1]], [bob.dy[0] + reach.dy[0], bob.dy[1] + reach.dy[1]]);
        }),
        particles('sand', { x0: at.glass.x + fall.x + bob.dx[0], x1: at.glass.x + fall.x + bob.dx[1], y0: at.glass.y + fall.y + bob.dy[0], y1: at.glass.y + fall.y + bob.dy[1] },
          { dx: still, dy: [0, fall.speedY * life] }, sized(MOTE, fall.scale)),
      ];
    }
    case 'demand': {
      const bob = strayed(FOG.bob);
      const drift = strayed(FOG.figureDrift);
      const life = FOG.ms / 1000;
      const scale = Math.max(...FOG.scales);
      return [
        part(FOG.wraith, bob.dx, bob.dy),
        ...FOG.figures.map((f) => figure(f, drift.dx, drift.dy)),
        particles('fog', zone(FOG.zone.x, FOG.zone.y, FOG.zone.w, FOG.zone.h),
          { dx: [-FOG.drift.x * life, FOG.drift.x * life], dy: [-FOG.drift.up * life, FOG.drift.down * life] },
          { x: (PUFF_PX * scale) / 2, y: (PUFF_PX * scale) / 2 }),
      ];
    }
    case 'core': {
      const at = coreParts();
      const { embers } = CORE;
      const life = embers.lifeMs / 1000;
      return [
        part(at.heart),
        part(at.veins),
        ...at.arcs.map((arc, i) => part(arc, strayed(CORE.stray[i]).dx, strayed(CORE.stray[i]).dy)),
        particles('embers', zone(CORE.at.x + embers.x, CORE.at.y + embers.y, embers.w, embers.h),
          { dx: [-embers.speedX * life, embers.speedX * life], dy: [embers.speedY.min * life, 0] }, sized(MOTE, embers.scale)),
      ];
    }
  }
}

/** What an extent does wrong, if anything. */
function faults(e: Extent): string[] {
  const out: string[] = [];
  const where = `${e.what} at x ${e.x0} to ${e.x1}, y ${e.y0} to ${e.y1}`;
  if (e.x0 < BOX.left || e.x1 > BOX.right) out.push(`${where}: outside columns ${BOX.left} to ${BOX.right - 1}`);
  if (e.y1 > BOX.floor) out.push(`${where}: below the floor at ${BOX.floor}`);
  const underBar = e.x0 < HP.right && e.x1 > HP.left;
  const top = underBar ? HP.clear : BOX.top;
  if (e.y0 < top) out.push(`${where}: above row ${top}${underBar ? ' under the HP bar' : ''}`);
  if (e.x0 < LANE.right && e.x1 > LANE.left && e.y0 < LANE.bottom && e.y1 > LANE.top) out.push(`${where}: in the strike lane`);
  return out;
}

describe('the bosses', () => {
  it('are the five of the class edits, in round order, the Debt Golem gone', () => {
    expect(BOSS_IDS).toEqual(['power', 'demand', 'competition', 'risk', 'core']);
    expect(Object.keys(SPRITES).filter((key) => /debt|golem/.test(key))).toEqual([]);
    expect(DIE.ms).toBe(900);
  });

  for (const id of BOSS_IDS) {
    it(`${id} stays in its box, under the HP bar and out of the strike lane, idling, recoiling and throwing particles`, () => {
      const all = extents(id);
      expect(all.length).toBeGreaterThan(0);
      expect(all.flatMap(faults)).toEqual([]);
    });
  }

  it('paints every sprite from a rectangle of palette keys', () => {
    const keys = new Set([...Object.keys(INK), '.']);
    for (const [key, rows] of Object.entries(SPRITES)) {
      expect(rows.length, key).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.length)).size, key).toBe(1);
      expect([...rows.join('')].filter((k) => !keys.has(k)), key).toEqual([]);
    }
  });

  it('writes every figure in characters the digits font has', () => {
    const texts = FOG.figures.map((f) => f.text);
    expect(texts.length).toBe(3);
    for (const text of texts) expect([...text].filter((ch) => !DIGIT_CHARS.includes(ch)), text).toEqual([]);
  });
});
