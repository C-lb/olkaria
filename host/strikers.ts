// The pure side of the Battle scene: who strikes in a round, what each strike carries, how long the reveal takes,
// what Space does, and the words around the vote and the debrief. Every number comes from the round's DamageResult
// and every bonus amount from content.scoring, so what the special attack shows adds up to what it drains (spec 3.2).
// No Phaser and no DOM, so all of it is tested.
import { clockText } from '../shared/clock';
import type { CaseContent } from '../shared/content';
import {
  OPTION_IDS, ROLES,
  type Callout, type DamageResult, type HostCmd, type HostView, type OptionId, type Phase, type Player, type Role, type Tally,
} from '../shared/types';
import { tensionFor, type Tension, type ThemeId } from './audio/score';
import type { BannerArgs, DebriefArgs, NarrationArgs } from './hud/Hud';
import { SPEAKERS } from './quotes';

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

/** Who a call-out names: the student, "Hand call-out" when it named nobody, "Removed student" once they have left the room. */
const calledWho = (co: Callout, players: Record<string, Player>): string =>
  playerIn(players, co.playerId)?.name ?? (co.playerId === null ? 'Hand call-out' : 'Removed student');

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
 * name, and a hand call-out ("Hand call-out +10") or a student no longer in the room ("Removed student +10") is struck
 * by the lead class. The two halves' figures are rounded so they add up to the base as the debrief prints it.
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
  // ("Rally" only if the damage counts more rallies than there are such call-outs, which the room never produces.)
  const won = callouts.filter((co) => co.status === 'awarded');
  const rallies = k.calloutBonus > 0 ? Math.round(d.rally / k.calloutBonus) : 0;
  for (let i = 0; i < rallies; i++) {
    const co = won[i];
    const student = playerIn(players, co?.playerId ?? null);
    const figure = `+${num(k.calloutBonus)}`;
    const who = co === undefined ? 'Rally' : calledWho(co, players);
    plan.push({ kind: 'rally', amount: k.calloutBonus, figure, label: `${who} ${figure}`, by: [student?.role ?? lead], colour: co?.option ?? null });
  }
  return plan;
}

// ---- Timing, Space and lunges -----------------------------------------------------------------------------

/** The natural length of each kind of beat of the special attack, in ms. */
export const BEAT_MS: Record<StrikePlan[number]['kind'], number> = { skip: 600, lead: 1000, support: 800, focus: 600, alignment: 600, exhibit: 600, rally: 700 };
/** The whole reveal takes at most this long (the brief's 6 s): the strikes, then the HP drain with its shake. */
export const REVEAL_MS = 6000;
export const DRAIN_MS = 1500;
/** A chained tween starts counting on the frame after the one before it ends, so each beat, and the drain, can run a frame long. */
export const FRAME_MS = 17;

/**
 * How long each beat of `plan` lasts, in ms: its natural length, squeezed in proportion when the strikes would not fit
 * in what the reveal leaves them once the drain and a frame per beat are counted.
 */
export function beatsFor(plan: StrikePlan): number[] {
  const budget = REVEAL_MS - DRAIN_MS - FRAME_MS * (plan.length + 1);
  const natural = plan.reduce((ms, step) => ms + BEAT_MS[step.kind], 0);
  const squeeze = natural > budget ? budget / natural : 1;
  return plan.map((step) => Math.floor(BEAT_MS[step.kind] * squeeze));
}

/** The registry key of Space's lockout: the game time until which the Battle ignores Space. The Lobby and Travel set it too. */
export const SPACE_LOCK_KEY = 'spaceLockedUntil';
/** After Space sends a command it rests this long, so a double press cannot send twice while the room answers. */
export const SEND_LOCK_MS = 1000;
/** After the strike is skipped or ends it rests this long, so the press that skipped it cannot also skip the debrief. */
export const SKIP_LOCK_MS = 600;
/**
 * Once a view shows the vote moving from open to locked, Space rests at least this long. The room locks the vote by
 * itself at 0:00 or when the last player votes, and a press meant to lock it that lands a moment later would otherwise
 * reveal at once, skipping the call-out.
 */
export const AUTO_LOCK_MS = 1500;

/** What Space sees: the room's phase, whether the strike is playing or the debrief is up, and its lockout. */
export interface SpaceState { phase: Phase; busy: boolean; onDebrief: boolean; lockedUntil: number; time: number }

export type SpaceAction =
  | { kind: 'ignore' }
  | { kind: 'skip'; lockedUntil: number }
  | { kind: 'send'; cmd: HostCmd; lockedUntil: number };

/**
 * What a press of Space does in the Battle. Nothing while `time` is inside the lockout. During the strike it skips to the
 * debrief; on the debrief it sends `next`; otherwise it opens the vote (travel), locks it (vote) or reveals (locked).
 * A send rests Space for a second and a skip for 600 ms.
 */
export function spaceAction(s: SpaceState): SpaceAction {
  if (s.time < s.lockedUntil) return { kind: 'ignore' };
  if (s.busy) return { kind: 'skip', lockedUntil: s.time + SKIP_LOCK_MS };
  const send = (cmd: HostCmd): SpaceAction => ({ kind: 'send', cmd, lockedUntil: s.time + SEND_LOCK_MS });
  if (s.onDebrief) return send({ k: 'next' });
  switch (s.phase) {
    case 'travel': return send({ k: 'openVote' });
    case 'vote': return send({ k: 'closeVote' });
    case 'locked': return send({ k: 'reveal' });   // a call-out still pending counts as declined (spec 6.2)
    default: return { kind: 'ignore' };
  }
}

/**
 * Space's lockout after a view moves the phase from `prev` to `next`. Vote to locked rests Space until at least
 * AUTO_LOCK_MS after `time`, and never shortens a lockout already running, so a press that sent closeVote and the view
 * it causes can arrive in either order. Any other change, and a first view that is already locked (`prev` null, a
 * reload), leaves the lockout as it is.
 */
export function lockoutAfterLock(prev: Phase | null, next: Phase, lockedUntil: number, time: number): number {
  return prev === 'vote' && next === 'locked' ? Math.max(lockedUntil, time + AUTO_LOCK_MS) : lockedUntil;
}

/** What the HUD says when the clock locked the vote: in this one lockout the press was meant for another command, so silence would read as a broken key. */
export const CLOCK_LOCK_NOTE = 'Locked by the clock. C calls a student out, Space strikes';
/** What it says when the last vote locked it instead: the same lockout, so the same silence to break. */
export const EVERYONE_LOCK_NOTE = 'Everyone has voted. C calls a student out, Space strikes';
/** How long either note stays, in ms. */
export const CLOCK_LOCK_NOTE_MS = 2000;

/**
 * True when a view moves the vote from open to locked at or after its deadline, that is when the clock ran out. The
 * room stamps every change with the time it happened, and Space can only lock early.
 */
export function lockedByClock(prev: Phase | null, view: Pick<HostView, 'phase' | 'updatedAt' | 'voteDeadline'>): boolean {
  return prev === 'vote' && view.phase === 'locked' && view.voteDeadline !== null && view.updatedAt >= view.voteDeadline;
}

/**
 * True when a view moves the vote from open to locked before its deadline with every player holding a vote this round,
 * and at least one player: the last vote locked it. A Space lock with a player still to vote reads false. Space on a
 * reopened vote that already had every vote reads true, and the note is still right.
 */
export function lockedEarly(prev: Phase | null, view: Pick<HostView, 'phase' | 'updatedAt' | 'voteDeadline' | 'players' | 'round'>): boolean {
  const players = Object.values(view.players);
  return prev === 'vote' && view.phase === 'locked' && view.voteDeadline !== null && view.updatedAt < view.voteDeadline
    && players.length > 0 && players.every((p) => p.votes[view.round] !== undefined);
}

/**
 * The note for a view that locks the vote (spec 2.5): the clock's when the clock ran out, the everyone-voted one when the
 * last vote locked it, and none when Space locked it or the view locks nothing.
 */
export function lockNoteFor(prev: Phase | null, view: Pick<HostView, 'phase' | 'updatedAt' | 'voteDeadline' | 'players' | 'round'>): string | null {
  if (lockedByClock(prev, view)) return CLOCK_LOCK_NOTE;
  if (lockedEarly(prev, view)) return EVERYONE_LOCK_NOTE;
  return null;
}

/** Where a class sprite stands: the centre of its feet, and its width. */
export interface Stand { role: Role; x: number; w: number }

/**
 * How far `movers` can lunge toward the boss together, up to `want` px, and stay `clear` px short of every sprite that
 * stands in front of one of them and is not moving with it: no sprite ever covers another.
 */
export function lungeReach(stands: readonly Stand[], movers: readonly Role[], want: number, clear: number): number {
  let reach = want;
  for (const mover of stands.filter((s) => movers.includes(s.role))) {
    for (const other of stands) {
      if (movers.includes(other.role) || other.x <= mover.x) continue;
      reach = Math.min(reach, other.x - other.w / 2 - clear - (mover.x + mover.w / 2));
    }
  }
  return Math.max(0, reach);
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

/** The quote before each of the first two rounds (spec 5.6): Ruto's before round 1, Tanui's before round 2. */
const QUOTES: readonly ('ruto' | 'tanui')[] = ['ruto', 'tanui'];

/** Before the vote: the boss, the question, the situation ending in the lead class's call to strike, and a quote. */
export function narrationFor(content: CaseContent, roundIndex: number): NarrationArgs {
  const round = roundOf(content, roundIndex);
  const quote = QUOTES[roundIndex];
  return {
    boss: round.boss, title: round.title, narration: round.narration,
    quote: quote === undefined ? undefined : `“${content.quotes[quote]}” ${SPEAKERS[quote]}`,
    footer: 'Space opens the vote',
  };
}

/**
 * The count on the status line. While the vote is `open` it says who is still to vote: "5 still to vote" (the players
 * without a vote), "Everyone has voted", or "No players yet" in an empty room. Once it is locked, "12 of 40 voted": every
 * vote of the round against everyone who could vote, the phones in the room plus the bot and key votes (`synthetic`, each
 * a voter of its own). Offline there is no room, open or locked: "12 voted". The two flags travel by name, so the one
 * call site cannot swap them.
 */
export function votedText(tally: Tally, playerCount: number, synthetic: Tally | undefined, { offline, open }: { offline: boolean; open: boolean }): string {
  const count = (t: Tally | undefined): number => (t === undefined ? 0 : OPTION_IDS.reduce((sum, o) => sum + t[o], 0));
  if (offline) return `${count(tally)} voted`;
  if (!open) return `${count(tally)} of ${playerCount + count(synthetic)} voted`;
  if (playerCount === 0) return 'No players yet';
  const waiting = Math.max(0, playerCount - (count(tally) - count(synthetic)));   // the tally holds the bot and key votes too
  return waiting === 0 ? 'Everyone has voted' : `${waiting} still to vote`;
}

/** The hint on the cards' status line: what Space, C, Y and N do in this phase, with these call-outs. */
export function optionsFooter(content: CaseContent, phase: Phase, callouts: readonly Callout[]): string {
  if (phase === 'vote') return 'Space locks the vote';
  if (phase !== 'locked') return '';
  if (callouts.some((co) => co.status === 'pending')) return 'Y convincing, N not';
  if (callouts.length >= content.scoring.maxCallouts) return 'Space: the party strikes';
  return 'C calls a student out. Space: the party strikes';
}

/**
 * The music and the sting on the view that moves into a phase (Battle.cuePhase), from the phase before it (`was`, null
 * on a scene's first view) and whether the vote's deadline is new. Travel: the narration. Vote: the vote's theme and
 * its clock back at the top (`clock`), with the opening fanfare if this scene saw it open. A reopen inside an open vote (R) only restarts the
 * clock. Locked: the locked theme, with the thud when the lock came from an open vote.
 */
export function phaseCues(was: Phase | null, phase: Phase, newDeadline: boolean): { sfx: 'voteOpen' | 'lock' | null; music: ThemeId | null; clock: boolean } {
  if (phase === 'travel') return { sfx: null, music: was === 'travel' ? null : 'narration', clock: false };
  if (phase === 'vote') {
    if (was === 'vote') return { sfx: null, music: null, clock: newDeadline };
    // A scene's first view of a vote is a reload mid-vote (a round always enters the vote from travel or locked):
    // the vote opened minutes ago, so no fanfare, only its theme.
    return { sfx: was === null ? null : 'voteOpen', music: 'vote', clock: true };
  }
  if (phase === 'locked') return { sfx: was === 'vote' ? 'lock' : null, music: was === 'locked' ? null : 'locked', clock: false };
  return { sfx: null, music: null, clock: false };
}

/** The whole seconds the clock ticks on (10 down to 1) and the half seconds it ticks high on (under 3 s), in ms left. */
const TICK_AT = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((s) => s * 1000);
const TICK_HIGH_AT = [2500, 1500, 500];
const RISER_AT = 3000;

/**
 * What the vote clock sounds between two samples of the time left (spec 3.3): the music's tension at `remainingMs`
 * (tensionFor), a tick when a whole second from 10 down to 1 was crossed, a high tick when a half second under 3 s was
 * crossed, and the riser when 3 s was crossed. A crossing is the previous sample above the mark and this one at or
 * under it, so the tick lands as timerText's figure changes. A clock that jumps several marks at once (a hidden tab's
 * timers held back) gives at most one of each, never a backlog. Pass Infinity as the first previous sample.
 */
export function clockCues(prevRemainingMs: number, remainingMs: number): { tension: Tension; tick: boolean; tickHigh: boolean; riser: boolean } {
  const crossed = (mark: number): boolean => prevRemainingMs > mark && remainingMs <= mark;
  return {
    tension: tensionFor(remainingMs),
    tick: TICK_AT.some(crossed),
    tickHigh: TICK_HIGH_AT.some(crossed),
    riser: crossed(RISER_AT),
  };
}

/** The time left to `deadline` at `now` (the room's clock), "1:23": rounded up, through clockText (shared/clock.ts); empty with no deadline. */
export function timerText(deadline: number | null, now: number): string {
  if (deadline === null) return '';
  return clockText(Math.ceil((deadline - now) / 1000));
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
  return callouts.filter((co) => co.status !== 'pending').map((co) => `${calledWho(co, players)}: ${judgeFlash(content, co.status === 'awarded')}`);
}
