// The facade the scenes use: owns the lazy audio context, the first-gesture unlock, the stored on/off
// choice and the join-burst limiter. Sound never blocks the game: while off, before the first gesture, or
// when the browser refuses a context, every method is a quiet no-op.
import { Chip, WebAudioVoicer } from './chip';
import type { Tension, ThemeId } from './score';
import { JOIN_GAP_MS, joinHz, SFX, type SfxId } from './sfx';

export interface Sound {
  music(theme: ThemeId): void;
  tension(level: Tension): void;
  sfx(id: SfxId): void;
  hit(damage: number, biggest: number): void;
  /** The join blip through the burst limiter. */
  join(): void;
  /** Flips sound on or off and returns the new state. */
  toggle(): boolean;
  readonly enabled: boolean;
}

/** "on" or "off" in localStorage; on by default. */
export const SOUND_KEY = 'olkaria.sound';

/** A burst of joins ends after this long without one; the next join starts the blip back at E5. */
const BURST_END_MS = 1000;

const GESTURES = ['keydown', 'pointerdown'] as const;

export function createSound(deps: {
  target: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  storage: Storage | null;
  /** The browser's AudioContext, or null when it cannot be made. */
  makeContext: () => AudioContext | null;
  /** Tests inject a Chip over a recording voicer. */
  makeChip?: (ctx: AudioContext) => Chip;
  now?: () => number;
}): Sound {
  const { target, storage } = deps;
  const makeChip = deps.makeChip ?? ((ctx: AudioContext) => new Chip(new WebAudioVoicer(ctx)));
  const now = deps.now ?? (() => performance.now());

  // Storage can be blocked (private windows, strict settings). Sound still works for the life of the tab.
  const readStore = (): string | null => {
    try {
      return storage?.getItem(SOUND_KEY) ?? null;
    } catch {
      return null;
    }
  };
  const writeStore = (value: 'on' | 'off'): void => {
    try {
      storage?.setItem(SOUND_KEY, value);
    } catch {
      // nothing to do: the tab just will not remember
    }
  };

  let enabled = readStore() !== 'off';
  let chip: Chip | null = null;
  let pending: ThemeId | null = null;
  /** The last tension asked for on the pending theme, kept while off or before the chip exists. */
  let kept: Tension = 0;
  let lastJoinAt: number | null = null;
  let lastBlipAt: number | null = null;
  let burstIndex = 0;

  /** Runs fn against the chip only while sound is on and the chip exists; an audio error never reaches the game. */
  const withChip = (fn: (c: Chip) => void): void => {
    if (!enabled || chip === null) return;
    try {
      fn(chip);
    } catch {
      // a failed note is a silent note
    }
  };

  let ctx: AudioContext | null = null;

  /**
   * Asks a context that is not running to resume. Called on a gesture only (the unlock, a turn on), where the browser
   * allows it; a refusal leaves it suspended and silent, and the next turn on asks again.
   */
  const wake = (): void => {
    if (ctx === null || ctx.state === 'running' || typeof ctx.resume !== 'function') return;
    try {
      ctx.resume().catch(() => {});
    } catch {
      // still suspended: silent, and the game goes on
    }
  };

  /** Makes the context and the chip, once a gesture allows it; the one-time listeners go either way. */
  const start = (): Chip | null => {
    for (const type of GESTURES) target.removeEventListener(type, unlock);
    try {
      ctx = deps.makeContext();
      if (ctx === null) return null;
      wake();
      chip = makeChip(ctx);
    } catch {
      chip = null;
    }
    return chip;
  };

  const unlock = (): void => {
    if (!enabled) return; // off: keep listening; toggle() makes the context itself when sound goes on
    if (start() !== null && pending !== null) withChip((c) => c.play(pending as ThemeId, kept));
  };
  for (const type of GESTURES) target.addEventListener(type, unlock);

  return {
    music(theme) {
      if (theme !== pending) kept = 0; // a new theme starts untightened, as in Chip.play
      pending = theme;
      withChip((c) => c.play(theme));
    },
    tension(level) {
      kept = level;
      withChip((c) => c.setTension(level));
    },
    sfx(id) {
      withChip((c) => c.sfx(id));
    },
    hit(damage, biggest) {
      withChip((c) => c.hit(damage, biggest));
    },
    join() {
      if (!enabled || chip === null) return;
      const t = now();
      if (lastJoinAt === null || t - lastJoinAt >= BURST_END_MS) burstIndex = 0;
      lastJoinAt = t;
      if (lastBlipAt !== null && t - lastBlipAt < JOIN_GAP_MS) return;
      lastBlipAt = t;
      // Both notes move together, so the second keeps its minor third above the first (E5 to G5 at n = 0).
      const k = joinHz(burstIndex) / SFX.join[0].hz;
      const steps = SFX.join.map((s) => ({ ...s, hz: s.hz * k }));
      burstIndex += 1;
      withChip((c) => c.steps(steps));
    },
    toggle() {
      enabled = !enabled;
      writeStore(enabled ? 'on' : 'off');
      // toggle() is only called from a key or a click, so it is itself a gesture: turning on can unlock.
      let live = chip;
      if (enabled) {
        if (live === null) live = start();
        else wake();
      }
      if (live === null) return enabled;
      try {
        if (!enabled) {
          live.stop();
        } else {
          live.sfx('soundOn');
          if (pending !== null) live.play(pending, kept);
        }
      } catch {
        // the choice is stored either way
      }
      return enabled;
    },
    get enabled() {
      return enabled;
    },
  };
}
