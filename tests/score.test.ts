import { describe, expect, it } from 'vitest';
import { bpmAt, DRUM_HZ, noteHz, STEPS_PER_BEAT, stepsBetween, tensionFor, THEMES, type Theme } from '../host/audio/score';

const ids = Object.keys(THEMES) as (keyof typeof THEMES)[];
const length = (t: Theme) => t.bars * t.beatsPerBar;

it('names notes: A4 is 440, octaves double, sharps and flats agree', () => {
  expect(noteHz('A4')).toBe(440);
  expect(noteHz('A5')).toBe(880);
  expect(noteHz('C4')).toBeCloseTo(261.63, 1);
  expect(noteHz('F#4')).toBeCloseTo(noteHz('Gb4'), 6);
  expect(Number.isNaN(noteHz('-'))).toBe(true);
  expect(Number.isNaN(noteHz('K'))).toBe(true);
});
it('every theme parses: every token a note, a rest, a hold, or a drum on a noise track, and every track fills whole bars', () => {
  for (const id of ids) {
    const t = THEMES[id];
    expect(t.bpm.every((b) => b > 0)).toBe(true);
    for (const track of t.tracks) {
      const tokens = track.steps.trim().split(/\s+/);
      expect(tokens.length % (t.beatsPerBar * STEPS_PER_BEAT)).toBe(0);
      expect(tokens.length).toBe(length(t) * STEPS_PER_BEAT);
      for (const tok of tokens) {
        if (tok === '-' || tok === '.') continue;
        if (track.wave === 'noise') expect(tok in DRUM_HZ).toBe(true);
        else expect(Number.isFinite(noteHz(tok))).toBe(true);
      }
      expect(tokens[0]).not.toBe('.');
    }
  }
});
it('stepsBetween crosses the loop seam in order and without repeats', () => {
  const t = THEMES.lobby;
  const n = length(t);
  const a = stepsBetween(t, n - 1, n, 0);
  const b = stepsBetween(t, n, n + 1, 0);
  const whole = stepsBetween(t, n - 1, n + 1, 0);
  expect(whole).toEqual([...a, ...b]);
  const onsets = whole.map((e) => e.beat);
  expect(onsets).toEqual([...onsets].sort((x, y) => x - y));
  expect(new Set(whole.map((e) => `${e.beat}|${e.hz}|${e.wave}`)).size).toBe(whole.length);
  expect(stepsBetween(t, 0, 1, 0)).toEqual(stepsBetween(t, n, n + 1, 0).map((e) => ({ ...e, beat: e.beat - n })));
});
it('a hold lengthens the note before it and a rest ends it', () => {
  const t: Theme = { bpm: [120, 120, 120], bars: 1, beatsPerBar: 1, tracks: [{ wave: 'pulse', gain: 0.5, steps: 'C4 . . -' }] };
  expect(stepsBetween(t, 0, 1, 0)).toEqual([{ beat: 0, beats: 0.75, hz: noteHz('C4'), wave: 'pulse', gain: 0.5 }]);
});
it('tension brings tracks in, lifts an octave and sets the tempo', () => {
  const t = THEMES.vote;
  const quiet = stepsBetween(t, 0, length(t), 0);
  const tense = stepsBetween(t, 0, length(t), 1);
  const last = stepsBetween(t, 0, length(t), 2);
  expect(tense.length).toBeGreaterThan(quiet.length);
  expect(Math.max(...last.map((e) => e.hz))).toBeGreaterThan(Math.max(...tense.map((e) => e.hz)));
  expect([bpmAt(t, 0), bpmAt(t, 1), bpmAt(t, 2)]).toEqual([150, 170, 185]);
  expect(bpmAt(THEMES.lobby, 0)).toBe(124);
});
it('tension comes from the clock: above 10 s calm, 10 s tight, 3 s tighter', () => {
  expect(tensionFor(30000)).toBe(0);
  expect(tensionFor(10001)).toBe(0);
  expect(tensionFor(10000)).toBe(1);
  expect(tensionFor(3001)).toBe(1);
  expect(tensionFor(3000)).toBe(2);
  expect(tensionFor(0)).toBe(2);
});
