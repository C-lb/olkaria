// The four travel segments (Task 9): the shape the brief lays down, then a run of each segment's auto path under the
// numbers the Travel scene uses, stepped the way arcade physics steps it, from the start of the segment. A from the
// start must reach the gate without dropping into a pit and pick up all three exhibits on the way, and no jump near the
// gate may carry the lead over its trigger.
import { describe, expect, it } from 'vitest';
import {
  autoStep, gateColumn, groundUnder, GROUND_Y, JUMP_SPEED, RUN_SPEED, SEGMENTS, START_X, stopAhead, TILE,
  type AutoStop, type Segment,
} from '../host/levels/road';

/** The brief's widest gap: a jump at RUN_SPEED clears about 76 px of ground. */
const MAX_GAP = 48;
/** host/main.ts's arcade gravity, and the fixed 60 Hz step arcade physics runs at. */
const GRAVITY = 600;
const DT = 1 / 60;
/** The world's bottom bound is the bottom of the canvas, so a pit is the 20 px between the road and it. */
const FLOOR = 180;
/** The class sprites and the exhibit, as host/art/placeholders.ts draws them. */
const LEAD_W = 12;
const LEAD_H = 16;
const EXHIBIT = 12;
/** How far below a surface the feet may have been on the step before and still land on it (rounding). */
const SLOP = 1;
/** Long enough for any segment at RUN_SPEED, with room to spare. */
const LIMIT_S = 30;

type Platform = Segment['platforms'][number];

const onRoad = (p: Platform): boolean => p.y === GROUND_Y;

/** The lead's body, its feet centred on x at `bottom`, against a surface's tile row. Touching edges do not overlap. */
const overlaps = (x: number, bottom: number, p: Platform): boolean =>
  x + LEAD_W / 2 > p.x && x - LEAD_W / 2 < p.x + p.w && bottom > p.y && bottom - LEAD_H < p.y + TILE;

/** The stretch of road under the whole span from `from` to `to`, if any: the platforms at GROUND_Y are the road, the breaks between them pits. */
const roadUnder = (seg: Segment, from: number, to: number): Platform | undefined =>
  seg.platforms.find((p) => onRoad(p) && p.x <= from && to <= p.x + p.w);

interface Run {
  /** Where the lead dropped below the road into a pit, or null. */
  fellAt: number | null;
  /** Whether its body touched the gate's trigger, which starts the battle. */
  arrived: boolean;
  /** Where it was once it had got past the gate's trigger without touching it, or null. */
  passedAt: number | null;
  /** The exhibit spots it touched, by index. */
  picked: number[];
  /** Every surface it landed on, in order. */
  stood: Platform[];
}

/** Where a run starts: the lead's feet, standing on whatever is there. */
interface From { x: number; bottom: number }

/**
 * A run to the right along `path` from `from`, a fixed step at a time, the way the scene's auto-run goes: the scene's
 * update decides (run right, jump at the path's jumps, or hop when the far wall of a pit stops it), then arcade physics
 * moves the body, stops it at the world's bounds, and separates it from the road (solid) and the ledges (from above
 * only), in the order the scene adds its colliders. It ends when the body touches the gate's trigger or gets past it
 * without touching it. The scene's rest at each pickup (PICKUP_PAUSE_MS) is left out on purpose: it holds the lead still
 * where it stands, so it changes when the lead gets somewhere, never where it goes.
 */
function simulate(seg: Segment, from: From, path: readonly AutoStop[]): Run {
  const run: Run = { fellAt: null, arrived: false, passedAt: null, picked: [], stood: [] };
  const gate = gateColumn(seg);
  let x = from.x;
  let bottom = from.bottom;
  let vy = 0;
  let onGround = true;
  let blockedRight = false;
  let next = stopAhead(path, x);
  const land = (p: Platform): void => {
    bottom = p.y;
    vy = 0;
    onGround = true;
    if (run.stood.at(-1) !== p) run.stood.push(p);
  };
  for (let step = 0; step < LIMIT_S / DT && !run.arrived && run.passedAt === null; step++) {
    const decision = autoStep(path, next, x);
    next = decision.next;
    if ((decision.jump || (blockedRight && bottom > GROUND_Y)) && onGround) vy = -JUMP_SPEED;

    const before = bottom;
    vy += GRAVITY * DT;
    x += RUN_SPEED * DT;
    bottom += vy * DT;
    onGround = false;
    blockedRight = false;
    if (x + LEAD_W / 2 > seg.width) {
      x = seg.width - LEAD_W / 2;
      blockedRight = true;
    }
    if (bottom > FLOOR) {
      bottom = FLOOR;
      vy = 0;
      onGround = true;
    }
    for (const p of seg.platforms.filter(onRoad)) {
      if (!overlaps(x, bottom, p)) continue;
      if (before <= p.y + SLOP) land(p);
      else {
        x = p.x - LEAD_W / 2;   // the far wall of a pit: auto-run only ever moves right
        blockedRight = true;
      }
    }
    for (const p of seg.platforms.filter((q) => !onRoad(q))) {
      if (vy >= 0 && before <= p.y + SLOP && overlaps(x, bottom, p)) land(p);
    }

    if (bottom > GROUND_Y + SLOP && run.fellAt === null) run.fellAt = Math.round(x);
    seg.exhibits.forEach((spot, i) => {
      const touching = Math.abs(x - spot.x) < (LEAD_W + EXHIBIT) / 2 && bottom > spot.y - EXHIBIT && bottom - LEAD_H < spot.y;
      if (touching && !run.picked.includes(i)) run.picked.push(i);
    });
    const atGate = x + LEAD_W / 2 > gate.x && x - LEAD_W / 2 < gate.x + gate.w && bottom > gate.y && bottom - LEAD_H < gate.y + gate.h;
    if (atGate) run.arrived = true;
    else if (x - LEAD_W / 2 >= gate.x + gate.w) run.passedAt = Math.round(x);
  }
  return run;
}

/** A from the start of a segment, along its baked path. */
const autoRun = (seg: Segment): Run => simulate(seg, { x: START_X, bottom: GROUND_Y }, seg.autoPath);

/** A run right that jumps once, when the lead's feet reach `jumpAt`. */
const jumpingAt = (seg: Segment, from: From, jumpAt: number): Run => simulate(seg, from, [{ x: jumpAt, jump: true }]);

describe('SEGMENTS: the roads between the battles', () => {
  it('lays four segments, 640 to 960 px long, the fourth 320', () => {
    expect(SEGMENTS).toHaveLength(4);
    for (const seg of SEGMENTS.slice(0, 3)) {
      expect(seg.width).toBeGreaterThanOrEqual(640);
      expect(seg.width).toBeLessThanOrEqual(960);
    }
    expect(SEGMENTS[3].width).toBe(320);
  });

  it('builds every platform from whole tiles inside its segment, the road at GROUND_Y and every ledge above it', () => {
    for (const seg of SEGMENTS) {
      for (const p of seg.platforms) {
        expect(p.x % TILE).toBe(0);
        expect(p.w % TILE).toBe(0);
        expect(p.w).toBeGreaterThan(0);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(seg.width);
        expect(p.y).toBeLessThanOrEqual(GROUND_Y);
      }
    }
  });

  it('rests each of the three exhibit spots on a platform or the ground', () => {
    for (const seg of SEGMENTS) {
      expect(seg.exhibits).toHaveLength(3);
      for (const spot of seg.exhibits) {
        const under = seg.platforms.filter((p) => p.y === spot.y && p.x <= spot.x - EXHIBIT / 2 && spot.x + EXHIBIT / 2 <= p.x + p.w);
        expect(under, `exhibit at ${spot.x}, ${spot.y}`).not.toHaveLength(0);
      }
    }
  });

  it('stands the gate on the road 32 px before the end, and the party on the road at the start', () => {
    for (const seg of SEGMENTS) {
      expect(seg.gateX).toBe(seg.width - 32);
      expect(roadUnder(seg, seg.gateX - 16, seg.gateX + 16)).toBeDefined();
      expect(roadUnder(seg, START_X - LEAD_W / 2, START_X + LEAD_W / 2)).toBeDefined();
    }
  });

  it('leaves no break between standing surfaces wider than 48 px, from the start of the segment to its end', () => {
    for (const seg of SEGMENTS) {
      const spans = [...seg.platforms].sort((a, b) => a.x - b.x);
      let reached = 0;
      for (const p of spans) {
        expect(p.x - reached, `break before ${p.x}`).toBeLessThanOrEqual(MAX_GAP);
        reached = Math.max(reached, p.x + p.w);
      }
      expect(reached).toBe(seg.width);
    }
  });

  it('lists the auto path in ascending order, between the start and the gate', () => {
    for (const seg of SEGMENTS) {
      const xs = seg.autoPath.map((stop) => stop.x);
      xs.forEach((x, i) => {
        if (i > 0) expect(x).toBeGreaterThan(xs[i - 1]);
        expect(x).toBeGreaterThan(START_X);
        expect(x).toBeLessThan(seg.gateX);
      });
    }
  });
});

describe('groundUnder: what the followers stand on', () => {
  const seg: Segment = {
    width: 320,
    platforms: [{ x: 0, y: 160, w: 96 }, { x: 128, y: 160, w: 192 }, { x: 160, y: 128, w: 64 }],
    exhibits: [],
    gateX: 288,
    autoPath: [],
  };

  it('finds the highest surface under a point that is no higher than the height given', () => {
    expect(groundUnder(seg, 192, 128)).toBe(128);
    expect(groundUnder(seg, 192, 100)).toBe(128);
    expect(groundUnder(seg, 192, 140)).toBe(160);
    expect(groundUnder(seg, 192, 160)).toBe(160);
    expect(groundUnder(seg, 240, 128)).toBe(160);
    expect(groundUnder(seg, 192, 128.4)).toBe(128);
  });

  it('finds nothing over a pit or below the road', () => {
    expect(groundUnder(seg, 112, 160)).toBeNull();
    expect(groundUnder(seg, 112, 100)).toBeNull();
    expect(groundUnder(seg, 192, 170)).toBeNull();
  });
});

describe('auto-run', () => {
  it('jumps once at each jump the lead reaches, never at a drop or at one it had passed when A was pressed', () => {
    const path = [{ x: 100, jump: true }, { x: 150, jump: false }, { x: 200, jump: true }];
    expect(stopAhead(path, 40)).toBe(0);
    expect(stopAhead(path, 100)).toBe(0);
    expect(stopAhead(path, 120)).toBe(1);
    expect(stopAhead(path, 260)).toBe(3);
    expect(autoStep(path, 0, 99)).toEqual({ next: 0, jump: false });
    expect(autoStep(path, 0, 100)).toEqual({ next: 1, jump: true });
    expect(autoStep(path, 1, 101)).toEqual({ next: 1, jump: false });
    expect(autoStep(path, 1, 150)).toEqual({ next: 2, jump: false });
    expect(autoStep(path, 1, 230)).toEqual({ next: 3, jump: true });
    expect(autoStep(path, 3, 300)).toEqual({ next: 3, jump: false });
  });

  it.each(SEGMENTS.map((seg, i) => [i + 1, seg] as const))(
    'from the start of segment %i reaches the gate without falling and picks up every exhibit',
    (_n, seg) => {
      const run = autoRun(seg);
      expect(run.fellAt).toBeNull();
      expect(run.arrived).toBe(true);
      expect([...run.picked].sort((a, b) => a - b)).toEqual([0, 1, 2]);
      // Every gap between the surfaces it stood on, in the order it stood on them.
      run.stood.slice(1).forEach((p, i) => {
        const before = run.stood[i];
        expect(p.x - (before.x + before.w), `gap before ${p.x}`).toBeLessThanOrEqual(MAX_GAP);
      });
    },
  );
});

describe('the gate: no jump carries the lead over it', () => {
  it.each(SEGMENTS.map((seg, i) => [i + 1, seg] as const))(
    'segment %i: a jump taken anywhere in the 80 px before the gate, 40 px before it included, still enters it',
    (_n, seg) => {
      for (let jumpAt = seg.gateX - 80; jumpAt <= seg.gateX - 16; jumpAt += 2) {
        const run = jumpingAt(seg, { x: seg.gateX - 100, bottom: GROUND_Y }, jumpAt);
        expect(run.passedAt, `jump at ${jumpAt}`).toBeNull();
        expect(run.arrived, `jump at ${jumpAt}`).toBe(true);
        expect(run.fellAt, `jump at ${jumpAt}`).toBeNull();
      }
    },
  );

  it('segment 4: a jump taken anywhere on the upper ledge still enters the gate', () => {
    const seg = SEGMENTS[3];
    const upper = seg.platforms.reduce((high, p) => (p.y < high.y ? p : high));
    const from = { x: upper.x + LEAD_W / 2, bottom: upper.y };
    for (let jumpAt = from.x; jumpAt < upper.x + upper.w + LEAD_W / 2; jumpAt += 2) {
      const run = jumpingAt(seg, from, jumpAt);
      expect(run.passedAt, `jump at ${jumpAt}`).toBeNull();
      expect(run.arrived, `jump at ${jumpAt}`).toBe(true);
    }
  });
});
