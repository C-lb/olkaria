// The pure side of the Battle scene: the words around the question, the vote and the call-outs, what Space does, and
// the cues for the clock and the phases. Nothing is scored, so nothing here counts anything but votes. No Phaser and no
// DOM, so all of it is tested.
import { clockText } from '../shared/clock';
import type { CaseContent } from '../shared/content';
import { OPTION_IDS, type Callout, type HostCmd, type HostView, type Phase, type Player, type Role, type Tally } from '../shared/types';
import { tensionFor, type Tension, type ThemeId } from './audio/score';
import type { BannerArgs } from './hud/Hud';

/** The round's content; an index outside the rounds reads the nearest one. */
const roundOf = (content: CaseContent, roundIndex: number) =>
  content.rounds[Math.min(content.rounds.length - 1, Math.max(0, roundIndex))];

/** A role's name from the content: "Satya Nadella". */
export function labelFor(content: CaseContent, role: Role): string {
  return content.roles.find((r) => r.id === role)?.name ?? role;
}

/** Own-key lookup, so an id such as "constructor" is never mistaken for a player. */
const playerIn = (players: Record<string, Player>, id: string | null): Player | undefined =>
  id !== null && Object.hasOwn(players, id) ? players[id] : undefined;

// ---- The question --------------------------------------------------------------------------------------

/** What the screen says as the boss arrives, before the vote opens. */
export interface QuestionArgs { eyebrow: string; boss: string; question: string; footer: string }

/** The boss's arrival: "Question 2 of 5: Demand", the boss, the question in full, and what Space does. */
export function questionFor(content: CaseContent, round: number): QuestionArgs {
  const r = roundOf(content, round);
  const at = content.rounds.indexOf(r);
  return { eyebrow: `Question ${at + 1} of ${content.rounds.length}: ${r.problem}`, boss: r.boss, question: r.question, footer: 'Space opens the vote' };
}

// ---- Timing and Space ------------------------------------------------------------------------------------

/** The registry key of Space's lockout: the game time until which the Battle ignores Space. The Lobby sets it too. */
export const SPACE_LOCK_KEY = 'spaceLockedUntil';
/** After Space sends a command it rests this long, so a double press cannot send twice while the room answers. */
export const SEND_LOCK_MS = 1000;
/** After the kill is skipped or ends it rests this long, so the press that skipped it cannot also go on to the next boss. */
export const SKIP_LOCK_MS = 600;
/**
 * Once a view shows the vote moving from open to locked, Space rests at least this long. The room locks the vote by
 * itself at 0:00 or when the last player votes, and a press meant to lock it that lands a moment later would otherwise
 * strike at once, skipping the call-out.
 */
export const AUTO_LOCK_MS = 1500;

/**
 * How long the kill takes: the whole party strikes and the boss dies, together. Space skips it. A few seconds at most,
 * because the room is waiting for the split.
 */
export const KILL_MS = 2400;

/** What Space sees: the room's phase, whether the scene is between views of its own, whether the kill is playing, and its lockout. */
export interface SpaceState { phase: Phase; busy: boolean; killing: boolean; lockedUntil: number; time: number }

export type SpaceAction = { kind: 'send'; cmd: HostCmd } | { kind: 'skip' } | { kind: 'none' };

/**
 * What a press of Space does in the Battle. Nothing while `time` is inside the lockout or the scene is busy. During the
 * kill it skips to the end of it; otherwise it opens the vote (travel), locks it (vote), strikes (locked) or goes on to
 * the next boss or the ending (reveal). The scene sets the rest that follows: SEND_LOCK_MS after a send, SKIP_LOCK_MS
 * after a skip.
 */
export function spaceAction(s: SpaceState): SpaceAction {
  if (s.time < s.lockedUntil || s.busy) return { kind: 'none' };
  const send = (cmd: HostCmd): SpaceAction => ({ kind: 'send', cmd });
  switch (s.phase) {
    case 'travel': return send({ k: 'openVote' });
    case 'vote': return send({ k: 'closeVote' });
    case 'locked': return send({ k: 'reveal' });   // a call-out still pending counts as declined
    case 'reveal': return s.killing ? { kind: 'skip' } : send({ k: 'next' });
    default: return { kind: 'none' };
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
 * The note for a view that locks the vote: the clock's when the clock ran out, the everyone-voted one when the
 * last vote locked it, and none when Space locked it or the view locks nothing.
 */
export function lockNoteFor(prev: Phase | null, view: Pick<HostView, 'phase' | 'updatedAt' | 'voteDeadline' | 'players' | 'round'>): string | null {
  if (lockedByClock(prev, view)) return CLOCK_LOCK_NOTE;
  if (lockedEarly(prev, view)) return EVERYONE_LOCK_NOTE;
  return null;
}

// ---- The words around the vote -------------------------------------------------------------------------

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

/**
 * The hint on the cards' status line: what Space and C do now. While a call-out is pending it is empty, because the
 * banner carries Y and N then. On the reveal Space goes on to the next question, or to the ending after the last.
 */
export function optionsFooter(content: CaseContent, view: Pick<HostView, 'phase' | 'round' | 'callouts'>): string {
  const callouts = view.callouts[view.round] ?? [];
  switch (view.phase) {
    case 'vote': return 'Space locks the vote';
    case 'locked':
      if (callouts.some((co) => co.status === 'pending')) return '';
      return callouts.length < content.settings.maxCallouts ? 'C calls a student out, Space strikes' : 'Space strikes';
    case 'reveal': return view.round >= content.rounds.length - 1 ? 'Space: the ending' : 'Space: next question';
    default: return '';
  }
}

/**
 * The music and the sting on the view that moves into a phase (Battle.cuePhase), from the phase before it (`was`, null
 * on a scene's first view) and whether the vote's deadline is new. Travel, the boss's arrival: the narration theme,
 * which keeps the slot before the vote that it had when there was a road. Vote: the vote's theme and its clock back at
 * the top (`clock`), with the opening fanfare if this scene saw it open. A reopen inside an open vote (R) only restarts
 * the clock. Locked: the locked theme, with the thud when the lock came from an open vote.
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
 * The banner for the pending call-out: the student and the letter they defend, or a hand call-out when there is no
 * student to name (none was eligible, or they have left the room). Null when nothing is pending. No option text: the
 * cards under it already show every option in full.
 */
export function bannerFor(callouts: readonly Callout[], players: Record<string, Player>): BannerArgs | null {
  const co = callouts.find((x) => x.status === 'pending');
  if (co === undefined) return null;
  const footer = 'Y: valid point, N: move on';
  const student = playerIn(players, co.playerId);
  if (student === undefined) return { name: null, letter: null, footer };
  return { name: student.name, letter: co.option, footer };
}

/**
 * What Y flashes on the projector: "Valid point, Ann!", or "Valid point!" for a call-out with no student or one who has
 * left. N flashes nothing, so it returns null. Neither awards anything.
 */
export function judgeFlash(callout: Callout, players: Record<string, Player>, awarded: boolean): string | null {
  if (!awarded) return null;
  const student = playerIn(players, callout.playerId);
  return student === undefined ? 'Valid point!' : `Valid point, ${student.name}!`;
}

/** The small list under the cards: one line per call-out judged a valid point, "Valid point: Ann", or "Valid point" with no name. */
export function validNotes(callouts: readonly Callout[], players: Record<string, Player>): string[] {
  return callouts.filter((co) => co.status === 'awarded').map((co) => {
    const student = playerIn(players, co.playerId);
    return student === undefined ? 'Valid point' : `Valid point: ${student.name}`;
  });
}
