// The music as data: nine chiptune themes written as sixteenth-note steps (the game plays lobby, vote, locked, strike, debrief and endingWon; narration, endingHolds and leaderboard are kept but nothing starts them), and the pure
// functions that turn a window of beats into note events. No DOM, no Phaser, no Web Audio.

export type Wave = 'pulse' | 'square' | 'triangle' | 'noise';
export type ThemeId =
  | 'lobby' | 'narration' | 'vote' | 'locked'
  | 'strike' | 'debrief' | 'endingWon' | 'endingHolds' | 'leaderboard';
export type Tension = 0 | 1 | 2;

/** Sixteenth steps, space separated: a note name ("C4", "F#4", "Bb3"), "-" a rest, "." holds the note before it. On a noise track the tokens are K (kick), S (snare) and H (hat). */
export interface Track { wave: Wave; gain: number; steps: string; minTension?: Tension; octaveUpAt?: Tension }
export interface Theme { bpm: readonly [number, number, number]; bars: number; beatsPerBar: number; tracks: readonly Track[] }

export const STEPS_PER_BEAT = 4;

/** The band each drum's noise is filtered to. */
export const DRUM_HZ: Readonly<Record<'K' | 'S' | 'H', number>> = { K: 60, S: 180, H: 8000 };

const SEMITONE: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const NOTE = /^([A-G])([#b]?)(-?\d+)$/;

/** Semitones above C-1 (MIDI numbering), or NaN for a token that is not a note. */
function midiOf(name: string): number {
  const m = NOTE.exec(name);
  if (!m) return NaN;
  const accidental = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + SEMITONE[m[1]] + accidental;
}

/** 'A4' is 440; returns NaN for a token that is not a note. */
export function noteHz(name: string): number {
  const midi = midiOf(name);
  return Number.isNaN(midi) ? NaN : 440 * 2 ** ((midi - 69) / 12);
}

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** The same steps with every pitched note moved by `semitones`; rests, holds and drums stay. */
function transpose(steps: string, semitones: number): string {
  return steps
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const midi = midiOf(tok);
      if (Number.isNaN(midi)) return tok;
      const up = midi + semitones;
      return `${SHARP_NAMES[up % 12]}${Math.floor(up / 12) - 1}`;
    })
    .join(' ');
}

/** One line per bar in the source, one string out. */
const bars = (...perBar: string[]): string => perBar.join(' ');

// lobby: bouncy C major loop over I V vi IV (C G Am F), pulse lead, square bass on the beat, hats on the off-beats. 124 bpm.
const lobbyTracks: readonly Track[] = [
  {
    wave: 'pulse', gain: 0.2,
    steps: bars(
      'E5 - G5 -  E5 - C5 -  D5 - E5 -  G5 . . -',
      'D5 - G5 -  D5 - B4 -  C5 - D5 -  G5 . . -',
      'C5 - E5 -  C5 - A4 -  B4 - C5 -  E5 . . -',
      'A4 - C5 -  F5 - E5 -  D5 - C5 -  D5 - - -',
    ),
  },
  {
    wave: 'square', gain: 0.28,
    steps: bars(
      'C3 . - -  G2 . - -  C3 . - -  G2 . - -',
      'G2 . - -  D3 . - -  G2 . - -  D3 . - -',
      'A2 . - -  E3 . - -  A2 . - -  E3 . - -',
      'F2 . - -  C3 . - -  F2 . - -  C3 . - -',
    ),
  },
  {
    wave: 'noise', gain: 0.1,
    steps: bars(
      '- - H -  - - H -  - - H -  - - H -',
      '- - H -  - - H -  - - H -  - - H -',
      '- - H -  - - H -  - - H -  - - H -',
      '- - H -  - - H -  - - H -  - - H -',
    ),
  },
];

// narration: E minor, a low triangle drone on the root and a sparse pulse motif every two bars, no drums. 80 bpm.
const narrationTracks: readonly Track[] = [
  {
    wave: 'triangle', gain: 0.3,
    steps: bars(
      'E2 . . .  . . . .  . . . .  . . . .',
      '. . . .  . . . .  . . . .  . . . .',
      'E2 . . .  . . . .  . . . .  . . . .',
      '. . . .  . . . .  . . . .  . . . .',
    ),
  },
  {
    wave: 'pulse', gain: 0.12,
    steps: bars(
      '- - - -  E4 . . .  G4 . F#4 .  E4 . . .',
      '- - - -  - - - -  - - - -  - - - -',
      '- - - -  B4 . . .  A4 . G4 .  E4 . . .',
      '- - - -  - - - -  - - - -  - - - -',
    ),
  },
];

// vote: tense A minor loop over Am F C G, eighth bass, snare on 2 and 4, a pulsing triangle arpeggio, a lead
// that goes up an octave at tension 2, and a ticking lead that joins at tension 1. 150 bpm, 170 under 10 s, 185 under 3 s.
const voteTracks: readonly Track[] = [
  {
    wave: 'square', gain: 0.26,
    steps: bars(
      'A2 . A2 . A3 . A2 .  A2 . A2 . A3 . A2 .',
      'F2 . F2 . F3 . F2 .  F2 . F2 . F3 . F2 .',
      'C3 . C3 . C4 . C3 .  C3 . C3 . C4 . C3 .',
      'G2 . G2 . G3 . G2 .  G2 . G2 . G3 . G2 .',
    ),
  },
  {
    wave: 'noise', gain: 0.18,
    steps: bars(
      '- - - -  S - - -  - - - -  S - - -',
      '- - - -  S - - -  - - - -  S - - -',
      '- - - -  S - - -  - - - -  S - - -',
      '- - - -  S - - -  - - - -  S - - -',
    ),
  },
  {
    wave: 'triangle', gain: 0.2,
    steps: bars(
      'A3 C4 E4 C4  A3 C4 E4 C4  A3 C4 E4 C4  A3 C4 E4 C4',
      'F3 A3 C4 A3  F3 A3 C4 A3  F3 A3 C4 A3  F3 A3 C4 A3',
      'C4 E4 G4 E4  C4 E4 G4 E4  C4 E4 G4 E4  C4 E4 G4 E4',
      'G3 B3 D4 B3  G3 B3 D4 B3  G3 B3 D4 B3  G3 B3 D4 B3',
    ),
  },
  {
    wave: 'pulse', gain: 0.18, octaveUpAt: 2,
    steps: bars(
      'A4 . . -  C5 - E5 -  D5 . C5 -  B4 . . -',
      'A4 . . -  C5 - F5 -  E5 . D5 -  C5 . . -',
      'G4 . . -  C5 - E5 -  G5 . E5 -  D5 . . -',
      'B4 . . -  D5 - G5 -  F5 . E5 -  E5 - - -',
    ),
  },
  {
    wave: 'pulse', gain: 0.1, minTension: 1,
    steps: bars(
      'A5 - A5 - A5 - A5 -  A5 - A5 - A5 - A5 -',
      'F5 - F5 - F5 - F5 -  F5 - F5 - F5 - F5 -',
      'C6 - C6 - C6 - C6 -  C6 - C6 - C6 - C6 -',
      'G5 - G5 - G5 - G5 -  G5 - G5 - G5 - G5 -',
    ),
  },
];

// locked: the room waits. A held A minor then D minor triangle pad and a kick on every beat. 100 bpm.
const lockedTracks: readonly Track[] = [
  {
    wave: 'triangle', gain: 0.16,
    steps: bars(
      'A3 . . .  . . . .  . . . .  . . . .',
      'A3 . . .  . . . .  . . . .  . . . .',
    ),
  },
  {
    wave: 'triangle', gain: 0.16,
    steps: bars(
      'C4 . . .  . . . .  . . . .  . . . .',
      'D4 . . .  . . . .  . . . .  . . . .',
    ),
  },
  {
    wave: 'triangle', gain: 0.16,
    steps: bars(
      'E4 . . .  . . . .  . . . .  . . . .',
      'F4 . . .  . . . .  . . . .  . . . .',
    ),
  },
  {
    wave: 'noise', gain: 0.22,
    steps: bars(
      'K - - -  K - - -  K - - -  K - - -',
      'K - - -  K - - -  K - - -  K - - -',
    ),
  },
];

// strike: A minor, a kick on every beat and a two-note bass stab (A2, C3); the hits are the music. 160 bpm.
const strikeTracks: readonly Track[] = [
  {
    wave: 'noise', gain: 0.3,
    steps: bars(
      'K - - -  K - - -  K - - -  K - - -',
      'K - - -  K - - -  K - - -  K - - -',
    ),
  },
  {
    wave: 'square', gain: 0.3,
    steps: bars(
      'A2 - - A2  - - - -  C3 - - C3  - - - -',
      'A2 - - A2  - - - -  C3 - - C3  - - A2 -',
    ),
  },
];

// debrief: calm F major loop over F Dm Bb C, a soft triangle arpeggio, a soft bass and a quiet lead, no drums. 100 bpm.
const debriefTracks: readonly Track[] = [
  {
    wave: 'triangle', gain: 0.22,
    steps: bars(
      'F4 . A4 . C5 . A4 .  F4 . A4 . C5 . A4 .',
      'D4 . F4 . A4 . F4 .  D4 . F4 . A4 . F4 .',
      'Bb3 . D4 . F4 . D4 .  Bb3 . D4 . F4 . D4 .',
      'C4 . E4 . G4 . E4 .  C4 . E4 . G4 . E4 .',
    ),
  },
  {
    wave: 'square', gain: 0.14,
    steps: bars(
      'F2 . . . . . . .  C3 . . . . . . .',
      'D2 . . . . . . .  A2 . . . . . . .',
      'Bb2 . . . . . . .  F2 . . . . . . .',
      'C3 . . . . . . .  G2 . . . . . . -',
    ),
  },
  {
    wave: 'pulse', gain: 0.09,
    steps: bars(
      'C5 . . .  A4 . . .  C5 . . .  F5 . . .',
      'D5 . . .  A4 . . .  D5 . . .  F5 . . .',
      'D5 . . .  F5 . . .  D5 . . .  Bb4 . . .',
      'E5 . . .  G5 . . .  E5 . . .  C5 . . -',
    ),
  },
];

// endingWon: a major fanfare in C over I IV V I, written in 6/8: 12 steps to the bar (three beats of four), the
// lead in eighths in groups of three, the bass and kick on steps 0 and 6. 132 bpm.
const endingWonTracks: readonly Track[] = [
  {
    wave: 'pulse', gain: 0.22,
    steps: bars(
      'C5 . E5 . G5 . C6 . G5 . E5 .',
      'A4 . C5 . F5 . A5 . F5 . C5 .',
      'B4 . D5 . G5 . B5 . G5 . D5 .',
      'C5 . E5 . G5 . C6 . . . . -',
    ),
  },
  {
    wave: 'square', gain: 0.26,
    steps: bars(
      'C3 . . . . .  G2 . . . . .',
      'F2 . . . . .  C3 . . . . .',
      'G2 . . . . .  D3 . . . . .',
      'C3 . . . . .  G2 . . . . .',
    ),
  },
  {
    wave: 'noise', gain: 0.22,
    steps: bars(
      'K - - - - -  K - - - - -',
      'K - - - - -  K - - - - -',
      'K - - - - -  K - - - - -',
      'K - - - - -  K - - - - -',
    ),
  },
];

// endingHolds: a slow D minor loop over Dm Bb Gm A, a low square bass and a triangle pad in two voices, no drums. 72 bpm.
const endingHoldsTracks: readonly Track[] = [
  {
    wave: 'square', gain: 0.24,
    steps: bars(
      'D2 . . . . . . .  A2 . . . . . . .',
      'Bb1 . . . . . . .  F2 . . . . . . .',
      'G2 . . . . . . .  D3 . . . . . . .',
      'A1 . . . . . . .  E2 . . . . . . .',
    ),
  },
  {
    wave: 'triangle', gain: 0.18,
    steps: bars(
      'F3 . . . . . . .  . . . . . . . .',
      'F3 . . . . . . .  . . . . . . . .',
      'G3 . . . . . . .  . . . . . . . .',
      'A3 . . . . . . .  . . . . . . . .',
    ),
  },
  {
    wave: 'triangle', gain: 0.18,
    steps: bars(
      'A3 . . . . . . .  . . . . . . . .',
      'Bb3 . . . . . . .  . . . . . . . .',
      'Bb3 . . . . . . .  . . . . . . . .',
      'C#4 . . . . . . .  . . . . . . . .',
    ),
  },
];

const THEME_TABLE: Record<ThemeId, Theme> = {
  lobby: { bpm: [124, 124, 124], bars: 4, beatsPerBar: 4, tracks: lobbyTracks },
  narration: { bpm: [80, 80, 80], bars: 4, beatsPerBar: 4, tracks: narrationTracks },
  vote: { bpm: [150, 170, 185], bars: 4, beatsPerBar: 4, tracks: voteTracks },
  locked: { bpm: [100, 100, 100], bars: 2, beatsPerBar: 4, tracks: lockedTracks },
  strike: { bpm: [160, 160, 160], bars: 2, beatsPerBar: 4, tracks: strikeTracks },
  debrief: { bpm: [100, 100, 100], bars: 4, beatsPerBar: 4, tracks: debriefTracks },
  endingWon: { bpm: [132, 132, 132], bars: 4, beatsPerBar: 3, tracks: endingWonTracks },
  endingHolds: { bpm: [72, 72, 72], bars: 4, beatsPerBar: 4, tracks: endingHoldsTracks },
  // leaderboard: the lobby theme a fourth up (F major) and faster. 140 bpm.
  leaderboard: {
    bpm: [140, 140, 140], bars: 4, beatsPerBar: 4,
    tracks: lobbyTracks.map((t) => (t.wave === 'noise' ? t : { ...t, steps: transpose(t.steps, 5) })),
  },
};

export const THEMES: Readonly<Record<ThemeId, Theme>> = THEME_TABLE;

/** theme.bpm[tension] */
export function bpmAt(theme: Theme, tension: Tension): number {
  return theme.bpm[tension];
}

export interface NoteEvent { beat: number; beats: number; hz: number; wave: Wave; gain: number }

interface Parsed { index: number; hz: number; steps: number }

const parsed = new WeakMap<Track, Parsed[]>();

/** A track's onsets by step index, holds already merged into the note before them. */
function parse(track: Track): Parsed[] {
  const cached = parsed.get(track);
  if (cached) return cached;
  const out: Parsed[] = [];
  const tokens = track.steps.trim().split(/\s+/);
  let last: Parsed | null = null;
  tokens.forEach((tok, index) => {
    if (tok === '.') {
      if (last) last.steps += 1;
      return;
    }
    last = null;
    if (tok === '-') return;
    const hz = track.wave === 'noise' ? DRUM_HZ[tok as 'K' | 'S' | 'H'] : noteHz(tok);
    if (hz === undefined || Number.isNaN(hz)) return;
    last = { index, hz, steps: 1 };
    out.push(last);
  });
  parsed.set(track, out);
  return out;
}

/** The notes whose onset lies in [fromBeat, toBeat), the theme looping every bars * beatsPerBar beats, in onset order. A hold lengthens the note before it. Tracks whose minTension is above `tension` are left out; a track whose octaveUpAt is at or under it plays an octave up. */
export function stepsBetween(theme: Theme, fromBeat: number, toBeat: number, tension: Tension): NoteEvent[] {
  const loopSteps = theme.bars * theme.beatsPerBar * STEPS_PER_BEAT;
  const firstStep = Math.ceil(fromBeat * STEPS_PER_BEAT);
  const endStep = Math.ceil(toBeat * STEPS_PER_BEAT); // exclusive: an onset at toBeat belongs to the next window
  const out: NoteEvent[] = [];
  for (const track of theme.tracks) {
    if (track.minTension !== undefined && track.minTension > tension) continue;
    const octave = track.wave !== 'noise' && track.octaveUpAt !== undefined && track.octaveUpAt <= tension ? 2 : 1;
    const notes = parse(track);
    for (let loop = Math.floor(firstStep / loopSteps); loop * loopSteps < endStep; loop++) {
      for (const note of notes) {
        const step = loop * loopSteps + note.index;
        if (step < firstStep || step >= endStep) continue;
        out.push({
          beat: step / STEPS_PER_BEAT,
          beats: note.steps / STEPS_PER_BEAT,
          hz: note.hz * octave,
          wave: track.wave,
          gain: track.gain,
        });
      }
    }
  }
  return out.sort((a, b) => a.beat - b.beat);
}

/** Above 10000 ms: 0; 10000 or under: 1; 3000 or under: 2. */
export function tensionFor(remainingMs: number): Tension {
  if (remainingMs <= 3000) return 2;
  if (remainingMs <= 10000) return 1;
  return 0;
}
