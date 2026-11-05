// The pixel sound effects as data: short lists of notes the chip plays. Pure, no DOM, no Web Audio.
import { noteHz, type Wave } from './score';

export type SfxId =
  | 'join' | 'voteOpen' | 'tick' | 'tickHigh' | 'lock' | 'callout' | 'rallyYes' | 'rallyNo'
  | 'strikeEnd' | 'endingWon' | 'endingHolds' | 'menuOpen' | 'menuClose' | 'soundOn' | 'riser';

/** at: ms from the effect's start; hzTo: slide target. A noise step's hz is the centre of its band. */
export interface SfxStep { at: number; wave: Wave; hz: number; hzTo?: number; ms: number; gain: number }

const note = (at: number, wave: Wave, name: string, ms: number, gain: number): SfxStep => ({ at, wave, hz: noteHz(name), ms, gain });

const JOIN: readonly SfxStep[] = [note(0, 'pulse', 'E5', 60, 0.3), note(60, 'pulse', 'G5', 60, 0.3)];

export const SFX: Readonly<Record<SfxId, readonly SfxStep[]>> = {
  join: JOIN,
  voteOpen: [note(0, 'pulse', 'C5', 70, 0.3), note(70, 'pulse', 'E5', 70, 0.3), note(140, 'pulse', 'G5', 70, 0.3)],
  tick: [note(0, 'pulse', 'C6', 40, 0.25)],
  // The half-second tick of the last 3 s, so each of those seconds sounds twice: C6 on the second, E6 between.
  tickHigh: [note(0, 'pulse', 'E6', 40, 0.25)],
  lock: [
    note(0, 'square', 'A2', 120, 0.6),
    { at: 0, wave: 'noise', hz: 180, ms: 90, gain: 0.35 },
  ],
  callout: [note(0, 'pulse', 'G4', 80, 0.3), note(80, 'pulse', 'C5', 80, 0.3), note(160, 'pulse', 'E5', 160, 0.3)],
  rallyYes: [
    note(0, 'pulse', 'C5', 60, 0.3), note(60, 'pulse', 'E5', 60, 0.3),
    note(120, 'pulse', 'G5', 60, 0.3), note(180, 'pulse', 'C6', 60, 0.3),
  ],
  rallyNo: [note(0, 'triangle', 'E4', 120, 0.4), note(120, 'triangle', 'C4', 120, 0.4)],
  strikeEnd: [
    note(0, 'pulse', 'C4', 300, 0.2), note(0, 'pulse', 'E4', 300, 0.2), note(0, 'pulse', 'G4', 300, 0.2),
    { at: 0, wave: 'noise', hz: 60, ms: 120, gain: 0.45 },
  ],
  endingWon: [
    note(0, 'pulse', 'C5', 180, 0.3), note(180, 'pulse', 'E5', 180, 0.3), note(360, 'pulse', 'G5', 180, 0.3),
    note(540, 'pulse', 'C6', 180, 0.3), note(720, 'pulse', 'E6', 480, 0.3),
  ],
  endingHolds: [note(0, 'square', 'A2', 500, 0.45), note(500, 'square', 'F2', 500, 0.45)],
  menuOpen: [note(0, 'triangle', 'A4', 70, 0.3)],
  menuClose: [note(0, 'triangle', 'E4', 70, 0.3)],
  soundOn: JOIN,
  // A one-bar riser for the vote's last 3 s: two detuned pulses sliding up two octaves, about one bar at 185 bpm.
  riser: [
    { at: 0, wave: 'pulse', hz: noteHz('A3'), hzTo: noteHz('A5'), ms: 1290, gain: 0.3 },
    { at: 0, wave: 'pulse', hz: noteHz('A3') * 1.01, hzTo: noteHz('A5') * 1.01, ms: 1290, gain: 0.2 },
  ],
};

/** A strike number landing: a noise burst and a square note whose pitch falls over its length; damage/biggest from 0 to 1 takes the note from 440 to 110 Hz and 90 to 220 ms. */
export function hitFor(damage: number, biggest: number): readonly SfxStep[] {
  const raw = biggest > 0 ? damage / biggest : 0;
  const r = Math.min(1, Math.max(0, Number.isFinite(raw) ? raw : 0));
  const hz = 440 * 0.25 ** r; // 440 down to 110, an even drop in pitch rather than in Hz
  const ms = 90 + 130 * r;
  return [
    { at: 0, wave: 'noise', hz: 900, ms: 40 + 60 * r, gain: 0.3 },
    { at: 0, wave: 'square', hz, hzTo: hz / 2, ms, gain: 0.45 },
  ];
}

/** At most one join blip plays per this many ms. */
export const JOIN_GAP_MS = 120;

const C_MAJOR_FROM_E5 = ['E5', 'F5', 'G5', 'A5', 'B5', 'C6', 'D6', 'E6'];

/** The join blip's base note for the nth join of a burst: E5, then up the C major scale one step per join, capped at the eighth. */
export function joinHz(nth: number): number {
  const i = Math.min(C_MAJOR_FROM_E5.length - 1, Math.max(0, Math.floor(nth) || 0));
  return noteHz(C_MAJOR_FROM_E5[i]);
}
