// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest';
import type { Chip } from '../host/audio/chip';
import { noteHz } from '../host/audio/score';
import { JOIN_GAP_MS, joinHz, type SfxStep } from '../host/audio/sfx';
import { createSound, SOUND_KEY } from '../host/audio/sound';

type FakeChip = { play: ReturnType<typeof vi.fn>; setTension: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; sfx: ReturnType<typeof vi.fn>; hit: ReturnType<typeof vi.fn>; steps: ReturnType<typeof vi.fn>; playing: null };

let clock = 0;
let chips: FakeChip[] = [];
const stubContext = {} as AudioContext;

function setup(makeContext: () => AudioContext | null = () => stubContext) {
  const makeContextSpy = vi.fn(makeContext);
  const makeChip = vi.fn((): Chip => {
    const chip: FakeChip = { play: vi.fn(), setTension: vi.fn(), stop: vi.fn(), sfx: vi.fn(), hit: vi.fn(), steps: vi.fn(), playing: null };
    chips.push(chip);
    return chip as unknown as Chip;
  });
  const sound = createSound({ target: window, storage: window.localStorage, makeContext: makeContextSpy, makeChip, now: () => clock });
  return { sound, makeContext: makeContextSpy, makeChip };
}

const press = () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));

beforeEach(() => {
  clock = 1000;
  chips = [];
  window.localStorage.clear();
});

it('nothing plays before the first gesture; the pending theme starts on it', () => {
  const { sound, makeContext, makeChip } = setup();
  sound.music('lobby');
  sound.sfx('tick');
  expect(makeContext).not.toHaveBeenCalled();
  expect(makeChip).not.toHaveBeenCalled();

  press();
  expect(makeContext).toHaveBeenCalledTimes(1);
  expect(makeChip).toHaveBeenCalledTimes(1);
  expect(makeChip).toHaveBeenCalledWith(stubContext);
  expect(chips[0].play).toHaveBeenCalledTimes(1);
  expect(chips[0].play).toHaveBeenCalledWith('lobby');
  expect(chips[0].sfx).not.toHaveBeenCalled(); // the effect before the gesture was not saved up

  press();
  window.dispatchEvent(new Event('pointerdown'));
  expect(makeContext).toHaveBeenCalledTimes(1);
  expect(makeChip).toHaveBeenCalledTimes(1);
  expect(chips[0].play).toHaveBeenCalledTimes(1);

  sound.music('vote');
  sound.tension(2);
  sound.sfx('lock');
  sound.hit(40, 80);
  expect(chips[0].play).toHaveBeenLastCalledWith('vote');
  expect(chips[0].setTension).toHaveBeenCalledWith(2);
  expect(chips[0].sfx).toHaveBeenCalledWith('lock');
  expect(chips[0].hit).toHaveBeenCalledWith(40, 80);
});

it('a context the browser refuses leaves the game silent and running', () => {
  const { sound, makeContext, makeChip } = setup(() => null);
  sound.music('lobby');
  expect(() => press()).not.toThrow();
  expect(makeContext).toHaveBeenCalledTimes(1);
  expect(makeChip).not.toHaveBeenCalled();
  expect(() => {
    sound.music('vote');
    sound.tension(1);
    sound.sfx('lock');
    sound.hit(10, 20);
    sound.join();
  }).not.toThrow();
  expect(sound.toggle()).toBe(false);
  expect(sound.toggle()).toBe(true);
  expect(sound.enabled).toBe(true);

  // A constructor that throws is the same as a refusal.
  const thrower = setup(() => { throw new Error('no audio'); });
  expect(() => press()).not.toThrow();
  expect(thrower.makeChip).not.toHaveBeenCalled();
  expect(thrower.sound.enabled).toBe(true);
});

it('toggle stops and restarts and remembers', () => {
  const { sound } = setup();
  expect(sound.enabled).toBe(true);
  sound.music('lobby');
  press();
  const chip = chips[0];

  expect(sound.toggle()).toBe(false);
  expect(sound.enabled).toBe(false);
  expect(chip.stop).toHaveBeenCalledTimes(1);
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('off');

  expect(sound.toggle()).toBe(true);
  expect(sound.enabled).toBe(true);
  expect(chip.sfx).toHaveBeenCalledWith('soundOn');
  expect(chip.play).toHaveBeenCalledTimes(2);
  expect(chip.play).toHaveBeenLastCalledWith('lobby');
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('on');

  sound.toggle();
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('off');
  const again = setup();
  expect(again.sound.enabled).toBe(false);
  again.sound.music('lobby');
  press();
  expect(again.makeContext).not.toHaveBeenCalled(); // off: the gesture makes no context
  expect(again.sound.toggle()).toBe(true); // no context yet: only the choice is stored
  expect(again.makeContext).not.toHaveBeenCalled();
  expect(window.localStorage.getItem(SOUND_KEY)).toBe('on');
  press();
  expect(again.makeContext).toHaveBeenCalledTimes(1);
  expect(chips[1].play).toHaveBeenCalledWith('lobby');
});

it('joins in a burst play at most one blip per gap and step up in pitch', () => {
  const { sound } = setup();
  press();
  const chip = chips[0];
  const blips = (): SfxStep[][] => chip.steps.mock.calls.map((c) => c[0] as SfxStep[]);
  const third = noteHz('G5') / noteHz('E5');

  for (let i = 0; i < 5; i++) {
    sound.join();
    clock += 10;
  }
  expect(blips()).toHaveLength(1);
  expect(chip.sfx).not.toHaveBeenCalled();
  const [b0] = blips();
  expect(b0).toHaveLength(2);
  expect(b0[0].hz).toBeCloseTo(noteHz('E5'), 6);
  expect(b0[1].hz).toBeCloseTo(noteHz('G5'), 6);
  expect(b0[1].at).toBe(60);

  clock = 1000 + JOIN_GAP_MS;
  sound.join();
  expect(blips()).toHaveLength(2);
  const b1 = blips()[1];
  expect(b1[0].hz).toBeCloseTo(joinHz(1), 6);
  expect(b1[0].hz).toBeCloseTo(noteHz('F5'), 6);
  expect(b1[1].hz).toBeCloseTo(joinHz(1) * third, 6);

  clock += 1000;
  sound.join();
  expect(blips()).toHaveLength(3);
  expect(blips()[2][0].hz).toBeCloseTo(noteHz('E5'), 6);
  expect(blips()[2][1].hz).toBeCloseTo(noteHz('G5'), 6);
});

it('while off, music is remembered but nothing is played', () => {
  const { sound } = setup();
  press();
  const chip = chips[0];
  expect(chip.play).not.toHaveBeenCalled(); // no theme asked for yet

  sound.toggle();
  sound.music('vote');
  sound.sfx('lock');
  sound.tension(2);
  sound.join();
  expect(chip.play).not.toHaveBeenCalled();
  expect(chip.sfx).not.toHaveBeenCalled();
  expect(chip.setTension).not.toHaveBeenCalled();
  expect(chip.steps).not.toHaveBeenCalled();

  expect(sound.toggle()).toBe(true);
  expect(chip.play).toHaveBeenCalledTimes(1);
  expect(chip.play).toHaveBeenCalledWith('vote');
});
