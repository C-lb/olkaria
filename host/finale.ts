// The pure side of the closing scenes: which ending the class reached and what its screen says (spec 4.6), and the
// leaderboard (spec 3.2). Titles, bullets, phone labels, class names and the synergy letters come from the content,
// every number from the view. No Phaser and no DOM, so all of it is tested.
import type { CaseContent } from '../shared/content';
import { consistencyAward, endingFor, tableAward } from '../shared/scoring';
import { OPTION_IDS, type HostView, type OptionId, type Player } from '../shared/types';
import type { EndingArgs, LeaderboardArgs } from './hud/Hud';
import { labelFor } from './strikers';

/** How many players the leaderboard ranks. */
const TOP = 5;
/** What the leaderboard calls a player while names are hidden (H). */
const HIDDEN_NAME = 'Player';
/** The question the leaderboard closes on, which the class discussion picks up. */
const QUESTION = 'What should Microsoft do, and why?';
/** Said in place of the Deadlock's sentence when the final round had no votes: no option can be the ending then. */
const NO_FINAL_VOTES = 'No one voted in the final round.';

/** The ending the class reached, its tier, and the final round's blended majority: null when nobody voted in it. */
export interface Outcome { ending: OptionId | 'holds'; tier: 'decisive' | 'fragile' | 'holds'; majority: OptionId | null }

/**
 * The final round's blended majority at the tier the four rounds' damage reaches, or the Deadlock holding below the
 * fragile tier (endingFor). A final round with no votes has no majority, and endingFor would read its empty tally as
 * A, so the Deadlock holds then whatever the damage. The view's tallies are the final round's: the room stays in it
 * through the ending and the leaderboard.
 */
export function outcomeOf(content: CaseContent, view: HostView): Outcome {
  if (OPTION_IDS.every((o) => view.tally[o] === 0)) return { ending: 'holds', tier: 'holds', majority: null };
  const totalDamage = view.damageLog.reduce((sum, d) => sum + d.total, 0);
  return endingFor({ content, finalLead: view.leadTally, finalSupport: view.supportTally, totalDamage });
}

/**
 * The ending screen, over round 4's split. An option's ending: its title and tier, what must be true and the risk
 * accepted. The Deadlock holding: no tier (its title says it), its sentence, then for each earlier round what its
 * lead class chose beside the letters the final majority needed there. With no votes in the final round there is
 * nothing to compare, so no rows.
 */
export function endingArgs(content: CaseContent, view: HostView): EndingArgs {
  const { ending, tier, majority } = outcomeOf(content, view);
  const split = view.tally;
  if (ending !== 'holds') {
    const { title, mustBeTrue, risk } = content.endings[ending];
    return { title, tier, split, mustBeTrue, risk, holds: null };
  }
  const { title, text } = content.endings.holds;
  if (majority === null) return { title, tier: '', text: NO_FINAL_VOTES, split, mustBeTrue: [], risk: [], holds: [] };
  const holds = content.synergy[majority].map((coherent, i) => ({
    round: `Round ${i + 1}`, chose: chose(content, i, view.majorities[i] ?? null), needed: coherent.join(' or '),
  }));
  return { title, tier: '', text, split, mustBeTrue: [], risk: [], holds };
}

/** "Rogues chose C: Full 1 GW for the hub", the lead class of round `i` with the majority's phone label, or "Knights chose nothing". */
function chose(content: CaseContent, i: number, letter: OptionId | null): string {
  const round = content.rounds[i];
  const who = labelFor(content, round.lead, true);
  if (letter === null) return `${who} chose nothing`;
  const phone = round.options.find((o) => o.id === letter)?.phone;
  return phone === undefined ? `${who} chose ${letter}` : `${who} chose ${letter}: ${phone}`;
}

/**
 * The leaderboard: the top five by score, the earlier joiner first on a tie, each named (or "Player" while names are
 * hidden) with their class; the most consistent strategist and the top table (spec 4.4), when someone qualifies; and
 * round 4's split under the closing question.
 */
export function leaderboardArgs(content: CaseContent, view: HostView): LeaderboardArgs {
  const players = Object.values(view.players);
  const nameOf = (p: Player): string => (view.hideNames ? HIDDEN_NAME : p.name);
  const rows = [...players]
    .sort((a, b) => b.score - a.score || a.joinedAt - b.joinedAt)
    .slice(0, TOP)
    .map((p) => ({ name: nameOf(p), className: labelFor(content, p.role), score: p.score }));
  const strategistId = consistencyAward(players, content);
  const strategist = players.find((p) => p.id === strategistId);
  const top = tableAward(players);
  return {
    rows,
    consistent: strategist === undefined ? 'No one voted in all four rounds' : `Most consistent strategist: ${nameOf(strategist)}`,
    table: top === null ? null : `Top table: ${top.table} (${Math.round(top.mean)} avg)`,
    split: view.tally,
    question: QUESTION,
  };
}
