// Scoring: pure functions over tallies, content and players. Plain TypeScript with no DOM or
// Node globals, because shared/ is type-checked by both the DOM program and the worker program.
import type { CaseContent, SynergyTable } from './content';
import { OPTION_IDS, type DamageResult, type OptionId, type Player, type Tally } from './types';

const sum = (t: Record<OptionId, number>): number => OPTION_IDS.reduce((acc, o) => acc + t[o], 0);

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

// Shares are ratios of small whole numbers, so values that are equal on paper (a tie, exactly 60%,
// a total of x.5) can land a few bits apart in floating point. Comparisons and rounding allow this slack.
const EPS = 1e-9;

/** Math.round, except that a value a hair under a half still rounds up. */
const roundHalfUp = (x: number): number => Math.round(x + EPS);

function mapOptions(f: (o: OptionId) => number): Record<OptionId, number> {
  const out = { A: 0, B: 0, C: 0, D: 0 };
  for (const o of OPTION_IDS) out[o] = f(o);
  return out;
}

/** Each option's fraction of the votes; all zeros when nobody voted. */
export function shares(t: Tally): Record<OptionId, number> {
  const total = sum(t);
  return mapOptions((o) => (total === 0 ? 0 : t[o] / total));
}

/** Half the lead class's shares plus half the rest's. A group that cast no votes drops out. */
export function blendShares(lead: Tally, support: Tally): Record<OptionId, number> {
  const l = shares(lead);
  const s = shares(support);
  if (sum(lead) === 0) return s;
  if (sum(support) === 0) return l;
  return mapOptions((o) => (l[o] + s[o]) / 2);
}

/** The top option; the earliest letter wins a tie and the tie is flagged. All zeros is A, tied. */
export function majorityOf(s: Record<OptionId, number>): { majority: OptionId; tied: boolean } {
  let majority: OptionId = 'A';
  let tied = false;
  for (const o of OPTION_IDS.slice(1)) {
    if (s[o] > s[majority] + EPS) {
      majority = o;
      tied = false;
    } else if (s[o] >= s[majority] - EPS) {
      tied = true;
    }
  }
  return { majority, tied };
}

/** How many of the three earlier rounds have a majority the table lists as coherent with `final`. */
export function synergyHits(final: OptionId, prior: readonly (OptionId | null)[], table: SynergyTable): number {
  return table[final].reduce((hits, coherent, i) => {
    const earlier = prior[i];
    return earlier != null && coherent.includes(earlier) ? hits + 1 : hits;
  }, 0);
}

/**
 * Score out of 100 for each option. An option with a fixed evidence score keeps it; a null score
 * (round 4) is the decision base plus a bonus for each synergy hit.
 */
export function effectiveScores(content: CaseContent, roundIndex: number, prior: readonly (OptionId | null)[]): Record<OptionId, number> {
  const { decisionBase, synergyBonus } = content.scoring;
  const options = content.rounds[roundIndex].options;
  return mapOptions((o) => {
    const evidence = options.find((x) => x.id === o)?.score;
    return evidence ?? (decisionBase + synergyBonus * synergyHits(o, prior, content.synergy));
  });
}

export function computeDamage(args: {
  content: CaseContent; roundIndex: number; lead: Tally; support: Tally;
  prior: readonly (OptionId | null)[]; exhibits: number; rallies: number;
}): DamageResult {
  const { content, roundIndex, lead, support, prior, exhibits, rallies } = args;
  const k = content.scoring;

  const effective = effectiveScores(content, roundIndex, prior);
  const blended = blendShares(lead, support);
  const perOption = mapOptions((o) => blended[o] * effective[o]);
  const base = sum(perOption);
  const { majority, tied } = majorityOf(blended);
  const focus = !tied && blended[majority] >= k.focusThreshold - EPS ? k.focusBonus : 0;

  const leadShares = shares(lead);
  const supportShares = shares(support);
  const leadSide = sum(lead) > 0 ? majorityOf(leadShares) : null;
  const supportSide = sum(support) > 0 ? majorityOf(supportShares) : null;
  const aligned = leadSide !== null && supportSide !== null && !leadSide.tied && !supportSide.tied
    && leadSide.majority === supportSide.majority;
  const alignment = aligned ? k.alignmentBonus : 0;

  const exhibit = Math.min(exhibits, k.maxExhibits) * k.exhibitBonus;
  const rally = Math.min(rallies, k.maxCallouts) * k.calloutBonus;
  const total = clamp(roundHalfUp(base + focus + alignment + exhibit + rally), 0, k.roundHp);

  return {
    round: roundIndex, total, base, focus, alignment, exhibit, rally,
    leadShares, supportShares, shares: blended, effective, perOption,
    majority, tied,
    leadMajority: leadSide?.majority ?? null, supportMajority: supportSide?.majority ?? null,
    leadTied: leadSide?.tied ?? false, supportTied: supportSide?.tied ?? false,
  };
}

/** Linear from `max` at an instant answer down to 0 at the end of the window. A window of zero or less pays nothing. */
export function speedBonus(responseMs: number, windowMs: number, max: number): number {
  if (windowMs <= 0) return 0;
  return clamp(roundHalfUp(max * (1 - responseMs / windowMs)), 0, max);
}

export function pointsFor(args: {
  content: CaseContent; roundIndex: number; option: OptionId; responseMs: number; windowMs: number;
  prior: readonly (OptionId | null)[]; isLead: boolean;
}): number {
  const { content, roundIndex, option, responseMs, windowMs, prior, isLead } = args;
  const k = content.scoring;
  return effectiveScores(content, roundIndex, prior)[option]
    + speedBonus(responseMs, windowMs, k.speedBonusMax)
    + (isLead ? k.casterBonus : 0);
}

/**
 * The ending is the final round's blended majority, unless total damage is under the fragile tier. A tie goes to the
 * earlier letter (majorityOf), and `tiedWith` names the letters it was level with, so the screen can say so; it is
 * empty when the majority won outright.
 */
export function endingFor(args: {
  content: CaseContent; finalLead: Tally; finalSupport: Tally; totalDamage: number;
}): { ending: OptionId | 'holds'; tier: 'decisive' | 'fragile' | 'holds'; majority: OptionId; tiedWith: OptionId[] } {
  const { content, finalLead, finalSupport, totalDamage } = args;
  const blended = blendShares(finalLead, finalSupport);
  const { majority, tied } = majorityOf(blended);
  const tiedWith = tied ? OPTION_IDS.filter((o) => o !== majority && blended[o] >= blended[majority] - EPS) : [];
  const { tiers } = content.scoring;
  if (totalDamage >= tiers.decisive) return { ending: majority, tier: 'decisive', majority, tiedWith };
  if (totalDamage >= tiers.fragile) return { ending: majority, tier: 'fragile', majority, tiedWith };
  return { ending: 'holds', tier: 'holds', majority, tiedWith };
}

/** Synergy hits of a player's round 4 pick against their own first three; null if they missed a round. */
function ownSynergyHits(p: Player, content: CaseContent): number | null {
  const [v0, v1, v2, v3] = [0, 1, 2, 3].map((i) => p.votes[i]);
  if (!v0 || !v1 || !v2 || !v3) return null;
  return synergyHits(v3.option, [v0.option, v1.option, v2.option], content.synergy);
}

/** Most own-synergy hits among players who voted every round; ties go to the higher score. */
export function consistencyAward(players: Player[], content: CaseContent): string | null {
  const ranked = players
    .flatMap((p) => {
      const hits = ownSynergyHits(p, content);
      return hits === null ? [] : [{ id: p.id, hits, score: p.score }];
    })
    .sort((a, b) => b.hits - a.hits || b.score - a.score);
  return ranked[0]?.id ?? null;
}

/** A table name as the award groups it: trimmed, inner runs of space as one, lower case. "Table 3" and "table  3" are one table. */
const tableKey = (table: string): string => table.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Highest mean score among named tables with at least two members, named the way its first member spelled it. A
 * mean of zero wins nothing: a top table where nobody scored says nothing.
 */
export function tableAward(players: Player[]): { table: string; mean: number } | null {
  const byTable = new Map<string, { table: string; total: number; n: number }>();
  for (const p of players) {
    if (p.table === null) continue;
    const key = tableKey(p.table);
    const acc = byTable.get(key);
    if (acc) {
      acc.total += p.score;
      acc.n += 1;
    } else {
      byTable.set(key, { table: p.table, total: p.score, n: 1 });
    }
  }
  let best: { table: string; mean: number } | null = null;
  for (const { table, total, n } of byTable.values()) {
    if (n < 2) continue;
    const mean = total / n;
    if (mean <= 0) continue;
    if (best === null || mean > best.mean) best = { table, mean };
  }
  return best;
}
