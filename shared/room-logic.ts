// The room state machine as pure functions. `reduce(state, event, content)` returns the next state and
// the effects for the caller to run (alarms, errors, kicks). Nothing here reads a clock, rolls a die or
// touches DOM or Node globals, because shared/ is type-checked by both the DOM program and the worker
// program: time arrives as `now` on every event and the call-out lottery as `pick` on the command, so
// the Durable Object and the offline client replay the same events to the same result. Inputs are never
// mutated and every result state is a new object: a change copies what it touches and shares the rest,
// a refusal or a no-op returns a copy of the state it was given.
import type { CaseContent } from './content';
import { sanitizeName, sanitizeTable } from './names';
import { computeDamage, pointsFor } from './scoring';
import {
  OPTION_IDS, ROLES,
  type Callout, type Effect, type HostCmd, type HostView, type Phase, type Player, type PlayerView,
  type Role, type RoomEvent, type RoomState, type Tally,
} from './types';

type Result = { state: RoomState; effects: Effect[] };
type JoinEvent = Extract<RoomEvent, { type: 'join' }>;
type VoteEvent = Extract<RoomEvent, { type: 'vote' }>;
type CalloutCmd = Extract<HostCmd, { k: 'callout' }>;

const REVEALED: readonly Phase[] = ['reveal', 'ending', 'leaderboard'];

const zeroTally = (): Tally => ({ A: 0, B: 0, C: 0, D: 0 });

const isRole = (role: string): role is Role => (ROLES as readonly string[]).includes(role);

/** Own-key lookup, so an id such as "constructor" is never mistaken for a player. */
const playerOf = (state: RoomState, id: string): Player | undefined =>
  Object.hasOwn(state.players, id) ? state.players[id] : undefined;

/** The lead role of a round; undefined outside the four rounds, which means the lobby. */
const leadOf = (content: CaseContent, round: number): Role | undefined => content.rounds[round]?.lead;

/** The lead role the screens show: the current round's, or the first round's while still in the lobby. */
const shownLead = (content: CaseContent, round: number): Role =>
  content.rounds[Math.min(content.rounds.length - 1, Math.max(0, round))].lead;

/**
 * The vote window in ms. A seconds value that is not a finite number above 0 counts as absent. The
 * result is never below 1, because the speed bonus divides by it.
 */
function windowMsFor(seconds: number | undefined, content: CaseContent): number {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : content.scoring.voteSeconds;
  return Math.max(1, Math.round(s * 1000));
}

const nothing = (state: RoomState): Result => ({ state: { ...state }, effects: [] });

const refuse = (state: RoomState, msg: string, clientId?: string): Result =>
  ({ state: { ...state }, effects: [clientId === undefined ? { type: 'error', msg } : { type: 'error', clientId, msg }] });

const badPhase = (state: RoomState): Result => refuse(state, 'bad phase');

/** A changed state: the patch applied to a copy, stamped with the time of the event that caused it. */
const update = (state: RoomState, now: number, patch: Partial<RoomState>, effects: Effect[] = []): Result =>
  ({ state: { ...state, ...patch, updatedAt: now }, effects });

export function initialState(code: string, hostKey: string, now: number, content: CaseContent): RoomState {
  return {
    code, hostKey, createdAt: now, updatedAt: now,
    phase: 'lobby', round: -1, voteOpenedAt: null, voteDeadline: null, voteWindowMs: windowMsFor(undefined, content),
    players: {}, banned: [], synthetic: {}, exhibits: {}, callouts: {},
    bossHp: content.rounds.length * content.scoring.roundHp, damageLog: [], majorities: [], hideNames: false,
  };
}

// ---- Tallies ---------------------------------------------------------------------------------------

/**
 * The one counting loop behind all three tallies. Synthetic votes (manual mode, bots) belong to the
 * support side and to the total, never to the lead class.
 */
function countVotes(state: RoomState, round: number, lead: Role | undefined, group: 'lead' | 'support' | 'all'): Tally {
  const tally = zeroTally();
  for (const p of Object.values(state.players)) {
    const vote = p.votes[round];
    if (vote && (group === 'all' || (p.role === lead) === (group === 'lead'))) tally[vote.option] += 1;
  }
  const synthetic = state.synthetic[round];
  if (synthetic && group !== 'lead') for (const o of OPTION_IDS) tally[o] += synthetic[o];
  return tally;
}

/** Every vote of the round, lead class, the rest and synthetic. */
export const tallyFor = (state: RoomState, round: number): Tally => countVotes(state, round, undefined, 'all');

/** Votes of the players whose role leads the round. */
export const leadTallyFor = (state: RoomState, round: number, content: CaseContent): Tally =>
  countVotes(state, round, leadOf(content, round), 'lead');

/** Votes of everyone else, plus the synthetic votes. */
export const supportTallyFor = (state: RoomState, round: number, content: CaseContent): Tally =>
  countVotes(state, round, leadOf(content, round), 'support');

// ---- Reducer ---------------------------------------------------------------------------------------

export function reduce(state: RoomState, ev: RoomEvent, content: CaseContent): { state: RoomState; effects: Effect[] } {
  switch (ev.type) {
    // The Durable Object builds a room's first state with initialState; this only keeps the event union closed.
    case 'init': return { state: initialState(ev.code, ev.hostKey, ev.now, content), effects: [] };
    case 'join': return join(state, ev);
    case 'vote': return castVote(state, ev);
    case 'tick': return tick(state, ev.now);
    case 'cmd': return ev.key === state.hostKey ? runCmd(state, ev.cmd, ev.now, content) : refuse(state, 'bad host key');
    default: return nothing(state);
  }
}

function join(state: RoomState, ev: JoinEvent): Result {
  const id = ev.clientId;
  if (state.banned.includes(id)) {
    // The error goes first: the Durable Object closes the socket when it handles `kicked`.
    return { state: { ...state }, effects: [{ type: 'error', clientId: id, msg: 'removed' }, { type: 'kicked', clientId: id }] };
  }
  if (playerOf(state, id)) return nothing(state);   // a rejoin keeps everything the player had
  if (!isRole(ev.role)) return refuse(state, 'bad role', id);
  const player: Player = {
    id, name: sanitizeName(ev.name, id), role: ev.role, table: sanitizeTable(ev.table),
    joinedAt: ev.now, score: 0, lastPoints: 0, votes: {},
  };
  return update(state, ev.now, { players: { ...state.players, [id]: player } });
}

function castVote(state: RoomState, ev: VoteEvent): Result {
  const id = ev.clientId;
  if (state.phase !== 'vote') return refuse(state, 'not accepting votes', id);
  if (ev.round !== state.round) return refuse(state, 'wrong round', id);
  const player = playerOf(state, id);
  if (!player) return refuse(state, 'unknown player', id);
  if (player.votes[ev.round]) return refuse(state, 'already voted', id);
  if (!OPTION_IDS.includes(ev.option)) return nothing(state);   // no phone button sends this, so it gets no error string
  const voted: Player = { ...player, votes: { ...player.votes, [ev.round]: { option: ev.option, at: ev.now } } };
  return update(state, ev.now, { players: { ...state.players, [id]: voted } });
}

const lock = (state: RoomState, now: number): Result => update(state, now, { phase: 'locked' }, [{ type: 'clearAlarm' }]);

/**
 * A tick at or after the deadline of an open vote locks it. An early tick (an alarm that fired ahead
 * of the deadline, or a stale one from before a reopen) changes nothing but arms the alarm again for
 * the real deadline, so an open vote is never left with nothing scheduled to close it. In any other
 * phase a tick does nothing, even in locked where the old deadline is still stored.
 */
function tick(state: RoomState, now: number): Result {
  if (state.phase !== 'vote' || state.voteDeadline === null) return nothing(state);
  if (now >= state.voteDeadline) return lock(state, now);
  return { state: { ...state }, effects: [{ type: 'setAlarm', at: state.voteDeadline }] };
}

function runCmd(state: RoomState, cmd: HostCmd, now: number, content: CaseContent): Result {
  switch (cmd.k) {
    case 'start': return start(state, now);
    case 'openVote': return openVote(state, now, cmd.seconds, content);
    case 'closeVote': return state.phase === 'vote' ? lock(state, now) : badPhase(state);
    case 'reveal': return reveal(state, now, content);
    case 'next': return next(state, now, content);
    case 'reopen': return reopen(state, now);
    case 'reset': return reset(state, now, content);
    case 'kick': return kick(state, now, cmd.playerId);
    case 'exhibit': return addExhibit(state, now, cmd.exhibitId, content);
    case 'injectVotes': return injectVotes(state, now, cmd.counts);
    case 'hideNames': return update(state, now, { hideNames: Boolean(cmd.hide) });
    case 'callout': return callOut(state, now, cmd, content);
    case 'judge': return judge(state, now, cmd.awarded, content);
    default: return nothing(state);
  }
}

function start(state: RoomState, now: number): Result {
  if (state.phase !== 'lobby') return badPhase(state);
  return update(state, now, { phase: 'travel', round: 0 });
}

function openVote(state: RoomState, now: number, seconds: number | undefined, content: CaseContent): Result {
  if (state.phase !== 'travel') return badPhase(state);
  const windowMs = windowMsFor(seconds, content);
  const deadline = now + windowMs;
  return update(state, now, { phase: 'vote', voteOpenedAt: now, voteDeadline: deadline, voteWindowMs: windowMs }, [{ type: 'setAlarm', at: deadline }]);
}

/** Locked goes back to vote and an open vote runs on, either way with a fresh deadline and the opening time kept. */
function reopen(state: RoomState, now: number): Result {
  if (state.phase !== 'locked' && state.phase !== 'vote') return badPhase(state);
  const deadline = now + state.voteWindowMs;
  return update(state, now, { phase: 'vote', voteDeadline: deadline }, [{ type: 'setAlarm', at: deadline }]);
}

/**
 * Settles a locked round: pending call-outs count as declined, the lead and support tallies become
 * damage, points are paid and the majority is recorded. Final, because reopen refuses a revealed round.
 */
function reveal(state: RoomState, now: number, content: CaseContent): Result {
  if (state.phase !== 'locked') return badPhase(state);
  const { round } = state;
  const lead = leadOf(content, round);
  const leadTally = leadTallyFor(state, round, content);
  const supportTally = supportTallyFor(state, round, content);
  const prior = state.majorities.slice(0, round);

  // A call-out still pending at the reveal was never judged, so it counts as declined.
  const callouts = (state.callouts[round] ?? []).map((co): Callout =>
    co.status === 'pending' ? { ...co, status: 'declined', points: content.scoring.calloutPointsSpoke } : co);
  const rallies = callouts.filter((co) => co.status === 'awarded').length;

  const damage = computeDamage({
    content, roundIndex: round, lead: leadTally, support: supportTally, prior,
    exhibits: (state.exhibits[round] ?? []).length, rallies,
  });

  const players = Object.fromEntries(Object.entries(state.players).map(([id, p]): [string, Player] => {
    const vote = p.votes[round];
    const calloutPoints = callouts.reduce((sum, co) => (co.playerId === id ? sum + co.points : sum), 0);
    const lastPoints = vote === undefined ? 0 : pointsFor({
      content, roundIndex: round, option: vote.option, responseMs: vote.at - (state.voteOpenedAt ?? vote.at),
      windowMs: state.voteWindowMs, prior, isLead: p.role === lead,
    }) + calloutPoints;
    return [id, { ...p, lastPoints, score: p.score + lastPoints }];
  }));

  // A round nobody voted in has no majority: recording the empty-tally fallback (A) would hand out phantom synergy later.
  const anyVotes = OPTION_IDS.some((o) => leadTally[o] + supportTally[o] > 0);
  return update(state, now, {
    phase: 'reveal',
    players,
    callouts: { ...state.callouts, [round]: callouts },
    bossHp: Math.max(0, state.bossHp - damage.total),
    damageLog: [...state.damageLog.slice(0, round), damage],
    majorities: [...state.majorities.slice(0, round), anyVotes ? damage.majority : null],
  });
}

function next(state: RoomState, now: number, content: CaseContent): Result {
  if (state.phase === 'ending') return update(state, now, { phase: 'leaderboard' });
  if (state.phase !== 'reveal') return badPhase(state);
  if (state.round >= content.rounds.length - 1) return update(state, now, { phase: 'ending' });
  return update(state, now, { phase: 'travel', round: state.round + 1, voteOpenedAt: null, voteDeadline: null });
}

/** Back to the lobby from any phase: players and bans stay, everything they earned goes. */
function reset(state: RoomState, now: number, content: CaseContent): Result {
  const players = Object.fromEntries(Object.entries(state.players).map(([id, p]): [string, Player] =>
    [id, { ...p, score: 0, lastPoints: 0, votes: {} }]));
  const fresh = initialState(state.code, state.hostKey, state.createdAt, content);
  return {
    state: { ...fresh, updatedAt: now, players, banned: state.banned, hideNames: state.hideNames },
    effects: state.phase === 'vote' ? [{ type: 'clearAlarm' }] : [],
  };
}

/** Removes the player with their votes and bans the client id, so a later join from it is refused. */
function kick(state: RoomState, now: number, playerId: string): Result {
  if (!playerOf(state, playerId)) return refuse(state, 'unknown player');
  const players = Object.fromEntries(Object.entries(state.players).filter(([id]) => id !== playerId));
  const banned = state.banned.includes(playerId) ? state.banned : [...state.banned, playerId];
  return update(state, now, { players, banned }, [{ type: 'kicked', clientId: playerId }]);
}

function addExhibit(state: RoomState, now: number, exhibitId: string, content: CaseContent): Result {
  if (state.phase !== 'travel') return refuse(state, 'not in travel');
  const have = state.exhibits[state.round] ?? [];
  if (have.length >= content.scoring.maxExhibits) return nothing(state);
  return update(state, now, { exhibits: { ...state.exhibits, [state.round]: [...have, exhibitId] } });
}

/** Whole, positive vote counts only; anything else adds nothing, so a bad number cannot poison a tally. */
const wholeVotes = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

function injectVotes(state: RoomState, now: number, counts: Partial<Tally> | undefined): Result {
  if (state.phase !== 'vote' && state.phase !== 'locked') return refuse(state, 'not accepting votes');
  const have = state.synthetic[state.round] ?? zeroTally();
  const merged = zeroTally();
  for (const o of OPTION_IDS) merged[o] = have[o] + wholeVotes(counts?.[o]);
  return update(state, now, { synthetic: { ...state.synthetic, [state.round]: merged } });
}

// ---- Call-outs -------------------------------------------------------------------------------------

const byJoinThenId = (a: Player, b: Player): number => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Who a call-out lands on: an explicitly named voter who is still eligible, else the draw over the
 * eligible voters (this round's voters not yet called), lead-class voters only while any remain.
 */
function chooseVoter(state: RoomState, called: readonly Callout[], cmd: CalloutCmd, lead: Role | undefined): Player | undefined {
  const done = new Set(called.map((co) => co.playerId));
  const eligible = Object.values(state.players)
    .filter((p) => p.votes[state.round] && !done.has(p.id))
    .sort(byJoinThenId);
  const named = eligible.find((p) => p.id === cmd.playerId);
  if (named) return named;
  const leaders = eligible.filter((p) => p.role === lead);
  const pool = leaders.length > 0 ? leaders : eligible;
  if (pool.length === 0) return undefined;
  const pick = typeof cmd.pick === 'number' && Number.isFinite(cmd.pick) ? cmd.pick : 0;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(pick * pool.length)))];
}

/** With nobody to call, the call-out has no player so the facilitator can cold-call by hand. */
function callOut(state: RoomState, now: number, cmd: CalloutCmd, content: CaseContent): Result {
  if (state.phase !== 'locked') return badPhase(state);
  const { round } = state;
  const made = state.callouts[round] ?? [];
  if (made.some((co) => co.status === 'pending')) return refuse(state, 'call-out pending');
  if (made.length >= content.scoring.maxCallouts) return refuse(state, 'call-out limit');
  const voter = chooseVoter(state, made, cmd, leadOf(content, round));
  const entry: Callout = { playerId: voter?.id ?? null, option: voter?.votes[round].option ?? null, status: 'pending', points: 0 };
  return update(state, now, { callouts: { ...state.callouts, [round]: [...made, entry] } });
}

function judge(state: RoomState, now: number, awarded: boolean, content: CaseContent): Result {
  const made = state.callouts[state.round] ?? [];
  const at = made.findIndex((co) => co.status === 'pending');
  if (at < 0) return refuse(state, 'no pending call-out');
  const { calloutPointsAwarded, calloutPointsSpoke } = content.scoring;
  const settled: Callout = { ...made[at], status: awarded ? 'awarded' : 'declined', points: awarded ? calloutPointsAwarded : calloutPointsSpoke };
  return update(state, now, { callouts: { ...state.callouts, [state.round]: made.map((co, i) => (i === at ? settled : co)) } });
}

// ---- Views -----------------------------------------------------------------------------------------

/** Everything the projector needs: the state without the host key, the lead role and the three tallies of the current round. */
export function hostView(state: RoomState, now: number, content: CaseContent): HostView {
  const { hostKey: _hostKey, ...rest } = state;
  return {
    ...rest,
    serverNow: now,
    lead: shownLead(content, state.round),
    leadTally: leadTallyFor(state, state.round, content),
    supportTally: supportTallyFor(state, state.round, content),
    tally: tallyFor(state, state.round),
  };
}

/** What one phone gets. Null for a client the room does not know (never joined, or kicked). Tallies stay hidden until the reveal. */
export function playerView(state: RoomState, clientId: string, now: number, content: CaseContent): PlayerView | null {
  const me = playerOf(state, clientId);
  if (!me) return null;
  const { round } = state;
  const lead = shownLead(content, round);
  const shown = REVEALED.includes(state.phase);
  const pending = (state.callouts[round] ?? []).find((co) => co.status === 'pending');
  const calledId = pending?.playerId ?? null;
  const calledName = calledId === null ? null : (playerOf(state, calledId)?.name ?? null);
  const everyone = Object.values(state.players);
  return {
    phase: state.phase, round, serverNow: now, voteDeadline: state.voteDeadline, voteWindowMs: state.voteWindowMs,
    name: me.name, role: me.role, table: me.table, lead, isLead: me.role === lead,
    myVote: me.votes[round]?.option ?? null, lastPoints: me.lastPoints, score: me.score,
    rank: 1 + everyone.filter((p) => p.score > me.score).length, playerCount: everyone.length,
    tally: shown ? tallyFor(state, round) : null,
    leadTally: shown ? leadTallyFor(state, round, content) : null,
    supportTally: shown ? supportTallyFor(state, round, content) : null,
    majorities: [...state.majorities],
    picks: Array.from({ length: Math.max(0, round + 1) }, (_, i) => me.votes[i]?.option ?? null),
    callout: pending ? { name: calledName, option: pending.option, isMe: pending.playerId === clientId } : null,
  };
}
