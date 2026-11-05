// What a round's votes add up to: each option's share, and which option came out on top. Nothing is scored, so these
// only describe the split. Plain TypeScript with no DOM or Node globals, because shared/ is type-checked by both the
// DOM program and the worker program.
import { OPTION_IDS, type OptionId, type Tally } from './types';

/** Each option's part of the whole; 0 for all when the tally is empty, so nothing divides by zero. */
export function shares(t: Tally): Record<OptionId, number> {
  const total = OPTION_IDS.reduce((sum, o) => sum + t[o], 0);
  const share = (n: number): number => (total === 0 ? 0 : n / total);
  return { A: share(t.A), B: share(t.B), C: share(t.C) };
}

/**
 * The option with the most votes, and the others that drew level with it. A tie goes to the earlier letter, so the
 * same split always names the same majority. An empty tally has none: a round nobody voted in has no majority.
 * Counts are whole numbers, so the comparison is exact.
 */
export function majorityOf(t: Tally): { majority: OptionId | null; tiedWith: OptionId[] } {
  const top = Math.max(...OPTION_IDS.map((o) => t[o]));
  if (!(top > 0)) return { majority: null, tiedWith: [] };
  const [majority, ...tiedWith] = OPTION_IDS.filter((o) => t[o] === top);
  return { majority, tiedWith };
}
