// How the party follows the lead on the road (spec 4.5): the lead's latest footprints, kept in a ring so the other three
// can trail it 200 ms behind, and the height each of them stands at. Pure, no Phaser, so tests/party.test.ts covers it.
import { groundUnder, type Segment } from './road';

/** Where the lead's feet were at time `t`, whether it faced left, and whether it stood on something. */
export interface Footprint { t: number; x: number; y: number; left: boolean; grounded: boolean }

/** The lead's latest footprints, `size` at most, in a ring: once it is full, each new one takes the place of the oldest. */
export class Trail {
  private readonly prints: Footprint[] = [];
  private head = 0;

  constructor(private readonly size: number) {}

  push(print: Footprint): void {
    this.prints[this.head] = print;
    this.head = (this.head + 1) % this.size;
  }

  /** The newest footprint at least `ms` older than `t`, or the oldest one kept while the trail is younger than that. */
  at(t: number, ms: number): Footprint | undefined {
    let found: Footprint | undefined;
    let oldest: Footprint | undefined;
    for (const print of this.prints) {
      if (oldest === undefined || print.t < oldest.t) oldest = print;
      if (print.t <= t - ms && (found === undefined || print.t > found.t)) found = print;
    }
    return found ?? oldest;
  }
}

/**
 * The height a follower stands at, its spot at `x`: the highest surface under it that is no higher than `stand` (the one
 * it stands on or is making for) or, if the lead stood at `print`, no higher than the lead stood. So it waits on the road
 * beside a ledge, stays on a ledge until it walks off the end, and keeps climbing when the lead jumps. Over a pit it takes
 * the lead's height.
 */
export function standAt(segment: Segment, x: number, print: Footprint, stand: number): number {
  return groundUnder(segment, x, print.grounded ? Math.min(print.y, stand) : stand) ?? print.y;
}
