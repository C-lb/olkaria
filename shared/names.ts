// Player names and teams: a generated fallback, the cleaning applied to typed names, and the eight teams a phone picks from.
// Plain TypeScript with no DOM or Node globals, because shared/ is type-checked by both the DOM
// program and the worker program.

const MAX_LENGTH = 16;

// Generated names must fit the same 16-character cap as typed ones. Every first word is 7 letters or fewer
// and every second word 8 or fewer, so the longest pairing is exactly 16 (tests/names.test.ts checks them all).
export const NAME_FIRST_WORDS: readonly string[] = [
  'Steam', 'Rift', 'Olkaria', 'Savanna', 'Thermal', 'Fissure', 'Acacia', 'Silicon', 'Nairobi', 'Azure', 'Pylon', 'Ochre',
  'Magma', 'Turbine', 'Basalt', 'Cobalt', 'Amber', 'Mara', 'Tsavo', 'Copper', 'Granite', 'Dynamo', 'Lattice', 'Rotor',
];
export const NAME_SECOND_WORDS: readonly string[] = [
  'Gecko', 'Giraffe', 'Heron', 'Weaver', 'Mongoose', 'Hornbill', 'Ibis', 'Zebra', 'Dikdik', 'Crane', 'Serval', 'Oryx',
  'Eland', 'Kudu', 'Hyrax', 'Egret', 'Topi', 'Bongo', 'Hyena', 'Stork', 'Kite', 'Lion', 'Otter', 'Genet',
];

/** FNV-1a, 32 bit, over the UTF-16 code units of `text`. */
function fnv1a(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Two capitalised words from fixed lists: the same two for the same seed. */
export function generateName(seed: string): string {
  const h = fnv1a(seed);
  const first = NAME_FIRST_WORDS[h % NAME_FIRST_WORDS.length];
  const second = NAME_SECOND_WORDS[Math.floor(h / NAME_FIRST_WORDS.length) % NAME_SECOND_WORDS.length];
  return `${first} ${second}`;
}

/** Control characters removed, trimmed, cut to 16 characters (and trimmed again, so the cut cannot leave a trailing space). */
function clean(raw: string | undefined): string {
  const text = typeof raw === 'string' ? raw : '';
  return text.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_LENGTH).trimEnd();
}

/** The cleaned name, or the generated one for `seed` when nothing is left. */
export function sanitizeName(raw: string | undefined, seed: string): string {
  return clean(raw) || generateName(seed);
}

/** The teams of the join form's dropdown. A team is only a label: it shows on the phone and changes nothing else. */
export const TEAMS: readonly string[] = ['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6', 'Team 7', 'Team 8'];

/** The team when `raw` is exactly one of TEAMS, else null. Nothing is trimmed, because the dropdown sends the value as it is. */
export function sanitizeTeam(raw: unknown): string | null {
  return typeof raw === 'string' && TEAMS.includes(raw) ? raw : null;
}
