import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Chip, LOOKAHEAD_S, TICK_MS, type VoicerNote } from '../host/audio/chip';
import { bpmAt, stepsBetween, THEMES } from '../host/audio/score';
import { hitFor, SFX } from '../host/audio/sfx';

const EPS = 1e-9;
let clock = 0;
const voicer = { now: () => clock, note: vi.fn(), duckMusic: vi.fn(), releaseMusic: vi.fn(), stopAll: vi.fn() };
const notes = (): VoicerNote[] => voicer.note.mock.calls.map((c) => c[0] as VoicerNote);

/** One timer tick: the voicer's clock and the fake interval move together. */
function tick(times = 1): void {
  for (let i = 0; i < times; i++) {
    clock += TICK_MS / 1000;
    vi.advanceTimersByTime(TICK_MS);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  clock = 0;
  voicer.note.mockReset();
  voicer.duckMusic.mockReset();
  voicer.releaseMusic.mockReset();
  voicer.stopAll.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

it('schedules the first look-ahead of a theme at once and the rest on each tick, in order', () => {
  clock = 5;
  const chip = new Chip(voicer);
  chip.play('lobby');
  const first = notes();
  expect(first.length).toBeGreaterThan(0);
  for (const n of first) {
    expect(n.start).toBeGreaterThanOrEqual(5 - EPS);
    expect(n.start).toBeLessThanOrEqual(5 + LOOKAHEAD_S + EPS);
    expect(n.bus).toBe('music');
  }

  let seen = first.length;
  for (let i = 0; i < 50; i++) {
    tick();
    for (const n of notes().slice(seen)) expect(n.start).toBeLessThanOrEqual(clock + LOOKAHEAD_S + EPS);
    seen = notes().length;
  }
  const all = notes();
  expect(all.length).toBeGreaterThan(first.length);
  for (let i = 1; i < all.length; i++) expect(all[i].start).toBeGreaterThanOrEqual(all[i - 1].start - EPS);
  const keys = all.map((n) => `${n.start.toFixed(6)} ${n.wave} ${n.hz}`);
  expect(new Set(keys).size).toBe(keys.length);

  // Exactly the theme's notes from beat 0 to the horizon, at the theme's tempo.
  const spb = 60 / bpmAt(THEMES.lobby, 0);
  const expected = stepsBetween(THEMES.lobby, 0, (clock + LOOKAHEAD_S - 5) / spb, 0);
  expect(all.length).toBe(expected.length);
  const byKey = (n: { start: number; wave: string; hz: number }) => `${n.start.toFixed(6)} ${n.wave} ${n.hz}`;
  expect(new Set(all.map(byKey))).toEqual(new Set(expected.map((e) => byKey({ start: 5 + e.beat * spb, wave: e.wave, hz: e.hz }))));
  chip.stop();
});

it('switches themes on the beat and ignores the same theme', () => {
  const chip = new Chip(voicer);
  chip.play('lobby');
  tick(5); // 0.2 s in: beat 0.41 of the lobby, mid-beat
  const mark = notes().length;
  chip.play('vote');
  expect(chip.playing).toBe('vote');
  tick(20);

  const boundary = 60 / bpmAt(THEMES.lobby, 0); // lobby beat 1
  const after = notes().slice(mark);
  expect(after.length).toBeGreaterThan(0);
  for (const n of after) expect(n.start).toBeGreaterThanOrEqual(boundary - EPS);
  const firstStart = Math.min(...after.map((n) => n.start));
  expect(firstStart).toBeCloseTo(boundary, 9);
  const firstHz = after.filter((n) => Math.abs(n.start - firstStart) < EPS).map((n) => n.hz).sort();
  expect(firstHz).toEqual(stepsBetween(THEMES.vote, 0, 0.01, 0).map((e) => e.hz).sort());
  // The lobby's notes still sounding are released on the boundary, so nothing of it rings into the vote.
  expect(voicer.releaseMusic).toHaveBeenCalledTimes(1);
  expect(voicer.releaseMusic.mock.calls[0][0]).toBeCloseTo(boundary, 9);

  chip.play('vote');
  expect(chip.playing).toBe('vote');
  tick(20);
  // Still the one vote from that boundary: nothing restarted, nothing doubled.
  const spb = 60 / bpmAt(THEMES.vote, 0);
  const vote = notes().slice(mark);
  const expected = stepsBetween(THEMES.vote, 0, (clock + LOOKAHEAD_S - boundary) / spb, 0);
  expect(vote.length).toBe(expected.length);
  vote.forEach((n, i) => {
    expect(n.start).toBeCloseTo(boundary + expected[i].beat * spb, 9);
  });
  expect(vote.map((n) => n.hz).sort()).toEqual(expected.map((e) => e.hz).sort());
  expect(voicer.releaseMusic).toHaveBeenCalledTimes(1); // the repeat queued no second switch
  chip.stop();
});

it('tension changes the tempo of what comes next', () => {
  const chip = new Chip(voicer);
  chip.play('vote', 0);
  tick(10);
  const gaps = (list: VoicerNote[]): number[] => {
    const starts = [...new Set(list.map((n) => Number(n.start.toFixed(9))))].sort((a, b) => a - b);
    return starts.slice(1).map((s, i) => s - starts[i]);
  };
  const before = gaps(notes());
  expect(before.length).toBeGreaterThan(2);
  for (const g of before) expect(g).toBeCloseTo(60 / 150 / 4, 6);

  chip.setTension(2);
  const mark = notes().length;
  tick(20);
  const after = gaps(notes().slice(mark));
  expect(after.length).toBeGreaterThan(2);
  for (const g of after) expect(g / before[0]).toBeCloseTo(150 / 185, 6);

  // The faster tempo picks up where the slower one left off: the step across the change is part old, part
  // new, so it is no shorter than a new step and no longer than an old one.
  const lastBefore = Math.max(...notes().slice(0, mark).map((n) => n.start));
  const firstAfter = Math.min(...notes().slice(mark).map((n) => n.start));
  expect(firstAfter - lastBefore).toBeGreaterThanOrEqual(60 / 185 / 4 - EPS);
  expect(firstAfter - lastBefore).toBeLessThanOrEqual(60 / 150 / 4 + EPS);
  chip.stop();
});

it('stop ends scheduling and silences', () => {
  const chip = new Chip(voicer);
  chip.play('travel');
  tick(10);
  expect(chip.playing).toBe('travel');
  expect(voicer.releaseMusic).not.toHaveBeenCalled();
  const stoppedAt = clock;
  chip.stop();
  const count = notes().length;
  tick(25);
  expect(notes().length).toBe(count);
  expect(voicer.releaseMusic).toHaveBeenCalledTimes(1);
  expect(voicer.releaseMusic).toHaveBeenCalledWith(stoppedAt);
  expect(voicer.stopAll).toHaveBeenCalledTimes(1);
  expect(voicer.releaseMusic.mock.invocationCallOrder[0]).toBeLessThan(voicer.stopAll.mock.invocationCallOrder[0]);
  expect(chip.playing).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});

it('an effect plays from now and a hit ducks the music', () => {
  clock = 3;
  const chip = new Chip(voicer);
  chip.sfx('lock');
  expect(notes()).toEqual(
    SFX.lock.map((s) => ({ bus: 'sfx', wave: s.wave, hz: s.hz, gain: s.gain, start: 3 + s.at / 1000, seconds: s.ms / 1000 })),
  );

  voicer.note.mockReset();
  clock = 4;
  chip.hit(50, 100);
  expect(voicer.duckMusic).toHaveBeenCalledTimes(1);
  expect(voicer.duckMusic).toHaveBeenCalledWith(400);
  const hit = notes();
  expect(hit.map((n) => n.wave).sort()).toEqual(['noise', 'square']);
  const steps = hitFor(50, 100);
  expect(hit).toEqual(
    steps.map((s) => ({
      bus: 'sfx', wave: s.wave, hz: s.hz, ...(s.hzTo !== undefined ? { hzTo: s.hzTo } : {}),
      gain: s.gain, start: 4 + s.at / 1000, seconds: s.ms / 1000,
    })),
  );
  expect(vi.getTimerCount()).toBe(0); // effects alone start no scheduler
});

it('a note the voicer refuses is dropped: the scheduler keeps going and nothing escapes into the game loop', () => {
  const key = (n: VoicerNote) => `${n.start.toFixed(6)} ${n.wave} ${n.hz}`;
  // Refused on the first note of the theme (inside play) and again on a note scheduled by a later tick.
  let calls = 0;
  voicer.note.mockImplementation(() => {
    calls += 1;
    if (calls === 1 || clock > 0.5) {
      if (clock > 0.5) voicer.note.mockImplementation(() => {});
      throw new Error('bad note');
    }
  });
  const chip = new Chip(voicer);
  expect(() => chip.play('lobby')).not.toThrow();
  expect(() => tick(30)).not.toThrow();
  const after = notes().filter((n) => n.start > 1);
  expect(after.length).toBeGreaterThan(0); // still scheduling after both refusals
  const keys = notes().map(key);
  expect(new Set(keys).size).toBe(keys.length); // the refused notes were not handed over again
  chip.stop();
});
