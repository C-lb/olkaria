// The pure side of the Battle scene: who strikes in a round, what each strike carries, and the words around the vote
// and the debrief. Every number comes from the round's DamageResult and every bonus amount from content.scoring, so
// what the special attack shows adds up to what it drains (spec 3.2). No Phaser and no DOM, so all of it is tested.
import type { CaseContent } from '../shared/content';
import { OPTION_IDS, ROLES, type Callout, type DamageResult, type OptionId, type Player, type Role, type Tally } from '../shared/types';
import type { BannerArgs, DebriefArgs, NarrationArgs } from './hud/Hud';

// ---- Classes ------------------------------------------------------------------------------------------

/** The round's content; an index outside the four rounds reads the nearest one. */
const roundOf = (content: CaseContent, roundIndex: number) =>
  content.rounds[Math.min(content.rounds.length - 1, Math.max(0, roundIndex))];

/** The class that leads a round's special attack, and the other three in role order. */
export function classFor(content: CaseContent, roundIndex: number): { lead: Role; support: Role[] } {
  const { lead } = roundOf(content, roundIndex);
  return { lead, support: ROLES.filter((role) => role !== lead) };
}

/** A class name from the content: "Rogue", or "Rogues" in the plural. */
export function labelFor(content: CaseContent, role: Role, plural = false): string {
  const name = content.roles.find((r) => r.id === role)?.className ?? role;
  return plural ? `${name}s` : name;
}

// ---- Numbers ------------------------------------------------------------------------------------------

/** Rounded to a tenth the way the debrief's breakdown prints it. */
const tenth = (n: number): number => Math.round(n * 10) / 10;

/** At most one decimal and no trailing zero: 15, 2.5. */
const num = (n: number): string => String(tenth(n));

/** Own-key lookup, so an id such as "constructor" is never mistaken for a player. */
const playerIn = (players: Record<string, Player>, id: string | null): Player | undefined =>
  id !== null && Object.hasOwn(players, id) ? players[id] : undefined;

// ---- The special attack ---------------------------------------------------------------------------------

export type StrikeKind = 'lead' | 'support' | 'focus' | 'alignment' | 'exhibit' | 'rally';

/** One blow of the special attack. */
export interface Strike {
  kind: StrikeKind;
  /** The damage it carries, unrounded. The amounts of a plan add up to base + focus + alignment + exhibit + rally. */
  amount: number;
  /** The number the canvas draws: one decimal for the two halves of the base ("36.7"), "+15" for a bonus. */
  figure: string;
  /** What the HUD says with it ("Focus +15", "Sarah +10"); null for the two halves, which show their number alone. */
  label: string | null;
  /** Who performs it: the lead class, the other three together, the whole party for a flourish, one class for a rally. */
  by: Role[];
  /** The option whose colour it flashes in: a group's majority for its half, the defended option for a rally. */
  colour: OptionId | null;
}

/** A half of the base that does not strike because its group cast no votes: a toast says why in its place. */
export interface Skip { kind: 'skip'; toast: string }

/** The special attack in order: the lead half, the support half, one flourish per bonus, one rally per convincing call-out. */
export type StrikePlan = (Strike | Skip)[];

/**
 * The strikes of round `roundIndex`, from its DamageResult `d`. When both groups voted, the lead class carries half of
 * its shares times the effective scores and the other three half of theirs; a group that voted alone carries all of the
 * base, and the strike of the one that did not becomes a toast. Then "Focus +15", "Party stands together +10", one
 * "Exhibit +5" per exhibit, and one rally per call-out judged convincing: the student's own class strikes with their
 * name, and a hand call-out ("Hand call-out +10") or a student no longer in the room ("Rally +10") is struck by the
 * lead class. The two halves' figures are rounded so they add up to the base as the debrief prints it.
 */
export function strikePlan(
  d: DamageResult, content: CaseContent, roundIndex: number, callouts: readonly Callout[], players: Record<string, Player>,
): StrikePlan {
  const k = content.scoring;
  const { lead, support } = classFor(content, roundIndex);
  const rogues = labelFor(content, lead, true);
  const party = [lead, ...support];
  const half = (s: Record<OptionId, number>): number => OPTION_IDS.reduce((sum, o) => sum + s[o] * d.effective[o] * 0.5, 0);
  const leadVoted = d.leadMajority !== null;
  const partyVoted = d.supportMajority !== null;
  const plan: StrikePlan = [];

  if (!leadVoted && !partyVoted) {
    plan.push({ kind: 'skip', toast: 'No one voted this round' });
  } else {
    const leadAmount = leadVoted ? (partyVoted ? half(d.leadShares) : d.base) : 0;
    const leadFigure = tenth(leadAmount);
    if (leadVoted) plan.push({ kind: 'lead', amount: leadAmount, figure: leadFigure.toFixed(1), label: null, by: [lead], colour: d.leadMajority });
    else plan.push({ kind: 'skip', toast: `No ${rogues} voted this round` });
    if (partyVoted) {
      plan.push({
        kind: 'support', amount: leadVoted ? half(d.supportShares) : d.base, figure: (tenth(d.base) - (leadVoted ? leadFigure : 0)).toFixed(1),
        label: null, by: support, colour: d.supportMajority,
      });
    } else {
      plan.push({ kind: 'skip', toast: `The party left it to the ${rogues}` });
    }
  }

  const flourish = (kind: StrikeKind, words: string, amount: number): Strike =>
    ({ kind, amount, figure: `+${num(amount)}`, label: `${words} +${num(amount)}`, by: party, colour: null });
  if (d.focus > 0) plan.push(flourish('focus', 'Focus', d.focus));
  if (d.alignment > 0) plan.push(flourish('alignment', 'Party stands together', d.alignment));
  const exhibits = k.exhibitBonus > 0 ? Math.round(d.exhibit / k.exhibitBonus) : 0;
  for (let i = 0; i < exhibits; i++) plan.push(flourish('exhibit', 'Exhibit', k.exhibitBonus));

  // The rally count comes from the damage; the names from the call-outs judged convincing, in the order they were made.
  const won = callouts.filter((co) => co.status === 'awarded');
  const rallies = k.calloutBonus > 0 ? Math.round(d.rally / k.calloutBonus) : 0;
  for (let i = 0; i < rallies; i++) {
    const co = won[i];
    const student = playerIn(players, co?.playerId ?? null);
    const figure = `+${num(k.calloutBonus)}`;
    const who = student !== undefined ? student.name : co !== undefined && co.playerId === null ? 'Hand call-out' : 'Rally';
    plan.push({ kind: 'rally', amount: k.calloutBonus, figure, label: `${who} ${figure}`, by: [student?.role ?? lead], colour: co?.option ?? null });
  }
  return plan;
}

// ---- The debrief ----------------------------------------------------------------------------------------

/**
 * How the lead class and the rest of the party lined up, in one of four forms: they stood together, a group was
 * split (a tie), they split between two options, or no one of the lead class voted. When only the lead class voted,
 * the party left it to them.
 */
export function alignmentText(d: DamageResult, content: CaseContent, roundIndex: number): string {
  const rogues = labelFor(content, classFor(content, roundIndex).lead, true);
  const lead = d.leadMajority;
  const party = d.supportMajority;
  if (lead === null) return `No ${rogues} voted this round`;
  if (d.alignment > 0) return `The party stood with the ${rogues}: both chose ${lead}`;
  if (d.leadTied || d.supportTied) {
    return [d.leadTied ? `The ${rogues} were split` : '', d.supportTied ? 'The party was split' : ''].filter((s) => s !== '').join('. ');
  }
  if (party === null) return `The party left it to the ${rogues}`;
  if (lead !== party) return `Split: ${rogues} chose ${lead}, the party chose ${party}`;
  return `The party stood with the ${rogues}: both chose ${lead}`;   // the same choice with an alignment bonus of 0
}

/** Shares are ratios, so a sum that is exactly the cap on paper can land a hair over it. */
const EPS = 1e-9;

/**
 * The debrief of round `roundIndex`: one line per option with its damage and projector line, the breakdown of `d`
 * (capped when the sum before rounding passed `scoring.roundHp`), the alignment, the rally strikes by name, and the
 * discuss line.
 */
export function debriefFor(
  d: DamageResult, content: CaseContent, roundIndex: number, callouts: readonly Callout[], players: Record<string, Player>,
): DebriefArgs {
  const round = roundOf(content, roundIndex);
  const cap = content.scoring.roundHp;
  const rallies = strikePlan(d, content, roundIndex, callouts, players).flatMap((s) => (s.kind === 'rally' && s.label !== null ? [s.label] : []));
  return {
    lines: OPTION_IDS.map((o) => ({ letter: o, damage: d.perOption[o], text: round.options.find((x) => x.id === o)?.projector ?? '' })),
    breakdown: {
      base: d.base, focus: d.focus, alignment: d.alignment, exhibit: d.exhibit, rally: d.rally, total: d.total,
      capped: d.base + d.focus + d.alignment + d.exhibit + d.rally > cap + EPS, cap,
    },
    alignment: alignmentText(d, content, roundIndex),
    rally: d.rally > 0 && rallies.length > 0 ? `Rally: ${rallies.join(', ')}` : null,
    discuss: round.discuss,
  };
}

// ---- The words around the vote -------------------------------------------------------------------------

/** The quotes before a round, with their speakers and citations (spec 5.6): Ruto before round 1, Tanui before round 2. */
const QUOTES: readonly (readonly [key: 'ruto' | 'tanui', who: string])[] = [
  ['ruto', 'President William Ruto (Semafor, 2026)'],
  ['tanui', 'PS John Tanui (James, 2026; Vimal, 2026)'],
];

/** Before the vote: the boss, the question, the situation ending in the lead class's call to strike, and a quote. */
export function narrationFor(content: CaseContent, roundIndex: number): NarrationArgs {
  const round = roundOf(content, roundIndex);
  const quote = QUOTES[roundIndex];
  return {
    boss: round.boss, title: round.title, narration: round.narration,
    quote: quote === undefined ? undefined : `“${content.quotes[quote[0]]}” ${quote[1]}`,
    footer: 'Space opens the vote',
  };
}

/** "12 of 40 voted": every vote of the round against the players in the room. Offline there is no room: "12 voted". */
export function votedText(tally: Tally, playerCount: number, offline: boolean): string {
  const votes = OPTION_IDS.reduce((sum, o) => sum + tally[o], 0);
  return offline ? `${votes} voted` : `${votes} of ${playerCount} voted`;
}

/** The seconds left to `deadline` at `now` (the room's clock), "23 s": rounded up, never below 0; empty with no deadline. */
export function timerText(deadline: number | null, now: number): string {
  if (deadline === null) return '';
  return `${Math.max(0, Math.ceil((deadline - now) / 1000))} s`;
}

/**
 * The banner for the pending call-out: the student and the option they defend with its phone label, or a hand call-out
 * when there is no student to name (none was eligible, or they have left the room). Null when nothing is pending.
 */
export function bannerFor(content: CaseContent, roundIndex: number, callouts: readonly Callout[], players: Record<string, Player>): BannerArgs | null {
  const co = callouts.find((x) => x.status === 'pending');
  if (co === undefined) return null;
  const footer = 'Y convincing, N not';
  const student = playerIn(players, co.playerId);
  if (student === undefined) return { name: null, letter: null, phone: null, footer };
  const phone = co.option === null ? null : (roundOf(content, roundIndex).options.find((o) => o.id === co.option)?.phone ?? null);
  return { name: student.name, letter: co.option, phone, footer };
}

/** What a judgement flashes: "+10 rally" when convincing, "no bonus" when not. */
export function judgeFlash(content: CaseContent, awarded: boolean): string {
  return awarded ? `+${num(content.scoring.calloutBonus)} rally` : 'no bonus';
}

/** The call-outs judged so far, for the small list under the cards: "Sarah: +10 rally", "Hand call-out: no bonus". */
export function judgedNotes(content: CaseContent, callouts: readonly Callout[], players: Record<string, Player>): string[] {
  return callouts.filter((co) => co.status !== 'pending').map((co) => {
    const who = playerIn(players, co.playerId)?.name ?? (co.playerId === null ? 'Hand call-out' : 'Removed student');
    return `${who}: ${judgeFlash(content, co.status === 'awarded')}`;
  });
}
