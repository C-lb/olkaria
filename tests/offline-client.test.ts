// tests/offline-client.test.ts
import { it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { OfflineRoomClient, botTally } from '../host/net';
const c = loadContent(raw);
it('runs the state machine locally and reports views', async () => {
  let t = 0; const client = new OfflineRoomClient(c, () => t);
  const views: any[] = []; client.onState(v => views.push(v));
  const { code } = await client.connect();
  expect(code).toBe('OFFLINE');
  client.send({ k: 'start' }); client.send({ k: 'openVote' });
  client.send({ k: 'injectVotes', counts: { B: 3 } });
  expect(views.at(-1).phase).toBe('vote'); expect(views.at(-1).supportTally.B).toBe(3); expect(views.at(-1).lead).toBe('citizen');
  t = 31000; client.tick();
  expect(views.at(-1).phase).toBe('locked');
  client.send({ k: 'callout' }); client.send({ k: 'judge', awarded: true });
  client.send({ k: 'reveal' });
  expect(views.at(-1).damageLog[0].total).toBe(100);   // all support on B: 80 + focus 15 + rally 10, capped
  expect(views.at(-1).damageLog[0].alignment).toBe(0);
});
it('bot votes lean toward the strongest option', () => {
  const t = botTally(c, 0, [], 1000, Math.random);
  expect(t.A + t.B + t.C + t.D).toBe(1000);
  expect(t.B).toBeGreaterThan(t.C);
});

// Added after the brief's tests. The fake clock keeps the client's 250 ms timer from outliving a test,
// including the brief's own, which calls connect() and never stops it.
import { afterEach, beforeEach, describe, vi } from 'vitest';
import { effectiveScores } from '../shared/scoring';
import { OPTION_IDS, type HostView, type OptionId, type Tally } from '../shared/types';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const ZERO: Tally = { A: 0, B: 0, C: 0, D: 0 };
const total = (t: Tally): number => OPTION_IDS.reduce((sum, o) => sum + t[o], 0);

function last<T>(xs: readonly T[]): T {
  if (xs.length === 0) throw new Error('nothing was reported');
  return xs[xs.length - 1];
}

/** A fixed stream of numbers in [0, 1): the same seed always gives the same draws (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('botTally', () => {
  it('hands out exactly n whole votes, and none for an n that is not a positive number', () => {
    for (const n of [1, 2, 7, 30, 1000]) {
      const t = botTally(c, 0, [], n, seeded(n));
      expect(total(t)).toBe(n);
      for (const o of OPTION_IDS) expect(Number.isInteger(t[o])).toBe(true);
    }
    for (const n of [0, -5, NaN, Infinity]) expect(botTally(c, 0, [], n, Math.random)).toEqual(ZERO);
    expect(total(botTally(c, 0, [], 2.9, Math.random))).toBe(2);
  });

  it('gives the same tally for the same rng, and draws once per vote', () => {
    expect(botTally(c, 1, ['B'], 200, seeded(42))).toEqual(botTally(c, 1, ['B'], 200, seeded(42)));
    expect(botTally(c, 1, ['B'], 200, seeded(42))).not.toEqual(botTally(c, 1, ['B'], 200, seeded(43)));
    const rng = vi.fn(seeded(7));
    botTally(c, 2, ['B', 'C'], 25, rng);
    expect(rng).toHaveBeenCalledTimes(25);
  });

  it('puts the edges of the range on the first and last option', () => {
    expect(botTally(c, 0, [], 20, () => 0)).toEqual({ ...ZERO, A: 20 });
    expect(botTally(c, 0, [], 20, () => 0.9999999)).toEqual({ ...ZERO, D: 20 });
    // A draw that rounding pushes to the very end of the range still lands on an option.
    expect(botTally(c, 0, [], 5, () => 1)).toEqual({ ...ZERO, D: 5 });
  });

  it('weights each option by its evidence score plus 10, and the round 4 score by the earlier majorities', () => {
    // A rng that sweeps [0, 1) evenly in midpoints puts each option's share of the votes at its share of the weight.
    const sweep = (n: number): (() => number) => {
      let i = 0;
      return () => (i++ + 0.5) / n;
    };
    const cases: [number, OptionId[]][] = [[0, []], [1, ['B']], [2, ['B', 'C']], [3, ['B', 'C', 'B']], [3, []]];
    for (const [round, prior] of cases) {
      const score = effectiveScores(c, round, prior);
      const weights = OPTION_IDS.map((o) => score[o] + 10);
      const sum = weights.reduce((a, b) => a + b, 0);
      const n = 5000;
      const t = botTally(c, round, prior, n, sweep(n));
      expect(total(t)).toBe(n);
      OPTION_IDS.forEach((o, i) => {
        expect(Math.abs(t[o] - (n * weights[i]) / sum), `round ${round} option ${o}`).toBeLessThanOrEqual(1);
      });
    }
    // The earlier majorities change round 4: B and D fit them, A and C do not.
    const fitting = botTally(c, 3, ['B', 'C', 'B'], 1000, seeded(5));
    const unrelated = botTally(c, 3, [], 1000, seeded(5));
    expect(fitting.B + fitting.D).toBeGreaterThan(unrelated.B + unrelated.D);
  });
});

describe('OfflineRoomClient', () => {
  /** A client on a clock the test moves by hand, with every view and every error it reports. */
  function start() {
    const clock = { t: 0 };
    const client = new OfflineRoomClient(c, () => clock.t);
    const views: HostView[] = [];
    const errors: string[] = [];
    client.onState((v) => views.push(v));
    client.onError((m) => errors.push(m));
    return { clock, client, views, errors };
  }

  it('ticks itself every 250 ms from connect() and locks the vote when the clock reaches the deadline', async () => {
    const { clock, client, views, errors } = start();
    await client.connect();
    client.send({ k: 'start' });
    client.send({ k: 'openVote', seconds: 2 });
    const seen = views.length;
    vi.advanceTimersByTime(249);
    expect(views).toHaveLength(seen);
    clock.t = 1500;
    vi.advanceTimersByTime(1);
    expect(views).toHaveLength(seen + 1);
    expect(last(views).phase).toBe('vote');
    clock.t = 2000;
    vi.advanceTimersByTime(250);
    expect(last(views).phase).toBe('locked');
    expect(last(views).serverNow).toBe(2000);
    // The early tick asked for an alarm and the lock cleared it. Offline there is no alarm, so neither is an error.
    expect(errors).toEqual([]);
  });

  it('starts one timer however often connect() is called, and reports a view on every tick', async () => {
    const { client, views } = start();
    expect(await client.connect()).toEqual({ code: 'OFFLINE', joinUrl: '' });
    expect(await client.connect()).toEqual({ code: 'OFFLINE', joinUrl: '' });
    expect(views).toHaveLength(1);
    expect(last(views).phase).toBe('lobby');
    vi.advanceTimersByTime(1000);
    expect(views).toHaveLength(5);
  });

  it('does not tick before connect()', () => {
    const { views } = start();
    vi.advanceTimersByTime(5000);
    expect(views).toEqual([]);
  });

  it('reports a refused command through onError and still reports the view', async () => {
    const { client, views, errors } = start();
    await client.connect();
    const seen = views.length;
    client.send({ k: 'reveal' });
    expect(errors).toEqual(['bad phase']);
    expect(views).toHaveLength(seen + 1);
    expect(last(views).phase).toBe('lobby');
  });

  it('hands out copies, so a scene that edits a view cannot change the room', async () => {
    const { client, views } = start();
    await client.connect();
    const first = last(views);
    first.majorities.push('B');
    first.banned.push('someone');
    client.tick();
    const second = last(views);
    expect(second).not.toBe(first);
    expect(second.majorities).toEqual([]);
    expect(second.banned).toEqual([]);
  });

  it('draws the call-out lottery itself when the command carries no pick, and uses a pick it is given', async () => {
    const { client, views, errors } = start();
    await client.connect();
    client.send({ k: 'start' });
    client.send({ k: 'openVote' });
    client.send({ k: 'closeVote' });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.25);
    client.send({ k: 'callout' });
    expect(random).toHaveBeenCalledTimes(1);
    client.send({ k: 'judge', awarded: false });
    client.send({ k: 'callout', pick: 0.5 });
    expect(random).toHaveBeenCalledTimes(1);
    expect(last(views).callouts[0]).toHaveLength(2);
    expect(errors).toEqual([]);
  });

  it('adds bot votes to the support side of the current round, weighted by botTally', async () => {
    const { client, views } = start();
    await client.connect();
    client.send({ k: 'start' });
    client.send({ k: 'openVote' });
    vi.spyOn(Math, 'random').mockReturnValue(0);   // every bot draws the first option
    client.addBots(30);
    expect(last(views).supportTally).toEqual({ ...ZERO, A: 30 });
    expect(last(views).tally).toEqual({ ...ZERO, A: 30 });
    expect(last(views).leadTally).toEqual(ZERO);
    client.send({ k: 'closeVote' });
    client.addBots(5);   // still counts while the vote is locked
    expect(last(views).supportTally).toEqual({ ...ZERO, A: 35 });
  });

  it('refuses bots in the lobby and adds nothing', async () => {
    const { client, views, errors } = start();
    await client.connect();
    client.addBots(30);
    expect(errors).toEqual(['no room view yet']);
    expect(last(views).supportTally).toEqual(ZERO);
    expect(last(views).synthetic).toEqual({});
  });

  it('stops calling a listener once it unsubscribes', async () => {
    const { client } = start();
    const seenViews: string[] = [];
    const seenErrors: string[] = [];
    const offView = client.onState((v) => seenViews.push(v.phase));
    const offError = client.onError((m) => seenErrors.push(m));
    await client.connect();
    client.send({ k: 'reveal' });
    expect(seenViews).toEqual(['lobby', 'lobby']);
    expect(seenErrors).toEqual(['bad phase']);
    offView();
    offError();
    client.send({ k: 'reveal' });
    client.tick();
    expect(seenViews).toEqual(['lobby', 'lobby']);
    expect(seenErrors).toEqual(['bad phase']);
  });

  it('does not call a listener that an earlier listener unsubscribed during the same report', async () => {
    const client = new OfflineRoomClient(c, () => 0);
    const calls: string[] = [];
    let offSecond = () => {};
    client.onState(() => {
      calls.push('first');
      offSecond();
    });
    offSecond = client.onState(() => calls.push('second'));
    await client.connect();
    expect(calls).toEqual(['first']);
  });

  it('does not hand a view to a listener that subscribed while that view was being reported', async () => {
    const client = new OfflineRoomClient(c, () => 0);
    const late: string[] = [];
    let subscribed = false;
    client.onState(() => {
      if (subscribed) return;
      subscribed = true;
      client.onState((v) => late.push(v.phase));
    });
    await client.connect();
    expect(late).toEqual([]);
    client.send({ k: 'start' });
    expect(late).toEqual(['travel']);
  });

  it('keeps serving the other listeners when one of them throws', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = new OfflineRoomClient(c, () => 0);
    const views: HostView[] = [];
    client.onState(() => { throw new Error('a scene broke'); });
    client.onState((v) => views.push(v));
    await client.connect();
    client.send({ k: 'start' });
    expect(views.map((v) => v.phase)).toEqual(['lobby', 'travel']);
    expect(logged).toHaveBeenCalledTimes(2);
  });

  it('reads the real clock when none is given', async () => {
    vi.setSystemTime(1_700_000_000_000);
    const client = new OfflineRoomClient(c);
    const views: HostView[] = [];
    client.onState((v) => views.push(v));
    await client.connect();
    expect(last(views).serverNow).toBe(1_700_000_000_000);
    vi.advanceTimersByTime(250);
    expect(last(views).serverNow).toBe(1_700_000_000_250);
  });

  it('reports itself as an offline client', () => {
    expect(new OfflineRoomClient(c).mode).toBe('offline');
  });
});
