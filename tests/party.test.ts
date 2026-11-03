// How the party follows the lead (host/levels/party.ts): the ring of footprints the other three trail 200 ms behind,
// and the height each of them stands at.
import { describe, expect, it } from 'vitest';
import { standAt, Trail, type Footprint } from '../host/levels/party';
import type { Segment } from '../host/levels/road';

/** A footprint at time `t`, by default on the road at x = t. */
const print = (t: number, x = t, y = 160, grounded = true): Footprint => ({ t, x, y, left: false, grounded });

describe('Trail', () => {
  it('gives back the footprint from 200 ms ago, the newest one at least that old', () => {
    const trail = new Trail(64);
    for (let t = 0; t <= 400; t += 50) trail.push(print(t));
    expect(trail.at(400, 200)?.t).toBe(200);
    expect(trail.at(440, 200)?.t).toBe(200);
    expect(trail.at(450, 200)?.t).toBe(250);
  });

  it('gives back the oldest footprint while it holds less than 200 ms of them, and nothing when empty', () => {
    const trail = new Trail(64);
    expect(trail.at(0, 200)).toBeUndefined();
    for (let t = 0; t <= 100; t += 50) trail.push(print(t));
    expect(trail.at(100, 200)?.t).toBe(0);
  });

  it('wraps: once full, each new footprint takes the place of the oldest', () => {
    const trail = new Trail(4);
    for (let t = 0; t <= 450; t += 50) trail.push(print(t));
    expect(trail.at(450, 0)?.t).toBe(450);
    expect(trail.at(450, 100)?.t).toBe(350);
    expect(trail.at(450, 200)?.t).toBe(300);
  });
});

describe('standAt: the height a follower stands at', () => {
  // The road with a pit from 96 to 128, and a ledge 32 px up from 160 to 224.
  const seg: Segment = {
    width: 320,
    platforms: [{ x: 0, y: 160, w: 96 }, { x: 128, y: 160, w: 192 }, { x: 160, y: 128, w: 64 }],
    exhibits: [],
    gateX: 288,
    autoPath: [],
  };

  it('waits on the road beside a ledge the lead stands on, and climbs onto it once under it', () => {
    const onLedge = print(0, 200, 128);
    expect(standAt(seg, 150, onLedge, 160)).toBe(160);
    expect(standAt(seg, 170, onLedge, 160)).toBe(128);
  });

  it('stays on its ledge while the lead drops off the end, until it walks off the end too', () => {
    const dropping = print(0, 240, 140, false);
    expect(standAt(seg, 210, dropping, 128)).toBe(128);
    expect(standAt(seg, 230, dropping, 128)).toBe(160);
  });

  it('keeps making for a ledge while the lead jumps, and never climbs while the lead is in the air', () => {
    const jumping = print(0, 200, 100, false);
    expect(standAt(seg, 190, jumping, 128)).toBe(128);
    expect(standAt(seg, 190, jumping, 160)).toBe(160);
  });

  it("takes the lead's height over a pit", () => {
    expect(standAt(seg, 112, print(0, 140, 160), 160)).toBe(160);
    expect(standAt(seg, 112, print(0, 140, 110, false), 160)).toBe(110);
  });
});
