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
const round = (x: number): number => Math.round(x + EPS);

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
    return evidence ?? decisionBase + synergyBonus * synergyHits(o, prior, content.synergy);
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
  const total = clamp(round(base + focus + alignment + exhibit + rally), 0, 100);

  return {
    round: roundIndex, total, base, focus, alignment, exhibit, rally,
    leadShares, supportShares, shares: blended, effective, perOption,
    majority, tied,
    leadMajority: leadSide?.majority ?? null, supportMajority: supportSide?.majority ?? null,
    leadTied: leadSide?.tied ?? false, supportTied: supportSide?.tied ?? false,
  };
}

/** Linear from `max` at an instant answer down to 0 at the end of the window. */
export function speedBonus(responseMs: number, windowMs: number, max: number): number {
  return clamp(round(max * (1 - responseMs / windowMs)), 0, max);
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

/** The ending is the final round's blended majority, unless total damage is under the fragile tier. */
export function endingFor(args: {
  content: CaseContent; finalLead: Tally; finalSupport: Tally; totalDamage: number;
}): { ending: OptionId | 'holds'; tier: 'decisive' | 'fragile' | 'holds'; majority: OptionId } {
  const { content, finalLead, finalSupport, totalDamage } = args;
  const { majority } = majorityOf(blendShares(finalLead, finalSupport));
  const { tiers } = content.scoring;
  if (totalDamage >= tiers.decisive) return { ending: majority, tier: 'decisive', majority };
  if (totalDamage >= tiers.fragile) return { ending: majority, tier: 'fragile', majority };
  return { ending: 'holds', tier: 'holds', majority };
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

/** Highest mean score among named tables with at least two members. */
export function tableAward(players: Player[]): { table: string; mean: number } | null {
  const byTable = new Map<string, number[]>();
  for (const p of players) {
    if (p.table === null) continue;
    byTable.set(p.table, [...(byTable.get(p.table) ?? []), p.score]);
  }
  let best: { table: string; mean: number } | null = null;
  for (const [table, scores] of byTable) {
    if (scores.length < 2) continue;
    const mean = scores.reduce((acc, x) => acc + x, 0) / scores.length;
    if (best === null || mean > best.mean) best = { table, mean };
  }
  return best;
}
