# Chiptune Music and Pixel Sound Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the host page looping chiptune music for every phase, a vote theme that tightens as the clock runs down, and pixel sound effects for the moments that matter, all synthesised in the browser, with one key and one menu item to turn sound off.

**Architecture:** Pure data first: themes as step notation and effects as note steps in `host/audio/score.ts` and `host/audio/sfx.ts`, with pure functions that turn a beat window into note events. A `Chip` schedules those events ahead of time against a `Voicer`, the one thin layer over the Web Audio API, so the scheduler is tested with a recording fake and only the voicer is verified by ear. A `Sound` facade in the registry owns the lazy audio context (browsers only play after a gesture), the stored on/off choice and the join-burst limiter; the scenes, the menu and the hotkeys call it.

**Tech Stack:** TypeScript, Web Audio API, Phaser 3.90 (scenes only), Vitest with happy-dom.

**Spec:** `docs/superpowers/specs/2026-11-03-olkaria-sound-design.md`. Runs after `2026-11-03-olkaria-facilitator-menu.md` (it adds to the menu that plan builds and to scenes that plan edits).

## Global Constraints

- No em dashes anywhere: code, comments, copy, commit messages, docs. Plain factual voice.
- No audio files, no downloads, nothing to license: every sound is synthesised.
- Sound never blocks the game: every facade method is a no-op while sound is off or no context exists, and a browser that refuses the context leaves the game silent and running.
- Nothing plays on the phone page; `player/` is untouched.
- Gains: master 0.8, music 0.28, effects 0.55; music ducks to 0.12 under strike hits and returns over 400 ms.
- One sound per event. A burst of joins plays at most one blip per 120 ms.
- Every task ends green: `npm test`, `npm run check`, and `npm run build` for tasks that touch the host.
- Commit after each task. End every commit message with these two lines:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_019dLNhhgSFjH9LLECFDt3Q4`

## Review Focus

- A theme must loop without a gap or a doubled note at the seam, or every loop clicks. Test: Task 1, "stepsBetween crosses the loop seam in order and without repeats".
- The vote's tension must only rise within one vote and reset on a reopen, or a reopened vote starts at full tempo. Test: Task 3 verifies the Battle resets tension on the transition into `vote`.
- Sixty phones joining in a second must not fire sixty blips. Test: Task 2, "joins in a burst play at most one blip per gap and step up in pitch".
- The audio context must be created only after a user gesture, and the pending theme must start then, or the lobby is silent for good. Test: Task 2, "nothing plays before the first gesture; the pending theme starts on it".
- Turning sound off must stop the scheduler, not just mute it, or the music resumes mid-bar when turned on; turning on must start the current phase's theme. Test: Task 2, "toggle stops and restarts and remembers".

---

### Task 1: Score and effects as data

**Files:**
- Create: `host/audio/score.ts`
- Create: `host/audio/sfx.ts`
- Test: `tests/score.test.ts`, `tests/sfx.test.ts`

**Interfaces:**
- Produces:

```ts
// host/audio/score.ts (pure, no DOM, no Phaser)
export type Wave = 'pulse' | 'square' | 'triangle' | 'noise';
export type ThemeId = 'lobby' | 'travel' | 'narration' | 'vote' | 'locked' | 'strike' | 'debrief' | 'endingWon' | 'endingHolds' | 'leaderboard';
export type Tension = 0 | 1 | 2;
/** Sixteenth steps, space separated: a note name ("C4", "F#4", "Bb3"), "-" a rest, "." holds the note before it. On a noise track the tokens are K (kick), S (snare) and H (hat). */
export interface Track { wave: Wave; gain: number; steps: string; minTension?: Tension; octaveUpAt?: Tension }
export interface Theme { bpm: readonly [number, number, number]; bars: number; beatsPerBar: number; tracks: readonly Track[] }
export const STEPS_PER_BEAT = 4;
export const THEMES: Readonly<Record<ThemeId, Theme>>;
export const DRUM_HZ: Readonly<Record<'K' | 'S' | 'H', number>>;   // 60, 180, 8000: the band each drum's noise is filtered to
export function noteHz(name: string): number;                       // 'A4' is 440; returns NaN for a token that is not a note
export function bpmAt(theme: Theme, tension: Tension): number;      // theme.bpm[tension]
export interface NoteEvent { beat: number; beats: number; hz: number; wave: Wave; gain: number }
/** The notes whose onset lies in [fromBeat, toBeat), the theme looping every bars * beatsPerBar beats, in onset order. A hold lengthens the note before it. Tracks whose minTension is above `tension` are left out; a track whose octaveUpAt is at or under it plays an octave up. */
export function stepsBetween(theme: Theme, fromBeat: number, toBeat: number, tension: Tension): NoteEvent[];
export function tensionFor(remainingMs: number): Tension;           // above 10000: 0; 10000 or under: 1; 3000 or under: 2

// host/audio/sfx.ts (pure)
export type SfxId = 'join' | 'exhibit' | 'gate' | 'voteOpen' | 'tick' | 'lock' | 'callout' | 'rallyYes' | 'rallyNo' | 'strikeEnd' | 'endingWon' | 'endingHolds' | 'menuOpen' | 'menuClose' | 'soundOn' | 'riser';
export interface SfxStep { at: number; wave: Wave; hz: number; hzTo?: number; ms: number; gain: number }   // at: ms from the effect's start; hzTo: slide target
export const SFX: Readonly<Record<SfxId, readonly SfxStep[]>>;
/** A strike number landing: a noise burst and a square note whose pitch falls over its length; damage/biggest from 0 to 1 takes the note from 440 to 110 Hz and 90 to 220 ms. */
export function hitFor(damage: number, biggest: number): readonly SfxStep[];
export const JOIN_GAP_MS = 120;
/** The join blip's base note for the nth join of a burst: E5, then up the C major scale one step per join, capped at the eighth. */
export function joinHz(nth: number): number;
```

The themes follow spec 3.2 exactly for key, feel, tempo triple and tracks; the melodies are the composer's. The vote theme's ticking lead has `minTension: 1`, and its lead has `octaveUpAt: 2`. Effects follow spec 3.3 note for note where it names them.

- [ ] **Step 1: Write the failing tests**

`tests/score.test.ts`:

```ts
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
```

`tests/sfx.test.ts`:

```ts
import { expect, it } from 'vitest';
import { hitFor, JOIN_GAP_MS, joinHz, SFX } from '../host/audio/sfx';
import { noteHz } from '../host/audio/score';

it('every effect is short, in range and in order', () => {
  for (const [id, steps] of Object.entries(SFX)) {
    expect(steps.length, id).toBeGreaterThan(0);
    let at = -1;
    for (const s of steps) {
      expect(s.at, id).toBeGreaterThanOrEqual(at);
      at = s.at;
      expect(Number.isFinite(s.hz), id).toBe(true);
      expect(s.ms, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeGreaterThan(0);
      expect(s.gain, id).toBeLessThanOrEqual(1);
      if (s.hzTo !== undefined) expect(Number.isFinite(s.hzTo), id).toBe(true);
    }
    expect(at + steps[steps.length - 1].ms, id).toBeLessThanOrEqual(1500);
  }
  expect(SFX.join.map((s) => s.hz)).toEqual([noteHz('E5'), noteHz('G5')]);
  expect(SFX.rallyYes.map((s) => s.hz)).toEqual(['C5', 'E5', 'G5', 'C6'].map(noteHz));
});
it('a bigger hit is lower and longer', () => {
  const small = hitFor(5, 100);
  const big = hitFor(100, 100);
  const tone = (steps: readonly { wave: string; hz: number; ms: number }[]) => steps.find((s) => s.wave === 'square')!;
  expect(tone(small).hz).toBeGreaterThan(tone(big).hz);
  expect(tone(small).ms).toBeLessThan(tone(big).ms);
  expect(tone(big).hz).toBe(110);
  expect(tone(small).hz).toBeLessThanOrEqual(440);
  expect(hitFor(0, 0).some((s) => s.wave === 'noise')).toBe(true);
});
it('join blips step up the scale and stop at the eighth', () => {
  expect(joinHz(0)).toBe(noteHz('E5'));
  expect(joinHz(1)).toBe(noteHz('F5'));
  expect(joinHz(7)).toBe(joinHz(20));
  expect(JOIN_GAP_MS).toBe(120);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/score.test.ts tests/sfx.test.ts`
Expected: modules not found.

- [ ] **Step 3: Write the score and the effects**

Implement the interfaces. Compose each theme to its row in spec 3.2: key, feel, the tracks named, the tempo triple (themes other than `vote` repeat one tempo three times). Keep themes to 2 or 4 bars (`narration` and `locked` may be 2). Every theme needs at least a bass and a lead or pad; the ones that name drums need a noise track. Write a one-line comment over each theme saying what it is for and its key. `stepsBetween` walks the tokens from `floor(fromBeat)` to `ceil(toBeat)` modulo the loop and merges holds.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run check`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add host/audio/score.ts host/audio/sfx.ts tests/score.test.ts tests/sfx.test.ts
git commit -m "feat: chiptune themes and pixel effects as data, with the beat-window scheduler"
```

---

### Task 2: The chip and the sound facade

**Files:**
- Create: `host/audio/chip.ts`, `host/audio/sound.ts`
- Test: `tests/chip.test.ts`, `tests/sound.test.ts`

**Interfaces:**
- Consumes: `THEMES`, `stepsBetween`, `bpmAt`, `SFX`, `hitFor`, `joinHz`, `JOIN_GAP_MS` from Task 1.
- Produces:

```ts
// host/audio/chip.ts
/** One scheduled note, in the voicer's seconds. A noise note's hz is the band it is filtered to. */
export interface VoicerNote { bus: 'music' | 'sfx'; wave: Wave; hz: number; hzTo?: number; gain: number; start: number; seconds: number }
/** The one layer over the Web Audio API. Chip talks to this; the tests hand it a recorder. */
export interface Voicer { now(): number; note(n: VoicerNote): void; duckMusic(ms: number): void; stopAll(): void }
export class WebAudioVoicer implements Voicer { constructor(ctx: AudioContext) }
// master 0.8, music 0.28, sfx 0.55 gains; pulse as a periodic wave at 25% duty, square and triangle as oscillator types, noise as a looping 1 s white buffer through a band-pass at hz with Q 1; envelopes: 5 ms attack, release 40 ms for music and 20 ms for effects; a slide ramps the oscillator's frequency to hzTo over the note; duckMusic drops the music gain to 0.12 at once and ramps it back over the ms given.
export const LOOKAHEAD_S = 0.12;
export const TICK_MS = 40;
export class Chip {
  constructor(voicer: Voicer, timers: { setInterval: typeof setInterval; clearInterval: typeof clearInterval } = globalThis);
  /** Starts a theme, or switches to it at the next beat boundary; the same theme again changes only the tension. */
  play(theme: ThemeId, tension?: Tension): void;
  setTension(level: Tension): void;
  stop(): void;                                   // ends scheduling and silences the voicer
  sfx(id: SfxId): void;                           // schedules the effect's steps from now
  hit(damage: number, biggest: number): void;     // hitFor, plus duckMusic(400)
  readonly playing: ThemeId | null;
}

// host/audio/sound.ts
export interface Sound {
  music(theme: ThemeId): void;
  tension(level: Tension): void;
  sfx(id: SfxId): void;
  hit(damage: number, biggest: number): void;
  join(): void;                                   // the join blip through the burst limiter
  toggle(): boolean;                              // the new state
  readonly enabled: boolean;
}
export const SOUND_KEY = 'olkaria.sound';         // "on" or "off" in localStorage; on by default
export function createSound(deps: {
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  storage: Storage | null;
  makeContext: () => AudioContext | null;         // the browser's AudioContext, or null when it cannot be made
  makeChip?: (ctx: AudioContext) => Chip;         // tests inject a Chip over a recording voicer
  now?: () => number;
}): Sound;
```

Facade behaviour: on creation it reads the stored choice. It listens once for `keydown` and `pointerdown` on `target`; on the first, if enabled, it makes the context and the chip, removes both listeners, and plays the pending theme (the last `music()` asked for). `music()`, `tension()`, `sfx()`, `hit()` and `join()` are no-ops while disabled or before the chip exists, except that `music()` always records the pending theme. `join()` plays `SFX.join` with its two notes transposed to `joinHz(n)` and `joinHz(n) * 5 / 4`... no: the second note keeps its interval above the first (a minor third up, as E5 to G5), where `n` is the join's index in the current burst (a burst ends after 1000 ms without a join) and at most one blip plays per `JOIN_GAP_MS`; later joins inside the gap are dropped. `toggle()` flips the state, stores it, and either stops the chip (off) or, when a context exists, plays `soundOn` and the pending theme (on); when no context exists yet it only stores the choice. `enabled` reads the state.

- [ ] **Step 1: Write the failing tests**

`tests/chip.test.ts`, with a recording voicer `{ now: () => clock, note: vi.fn(), duckMusic: vi.fn(), stopAll: vi.fn() }` and fake timers:

```ts
it('schedules the first look-ahead of a theme at once and the rest on each tick, in order', ...)   // play('lobby'); notes recorded have start in [now, now + LOOKAHEAD_S]; advance clock and timers by TICK_MS; more notes, starts never go backwards, none scheduled twice
it('switches themes on the beat and ignores the same theme', ...)   // play('lobby'); play('vote') mid-beat: the first vote note starts at the next beat boundary; play('vote') again: no change; playing === 'vote'
it('tension changes the tempo of what comes next', ...)   // play('vote', 0) then setTension(2): the gap between following onsets shrinks by 150/185
it('stop ends scheduling and silences', ...)   // after stop(), ticks add no notes and stopAll was called; playing === null
it('an effect plays from now and a hit ducks the music', ...)   // sfx('lock'): notes at now + at/1000 with bus 'sfx'; hit(50, 100): duckMusic(400) called once, a noise and a square note recorded
```

`tests/sound.test.ts` (`// @vitest-environment happy-dom`), with `makeContext` returning a stub and `makeChip` returning a fake chip `{ play: vi.fn(), setTension: vi.fn(), stop: vi.fn(), sfx: vi.fn(), hit: vi.fn(), playing: null }`:

```ts
it('nothing plays before the first gesture; the pending theme starts on it', ...)   // music('lobby'); chip not made; dispatch keydown on window: makeContext called once, chip.play('lobby'); a second keydown makes nothing new
it('a context the browser refuses leaves the game silent and running', ...)   // makeContext returns null: no throw; music(), sfx(), toggle() all safe; enabled still true
it('toggle stops and restarts and remembers', ...)   // after the gesture: toggle() returns false, chip.stop called, storage has "off"; toggle() returns true, chip.sfx('soundOn') and chip.play(pending) called, storage "on"; a new createSound over the same storage starts disabled when "off" is stored
it('joins in a burst play at most one blip per gap and step up in pitch', ...)   // five join() within 50 ms: one chip.sfx or note call; advance 120 ms, join(): a second, pitched one scale step up; advance 1000 ms quiet, join(): back to E5
it('while off, music is remembered but nothing is played', ...)   // toggle off, music('vote'): chip.play not called; toggle on: chip.play('vote')
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/chip.test.ts tests/sound.test.ts`
Expected: modules not found.

- [ ] **Step 3: Chip and voicer**

Write `Chip` as a look-ahead scheduler: it keeps the beat position and the voicer time of the current theme's start, and on each tick schedules `stepsBetween(theme, fromBeat, toBeat, tension)` for the beats that fall before `now + LOOKAHEAD_S`, converting beats to seconds with `bpmAt`. A theme switch is queued for the next whole beat; a tension change applies to the beats scheduled after it. Write `WebAudioVoicer` to the comment on its interface. Nothing in `chip.ts` touches `window` or `document`.

- [ ] **Step 4: Facade**

Write `createSound` to the behaviour above, with the storage reads and writes guarded by try/catch as `player/main.ts` does.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run check`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add host/audio/chip.ts host/audio/sound.ts tests/chip.test.ts tests/sound.test.ts
git commit -m "feat: a look-ahead chip over the Web Audio API and the sound facade with the gesture unlock"
```

---

### Task 3: Hooks, the S key, the menu item, the runbook

**Files:**
- Modify: `host/main.ts` (registry `sound`, `createSound` with the browser's `AudioContext`)
- Modify: `host/scenes/Lobby.ts`, `host/scenes/Travel.ts`, `host/scenes/Battle.ts`, `host/scenes/Ending.ts`, `host/scenes/Leaderboard.ts`
- Modify: `host/menu.ts` (the Sound item, open and close effects), `host/hotkeys.ts` (S), `host/hud/Hud.ts` (KEYS row)
- Modify: `RUNBOOK.md`, `README.md`
- Test: `tests/menu.test.ts`, `tests/hotkeys.test.ts`, `tests/strikers.test.ts` if a pure helper lands there

**Interfaces:**
- Consumes: `Sound` from the registry under `sound`; `tensionFor` from Task 1; the menu's `MenuItem` and `installMenu` from the menu plan; the Battle's `tickClock`, `strike` and `onView`.
- Produces: the hooks of spec 4; `menuItems(content, view, mode, link, sound: { enabled: boolean })` grows a fourth action `{ id: 'sound', label: enabled ? 'Sound off' : 'Sound on', hint: 'S does the same.', enabled: true, confirm: false, act: { kind: 'sound' } }`; `installMenu` takes the `Sound` and toggles it for that act, and plays `menuOpen` and `menuClose`; `installHotkeys` takes the `Sound` and on S toggles it and toasts "Sound off" or "Sound on" for 1500 ms; KEYS gains `['S', 'Sound off or on']`.

Hooks, one per event, exactly:
- Lobby: `create` plays `lobby`; `syncAvatars` calls `sound.join()` once per avatar it drops.
- Travel: `create` plays `travel`; `collect` plays `exhibit`; `enterArena` plays `gate`.
- Battle `onView`: a view in `travel` plays `narration`; the first view in `vote` of a round (and after a reopen, from `locked` to `vote`) plays `voteOpen`, then `vote` with tension 0; the move into `locked` plays `lock` and `locked`; a call-out newly pending plays `callout`; a judgement plays `rallyYes` or `rallyNo` (where `flashJudgements` already tells them apart); `strike` plays `strike` when it starts, `hit(damage, biggest)` as each number lands (the per-option numbers against the total as biggest), and `strikeEnd` then `debrief` when the drain ends; a resumed reveal (the debrief shown directly) plays `debrief`. `tickClock` computes `tensionFor(remaining)` and calls `sound.tension` when the level rises, plays `tick` once at each whole second from 10 down to 1 and at each half second from 3 down, and plays `riser` once when the level reaches 2. The tension level is kept on the scene and reset to 0 on every entry into `vote`.
- Ending: `create` plays `endingWon` or `endingHolds` as both the effect and the theme, from `outcomeOf`.
- Leaderboard: `create` plays `leaderboard`.
- A reset lands in the Lobby, whose `create` plays `lobby`; nothing more to do.

- [ ] **Step 1: Write the failing tests**

`tests/menu.test.ts`: the fourth action with its label by state; picking it calls `sound.toggle()` and does not close the menu but redraws the label; opening plays `menuOpen` and closing `menuClose` on the fake sound.
`tests/hotkeys.test.ts`: S calls `sound.toggle()` and toasts "Sound off" when it returns false and "Sound on" when true; Shift+S does nothing.
If the Battle's tick logic is pulled into a pure helper (recommended: `clockCues(prevRemainingMs, remainingMs): { tension: Tension; tick: boolean; riser: boolean }` in `host/strikers.ts`), test it in `tests/strikers.test.ts`: crossing 10 s gives tension 1 and a tick; crossing each whole second down to 1 gives a tick; crossing 3 s gives tension 2 and the riser once; half seconds under 3 s tick; nothing above 10 s.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/menu.test.ts tests/hotkeys.test.ts tests/strikers.test.ts`
Expected: the new tests fail.

- [ ] **Step 3: Wire it**

`main.ts`: `const sound = createSound({ target: window, storage: safeLocalStorage(), makeContext: () => (typeof AudioContext === 'undefined' ? null : new AudioContext()) })` and `game.registry.set('sound', sound)`; pass `sound` to `installHotkeys` and `installMenu`. Then the hooks above, each a one-liner at the event's existing site. Update the registry note in `main.ts`.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 5: Listen**

`npm run dev`, open `http://localhost:5173/host/?mode=offline`, click once, and with the speakers on: the lobby loop plays without a seam click; Space: travel; the gate: narration; Space: the vote theme, tightening at 10 s and again at 3 s with ticks and the riser, locking with a thud; B, Space: hits under the numbers, the music ducked and back; the debrief loop; and so on to the ending. S silences at once and brings it back where it is. The implementer records what the browser's console shows (`AudioContext.state` is `running`, no errors) and what was heard; Caleb judges the music by ear in rehearsal.

- [ ] **Step 6: RUNBOOK and README**

RUNBOOK: Keys table gains `| S | Sound off or on |`; "Before class" step 4 becomes "Click once on the game, so the keys work and the music starts."; "If something breaks" gains "**No sound.** Check the laptop's output and its volume, then press S twice. The browser plays nothing until the page has been clicked or a key pressed once."; the menu's entry names the Sound item. README: one line under "More" naming the chiptune music and the S key.

- [ ] **Step 7: Commit**

```bash
git add host/main.ts host/scenes host/menu.ts host/hotkeys.ts host/hud/Hud.ts tests RUNBOOK.md README.md
git commit -m "feat: music per phase, a vote theme that tightens, pixel effects, and S to silence it"
```
