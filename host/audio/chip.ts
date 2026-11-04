// The chip: a look-ahead scheduler that turns the themes and effects into timed notes, over a thin
// layer on the Web Audio API. Nothing here touches window or document; timers come in by injection.
import { bpmAt, stepsBetween, THEMES, type Tension, type ThemeId, type Wave } from './score';
import { hitFor, SFX, type SfxId, type SfxStep } from './sfx';

/** One scheduled note, in the voicer's seconds. A noise note's hz is the band it is filtered to. */
export interface VoicerNote { bus: 'music' | 'sfx'; wave: Wave; hz: number; hzTo?: number; gain: number; start: number; seconds: number }

/** The one layer over the Web Audio API. Chip talks to this; the tests hand it a recorder. */
export interface Voicer {
  now(): number;
  note(n: VoicerNote): void;
  duckMusic(ms: number): void;
  /** Every music-bus note still sounding at `at` fades to 0 over the music release from there, then stops. Effects are untouched. */
  releaseMusic(at: number): void;
  /** Every live note fades out over its bus's release from now, then stops. */
  stopAll(): void;
}

const MASTER_GAIN = 0.8;
const MUSIC_GAIN = 0.28;
const SFX_GAIN = 0.55;
const DUCK_GAIN = 0.12;
const ATTACK_S = 0.005;
const RELEASE_S: Readonly<Record<VoicerNote['bus'], number>> = { music: 0.04, sfx: 0.02 };
const PULSE_DUTY = 0.25;
const PULSE_HARMONICS = 32;

/**
 * master 0.8, music 0.28, sfx 0.55 gains; pulse as a periodic wave at 25% duty, square and triangle as
 * oscillator types, noise as a looping 1 s white buffer through a band-pass at hz with Q 1; envelopes:
 * 5 ms attack, release 40 ms for music and 20 ms for effects; a slide ramps the oscillator's frequency
 * to hzTo over the note; duckMusic drops the music gain to 0.12 at once and ramps it back over the ms given.
 */
/** A note handed to the voicer and not yet ended: what it takes to release it early. Dropped from tracking once it ends. */
interface Live { source: AudioScheduledSourceNode; env: GainNode; bus: VoicerNote['bus']; start: number; end: number; stopAt: number; gain: number }

export class WebAudioVoicer implements Voicer {
  private readonly master: GainNode;
  private readonly buses: Record<VoicerNote['bus'], GainNode>;
  private readonly pulse: PeriodicWave;
  private readonly noise: AudioBuffer;
  private readonly live = new Set<Live>();

  constructor(private readonly ctx: AudioContext) {
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_GAIN;
    this.master.connect(ctx.destination);
    const bus = (gain: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = gain;
      g.connect(this.master);
      return g;
    };
    this.buses = { music: bus(MUSIC_GAIN), sfx: bus(SFX_GAIN) };

    // A pulse at duty d: the Fourier series of a wave that is high for the first d of each period.
    const real = new Float32Array(PULSE_HARMONICS);
    const imag = new Float32Array(PULSE_HARMONICS);
    for (let n = 1; n < PULSE_HARMONICS; n++) {
      real[n] = Math.sin(2 * Math.PI * n * PULSE_DUTY) / (n * Math.PI);
      imag[n] = (1 - Math.cos(2 * Math.PI * n * PULSE_DUTY)) / (n * Math.PI);
    }
    this.pulse = ctx.createPeriodicWave(real, imag);

    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  now(): number {
    return this.ctx.currentTime;
  }

  note(n: VoicerNote): void {
    const { ctx } = this;
    const end = n.start + Math.max(n.seconds, ATTACK_S);
    const stopAt = end + RELEASE_S[n.bus];

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, n.start);
    env.gain.linearRampToValueAtTime(n.gain, n.start + ATTACK_S);
    env.gain.setValueAtTime(n.gain, end);
    env.gain.linearRampToValueAtTime(0, stopAt);
    env.connect(this.buses[n.bus]);

    let source: AudioScheduledSourceNode;
    if (n.wave === 'noise') {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = n.hz;
      band.Q.value = 1;
      src.connect(band);
      band.connect(env);
      source = src;
    } else {
      const osc = ctx.createOscillator();
      if (n.wave === 'pulse') osc.setPeriodicWave(this.pulse);
      else osc.type = n.wave;
      osc.frequency.setValueAtTime(n.hz, n.start);
      if (n.hzTo !== undefined && n.hzTo > 0) osc.frequency.exponentialRampToValueAtTime(n.hzTo, end);
      osc.connect(env);
      source = osc;
    }
    const live: Live = { source, env, bus: n.bus, start: n.start, end, stopAt, gain: n.gain };
    this.live.add(live);
    source.onended = () => {
      this.live.delete(live);
      env.disconnect();
    };
    source.start(n.start);
    source.stop(stopAt);
  }

  duckMusic(ms: number): void {
    const g = this.buses.music.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(DUCK_GAIN, t);
    g.linearRampToValueAtTime(MUSIC_GAIN, t + ms / 1000);
  }

  releaseMusic(at: number): void {
    for (const l of this.live) if (l.bus === 'music') this.release(l, at);
  }

  stopAll(): void {
    const t = this.ctx.currentTime;
    for (const l of this.live) this.release(l, t);
  }

  /** Fades one note to 0 over its bus's release from `at` and stops it there; a note not yet begun never sounds. */
  private release(l: Live, at: number): void {
    if (l.start >= at) {
      try {
        l.source.stop(at); // at or before its start: it never plays
      } catch {
        // already stopped
      }
      l.env.disconnect();
      this.live.delete(l);
      return;
    }
    if (l.end <= at) return; // already in its own release, silent within one release time
    const level = at < l.start + ATTACK_S ? (l.gain * (at - l.start)) / ATTACK_S : l.gain;
    l.end = at;
    l.stopAt = at + RELEASE_S[l.bus];
    l.env.gain.cancelScheduledValues(at);
    l.env.gain.setValueAtTime(level, at);
    l.env.gain.linearRampToValueAtTime(0, l.stopAt);
    try {
      l.source.stop(l.stopAt);
    } catch {
      // already stopped
    }
  }
}

/**
 * How far ahead of the voicer's clock the music is scheduled: a quarter second, the usual figure for a 40 ms timer, so
 * a main-thread hitch (the fullscreen toggle, a heavy frame) shorter than that leaves no gap. A switch still lands on
 * the next beat not yet scheduled, at most this much later.
 */
export const LOOKAHEAD_S = 0.25;
/** How often the scheduler wakes to top the look-ahead up. */
export const TICK_MS = 40;

type Timers = { setInterval: typeof setInterval; clearInterval: typeof clearInterval };

/**
 * The time model, in three parts:
 * - `origin`: the voicer time at which the current theme's beat 0 started, at the current tempo. A tempo
 *   change moves it, so that origin + beat * secondsPerBeat still lands on the time already reached.
 * - `reached`: the beat the schedule has reached. Every note with an onset before it has been handed to
 *   the voicer; each tick schedules from it up to the beat under now + LOOKAHEAD_S.
 * - `pending`: a switch to another theme and the whole beat of the current theme it lands on (the first
 *   whole beat not yet scheduled). When the schedule reaches that beat the old theme's notes still sounding
 *   are released there and the new theme starts at beat 0 at the same time.
 */
export class Chip {
  private current: ThemeId | null = null;
  private tension: Tension = 0;
  private origin = 0;
  private reached = 0;
  private pending: { theme: ThemeId; tension: Tension; atBeat: number } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly voicer: Voicer,
    private readonly timers: Timers = globalThis,
  ) {}

  /** The theme playing, or the one about to take over at the next beat. */
  get playing(): ThemeId | null {
    return this.pending?.theme ?? this.current;
  }

  /** Starts a theme, or switches to it at the next beat boundary; the same theme again changes only the tension. */
  play(theme: ThemeId, tension?: Tension): void {
    if (theme === this.playing) {
      if (tension !== undefined) this.setTension(tension);
      return;
    }
    if (this.current === null) {
      this.current = theme;
      this.tension = tension ?? 0;
      this.origin = this.voicer.now();
      this.reached = 0;
      this.tick();
      this.timer ??= this.timers.setInterval(() => this.tick(), TICK_MS);
      return;
    }
    if (theme === this.current) {
      // Asked back to the theme already sounding before the switch landed: stay on it.
      this.pending = null;
      if (tension !== undefined) this.setTension(tension);
      return;
    }
    this.pending = { theme, tension: tension ?? 0, atBeat: Math.ceil(this.reached) };
  }

  setTension(level: Tension): void {
    if (this.pending) this.pending.tension = level;
    if (this.current === null || level === this.tension) {
      this.tension = level;
      return;
    }
    const at = this.timeOf(this.reached);
    this.tension = level;
    this.origin = at - this.reached * this.secondsPerBeat();
  }

  /** Ends scheduling and silences the voicer. */
  stop(): void {
    if (this.timer !== null) this.timers.clearInterval(this.timer);
    this.timer = null;
    this.current = null;
    this.pending = null;
    this.voicer.releaseMusic(this.voicer.now());
    this.voicer.stopAll();
  }

  /** Schedules the effect's steps from now. */
  sfx(id: SfxId): void {
    this.steps(SFX[id]);
  }

  /** Schedules the given steps from now on the effects bus. */
  steps(steps: readonly SfxStep[]): void {
    const t0 = this.voicer.now();
    for (const s of steps) {
      this.voicer.note({
        bus: 'sfx', wave: s.wave, hz: s.hz, ...(s.hzTo !== undefined ? { hzTo: s.hzTo } : {}),
        gain: s.gain, start: t0 + s.at / 1000, seconds: s.ms / 1000,
      });
    }
  }

  /** A strike number landing: its hit, with the music ducked under it. */
  hit(damage: number, biggest: number): void {
    this.steps(hitFor(damage, biggest));
    this.voicer.duckMusic(400);
  }

  private secondsPerBeat(): number {
    return 60 / bpmAt(THEMES[this.current ?? 'lobby'], this.tension);
  }

  private timeOf(beat: number): number {
    return this.origin + beat * this.secondsPerBeat();
  }

  private tick(): void {
    if (this.current === null) return;
    const now = this.voicer.now();
    // Fell behind (a throttled timer in a background tab): pick up from now rather than play the backlog at once.
    if (this.timeOf(this.reached) < now) this.origin = now - this.reached * this.secondsPerBeat();
    const horizon = now + LOOKAHEAD_S;
    for (;;) {
      const target = (horizon - this.origin) / this.secondsPerBeat();
      const p = this.pending;
      if (p && p.atBeat <= target) {
        this.schedule(this.reached, p.atBeat);
        const at = this.timeOf(p.atBeat);
        // Called once the old theme is fully handed over, so its last notes before the boundary are released too.
        this.voicer.releaseMusic(at);
        this.current = p.theme;
        this.tension = p.tension;
        this.origin = at;
        this.reached = 0;
        this.pending = null;
        continue;
      }
      if (target > this.reached) this.schedule(this.reached, target);
      return;
    }
  }

  private schedule(fromBeat: number, toBeat: number): void {
    if (this.current === null || toBeat <= fromBeat) return;
    const spb = this.secondsPerBeat();
    for (const e of stepsBetween(THEMES[this.current], fromBeat, toBeat, this.tension)) {
      this.voicer.note({ bus: 'music', wave: e.wave, hz: e.hz, gain: e.gain, start: this.origin + e.beat * spb, seconds: e.beats * spb });
    }
    this.reached = toBeat;
  }
}
