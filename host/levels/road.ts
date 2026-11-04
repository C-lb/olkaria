// The four roads the party travels between battles (spec 4.5), one per round, with the gate's trigger, how the
// walk reads a road's baked path, and what the followers stand on. Pure data and arithmetic, no Phaser, so
// tests/road.test.ts can run every path.
//
// Every surface the party can stand on is a platform one tile deep: the road itself is the platforms whose top is at
// GROUND_Y, and a break between two of them is a pit; every other platform is a ledge above the road. A pit drops to
// the bottom of the canvas, 20 px down, shallow enough to hop back out of. The numbers below are what the roads are laid
// for: under main.ts's gravity of 600 px/s², a jump at JUMP_SPEED rises about 54 px and, running at RUN_SPEED, lands
// about 76 px further on, so no break is wider than 48 px and no ledge stands more than 40 px above the surface the
// path jumps to it from.

/** Where the auto-runner jumps: at `x`, the centre of the lead's feet. `jump: false` marks where the path walks off a ledge. */
export interface AutoStop { x: number; jump: boolean }

export interface Segment {
  width: number;
  /** Left edge, top and width of each platform, in px. */
  platforms: { x: number; y: number; w: number }[];
  /** Where each of the round's three exhibits rests: its centre, and the top of the surface under it. */
  exhibits: { x: number; y: number }[];
  /** The centre of the arena gate, which stands on the road. */
  gateX: number;
  autoPath: AutoStop[];
}

/** The top of the road. */
export const GROUND_Y = 160;
/** The tile every platform is built from, and how deep a platform is. */
export const TILE = 16;
/** Where the lead starts: the centre of its feet, on the road. */
export const START_X = 48;
/** The lead's running speed, by hand or on auto-run, in px/s. */
export const RUN_SPEED = 90;
/** How fast a jump leaves the ground, in px/s (upward). */
export const JUMP_SPEED = 260;
/** How long auto-run rests where it picks up an exhibit, so the room can read the figure before the party moves on. */
export const PICKUP_PAUSE_MS = 2000;
/** The party stands this long after a segment starts before it sets off, so the road and its label register. */
export const SETOFF_MS = 1000;

/** The gate's centre stands this far from the end of its segment, and the gate is this wide, as the art draws it. */
const GATE_INSET = 32;
const GATE_W = 32;

const road = (x: number, w: number): Segment['platforms'][number] => ({ x, y: GROUND_Y, w });
const ledge = (x: number, y: number, w: number): Segment['platforms'][number] => ({ x, y, w });
const jump = (x: number): AutoStop => ({ x, jump: true });
const drop = (x: number): AutoStop => ({ x, jump: false });

function segment(width: number, platforms: Segment['platforms'], exhibits: Segment['exhibits'], autoPath: AutoStop[]): Segment {
  return { width, platforms, exhibits, gateX: width - GATE_INSET, autoPath };
}

/** One segment per round, in round order. Ledges stand at 120 (40 px up), 128 (32 px up) or 96 (32 px over a ledge at 128). */
export const SEGMENTS: Segment[] = [
  // Travel 1: a ledge, a narrow pit, a higher ledge, a wide pit, a last ledge.
  segment(800,
    [road(0, 256), road(288, 208), road(544, 256), ledge(112, 128, 64), ledge(352, 120, 64), ledge(608, 128, 64)],
    [{ x: 160, y: 128 }, { x: 400, y: 120 }, { x: 656, y: 128 }],
    [jump(72), drop(176), jump(240), jump(336), drop(416), jump(480), jump(576), drop(672)]),
  // Travel 2: two steps up to the first exhibit, a wide pit, a ledge, a narrow pit, a ledge.
  segment(880,
    [road(0, 352), road(400, 208), road(640, 240), ledge(112, 128, 64), ledge(192, 96, 64), ledge(464, 120, 64), ledge(720, 128, 64)],
    [{ x: 240, y: 96 }, { x: 512, y: 120 }, { x: 768, y: 128 }],
    [jump(80), jump(152), drop(256), jump(336), jump(432), drop(528), jump(592), jump(688), drop(784)]),
  // Travel 3: a narrow pit, a ledge, an 80 px pit crossed on a ledge over its middle, a wide pit, two steps up.
  segment(960,
    [road(0, 128), road(160, 256), road(496, 80), road(624, 336), ledge(256, 120, 64), ledge(432, 128, 48), ledge(688, 128, 64), ledge(768, 96, 64)],
    [{ x: 304, y: 120 }, { x: 464, y: 128 }, { x: 816, y: 96 }],
    [jump(112), jump(224), drop(320), jump(384), drop(480), jump(560), jump(656), jump(728), drop(832)]),
  // Travel 4, one screen: two steps up and down into the gate.
  segment(320,
    [road(0, 320), ledge(96, 128, 64), ledge(192, 96, 64)],
    [{ x: 144, y: 128 }, { x: 224, y: 96 }, { x: 248, y: 96 }],
    [jump(64), jump(152), drop(256)]),
];

/** A rectangle in the world, by its top-left corner. */
export interface Rect { x: number; y: number; w: number; h: number }

/**
 * What starts the battle: the gate's whole column, from the top of the canvas down to the road, so no jump can carry
 * the lead over the gate (the world ends 16 px past it).
 */
export function gateColumn({ gateX }: Segment): Rect {
  return { x: gateX - GATE_W / 2, y: 0, w: GATE_W, h: GROUND_Y };
}

/** How far below a surface's top a height may sit and still count as on it (rounding). */
const LEVEL_PX = 0.5;

/** The top of the highest surface under `x` that is no higher than `y`, or null over a pit. */
export function groundUnder({ platforms }: Segment, x: number, y: number): number | null {
  let top: number | null = null;
  for (const p of platforms) {
    if (x < p.x || x > p.x + p.w || p.y < y - LEVEL_PX) continue;
    if (top === null || p.y < top) top = p.y;
  }
  return top;
}

/** The first stop of `path` the lead, its feet at `x`, has not passed: where an auto-run started there picks up. */
export function stopAhead(path: readonly AutoStop[], x: number): number {
  const i = path.findIndex((stop) => stop.x >= x);
  return i === -1 ? path.length : i;
}

/**
 * One frame of auto-run, `next` being the first stop not yet passed and the lead's feet now at `x`: whether a stop it
 * has just reached is a jump, and the first stop still ahead. Each stop is acted on once, on the frame it is reached.
 */
export function autoStep(path: readonly AutoStop[], next: number, x: number): { next: number; jump: boolean } {
  let i = next;
  let jump = false;
  for (; i < path.length && path[i].x <= x; i++) jump ||= path[i].jump;
  return { next: i, jump };
}
