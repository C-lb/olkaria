// The room state machine as pure functions. `reduce(state, event, content)` returns the next state and
// the effects for the caller to run (alarms, errors, kicks). Nothing here reads a clock, rolls a die or
// touches DOM or Node globals, because shared/ is type-checked by both the DOM program and the worker
// program: time arrives as `now` on every event and the call-out lottery as `pick` on the command, so
// the Durable Object and the offline client replay the same events to the same result. Inputs are never
// mutated and every result state is a new object: a change copies what it touches and shares the rest,
// a refusal or a no-op returns a copy of the state it was given.
// Nothing is scored: a round records only its votes, its call-outs and its majority.
// `goto` jumps to a stage, clearing the rounds from there on; `trips` counts the times the party set off for a boss.
// sanitizeState makes a room saved by an earlier build safe for this one; the Durable Object loads every room through it.
import type { CaseContent } from './content';
import { generateName, sanitizeName, sanitizeTeam, TEAMS } from './names';
import { majorityOf } from './tally';
import {
  OPTION_IDS, ROLES,
  type Callout, type Effect, type HostCmd, type HostView, type OptionId, type Phase, type Player, type PlayerView,
  type Role, type RoomEvent, type RoomState, type Tally, type Vote,
} from './types';

type Result = { state: RoomState; effects: Effect[] };
type JoinEvent = Extract<RoomEvent, { type: 'join' }>;
type VoteEvent = Extract<RoomEvent, { type: 'vote' }>;
type CalloutCmd = Extract<HostCmd, { k: 'callout' }>;

const PHASES: readonly Phase[] = ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'];

const zeroTally = (): Tally => ({ A: 0, B: 0, C: 0 });

const isRole = (role: unknown): role is Role => (ROLES as readonly unknown[]).includes(role);

const isOption = (option: unknown): option is OptionId => (OPTION_IDS as readonly unknown[]).includes(option);

/** Own-key lookup, so an id such as "constructor" is never mistaken for a player. */
const playerOf = (state: RoomState, id: string): Player | undefined =>
  Object.hasOwn(state.players, id) ? state.players[id] : undefined;

/**
 * The vote window in ms. A seconds value that is not a finite number above 0 counts as absent. The
 * result is never below 1, so a window always has a deadline after its opening.
 */
function windowMsFor(seconds: number | undefined, content: CaseContent): number {
  const s = typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0 ? seconds : content.settings.voteSeconds;
  return Math.max(1, Math.round(s * 1000));
}

const nothing = (state: RoomState): Result => ({ state: { ...state }, effects: [] });

/** The most phones one room takes. A known phone can always rejoin; only a new one is turned away. */
export const MAX_PLAYERS = 200;

const refuse = (state: RoomState, msg: string, clientId?: string): Result =>
  ({ state: { ...state }, effects: [clientId === undefined ? { type: 'error', msg } : { type: 'error', clientId, msg }] });

const badPhase = (state: RoomState): Result => refuse(state, 'bad phase');

/**
 * The updatedAt of a change: the time of the event, or a millisecond past the last change when that is later, because
 * two changes can share a clock reading. Every change moves it forward and nothing else does, and the Durable Object
 * relies on that: it stores and broadcasts a state only when its updatedAt has moved.
 */
const stamp = (state: RoomState, now: number): number => Math.max(now, state.updatedAt + 1);

/** A changed state: the patch applied to a copy, stamped (see stamp) with the time of the event that caused it. */
const update = (state: RoomState, now: number, patch: Partial<RoomState>, effects: Effect[] = []): Result =>
  ({ state: { ...state, ...patch, updatedAt: stamp(state, now) }, effects });

export function initialState(code: string, hostKey: string, now: number, content: CaseContent): RoomState {
  return {
    code, hostKey, createdAt: now, updatedAt: now,
    phase: 'lobby', round: -1, voteOpenedAt: null, voteDeadline: null, voteWindowMs: windowMsFor(undefined, content),
    players: {}, banned: [], synthetic: {}, callouts: {}, majorities: [], hideNames: false, trips: 0,
  };
}

/**
 * A stored room made safe to load. A room saved by an earlier build can lack a field added since (`trips`), hold a
 * value this build never writes (an infinite vote deadline, from before openVote's seconds were capped), or carry what
 * the scoring build kept: a leaderboard phase, boss HP, a damage log, exhibits, player scores, option D, points on
 * call-outs. Any of these could wedge it or reach a screen: setAlarm refuses a time that is not finite, so every alarm
 * throws and is retried, `trips + 1` of nothing is NaN, and every field here goes out in the host view. This is
 * hardening, not a migration: the room is rebuilt from the fields this build knows, a field of the right shape keeps
 * its value and any other takes the value a new room starts with. The leaderboard came after the ending, so it loads
 * as the ending; a vote, a call-out or a majority for a letter that no longer exists is dropped or becomes none; a
 * player with no valid team joins the first. Earlier builds revealed every round in order, so the majorities of such
 * a room already hold one entry per revealed round, as goto expects.
 */
export function sanitizeState(stored: RoomState, content: CaseContent): RoomState {
  const s: Partial<Record<keyof RoomState, unknown>> & { phase?: unknown } = stored;
  const fresh = initialState(stored.code, stored.hostKey, stored.createdAt, content);
  const time = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
  const record = <T>(v: unknown, fallback: T): T => (isRecord(v) ? (v as T) : fallback);
  const list = <T>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
  /** The entries of a stored record that `keep` can make good, each under its own key. */
  const entries = <T>(v: unknown, keep: (x: unknown, key: string) => T | null): Record<string, T> =>
    Object.fromEntries(Object.entries(record<Record<string, unknown>>(v, {})).flatMap(([k, x]) => {
      const kept = keep(x, k);
      return kept === null ? [] : [[k, kept]];
    }));
  const tally = (t: unknown): Tally | null => (isRecord(t) ? { A: wholeVotes(t.A), B: wholeVotes(t.B), C: wholeVotes(t.C) } : null);
  const vote = (v: unknown): Vote | null => (isRecord(v) && isOption(v.option) ? { option: v.option, at: time(v.at) ?? 0 } : null);
  const player = (p: unknown, id: string): Player | null => (isRecord(p) ? {
    id,
    name: typeof p.name === 'string' ? p.name : generateName(id),
    role: isRole(p.role) ? p.role : ROLES[0],
    table: sanitizeTeam(p.table) ?? TEAMS[0],
    joinedAt: time(p.joinedAt) ?? 0,
    votes: entries(p.votes, vote),
  } : null);
  const callout = (co: unknown): Callout | null => {
    if (!isRecord(co)) return null;
    const status = co.status === 'pending' || co.status === 'awarded' ? co.status : 'declined';
    return { playerId: typeof co.playerId === 'string' ? co.playerId : null, option: isOption(co.option) ? co.option : null, status };
  };
  const phase: Phase = s.phase === 'leaderboard' ? 'ending' : PHASES.includes(s.phase as Phase) ? (s.phase as Phase) : 'lobby';
  const round = Number.isInteger(s.round) ? Math.min(content.rounds.length - 1, Math.max(-1, s.round as number)) : -1;
  const windowMs = time(s.voteWindowMs);
  return {
    code: stored.code, hostKey: stored.hostKey, createdAt: stored.createdAt, updatedAt: stored.updatedAt,
    phase, round,
    voteOpenedAt: time(s.voteOpenedAt),
    voteDeadline: time(s.voteDeadline),
    voteWindowMs: windowMs !== null && windowMs > 0 ? windowMs : fresh.voteWindowMs,
    players: entries(s.players, player),
    banned: list(s.banned, fresh.banned),
    synthetic: entries(s.synthetic, tally),
    callouts: entries(s.callouts, (v) => (Array.isArray(v) ? v.flatMap((co) => callout(co) ?? []) : null)),
    majorities: list<unknown>(s.majorities, fresh.majorities).map((m) => (isOption(m) ? m : null)),
    hideNames: typeof s.hideNames === 'boolean' ? s.hideNames : fresh.hideNames,
    trips: time(s.trips) ?? fresh.trips,
  };
}

// ---- Tallies ---------------------------------------------------------------------------------------

/** Every vote of the round: the players' and the synthetic ones (hand counts, bots). */
export function tallyFor(state: RoomState, round: number): Tally {
  const tally = zeroTally();
  for (const p of Object.values(state.players)) {
    const vote = p.votes[round];
    if (vote) tally[vote.option] += 1;
  }
  const synthetic = state.synthetic[round];
  if (synthetic) for (const o of OPTION_IDS) tally[o] += synthetic[o];
  return tally;
}

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

/**
 * A new phone joins. A known one rejoins: once the game has started that keeps everything the player had, because
 * roles are fixed once the game starts (spec 4.1); in the lobby it takes the name, role and team again, so a mis-tapped
 * role can be put right. Even the same details count as a change then, so the phone always hears back. The team must
 * be one of the eight the dropdown offers.
 */
function join(state: RoomState, ev: JoinEvent): Result {
  const id = ev.clientId;
  if (state.banned.includes(id)) {
    // The error goes first: the Durable Object closes the socket when it handles `kicked`.
    return { state: { ...state }, effects: [{ type: 'error', clientId: id, msg: 'removed' }, { type: 'kicked', clientId: id }] };
  }
  const known = playerOf(state, id);
  if (known && state.phase !== 'lobby') return nothing(state);
  if (!known && Object.keys(state.players).length >= MAX_PLAYERS) return refuse(state, 'room full', id);
  if (!isRole(ev.role)) return refuse(state, 'bad role', id);
  const table = sanitizeTeam(ev.table);
  if (table === null) return refuse(state, 'bad team', id);
  const details = { name: sanitizeName(ev.name, id), role: ev.role, table };
  // A change keeps when the player joined and what they have, which in the lobby is nothing yet.
  const player: Player = known ? { ...known, ...details } : { id, ...details, joinedAt: ev.now, votes: {} };
  return update(state, ev.now, { players: { ...state.players, [id]: player } });
}

/**
 * A player's vote for the open round, one each. The last player's vote locks the round in the same event, as closeVote
 * does (spec 2.2). Synthetic votes are not players and never lock it, and a player still without a vote (one who joined
 * during the vote, or whose phone went dark) holds it open until they vote, unless the clock or a closeVote locks it first.
 */
function castVote(state: RoomState, ev: VoteEvent): Result {
  const id = ev.clientId;
  if (state.phase !== 'vote') return refuse(state, 'not accepting votes', id);
  if (ev.round !== state.round) return refuse(state, 'wrong round', id);
  const player = playerOf(state, id);
  if (!player) return refuse(state, 'unknown player', id);
  if (player.votes[ev.round]) return refuse(state, 'already voted', id);
  if (!isOption(ev.option)) return nothing(state);   // no phone button sends this, so it gets no error string
  const voted: Player = { ...player, votes: { ...player.votes, [ev.round]: { option: ev.option, at: ev.now } } };
  const players = { ...state.players, [id]: voted };
  const everyone = Object.values(players);
  // The early lock is lock() itself, closeVote's transition, on the state with this vote in.
  if (everyone.length > 0 && everyone.every((p) => p.votes[ev.round])) return lock({ ...state, players }, ev.now);
  return update(state, ev.now, { players });
}

const lock = (state: RoomState, now: number): Result => update(state, now, { phase: 'locked' }, [{ type: 'clearAlarm' }]);

/**
 * A tick at or after the deadline of an open vote locks it, and so does any tick of an open vote whose deadline is not
 * a finite time (a room saved by an earlier build, see sanitizeState), because no alarm can be set for one. An early
 * tick (an alarm that fired ahead of the deadline, or a stale one from before a reopen) changes nothing but arms the
 * alarm again for the real deadline, so an open vote is never left with nothing scheduled to close it. In any other
 * phase a tick does nothing, even in locked where the old deadline is still stored.
 */
function tick(state: RoomState, now: number): Result {
  if (state.phase !== 'vote') return nothing(state);
  const deadline = state.voteDeadline;
  if (deadline === null || !Number.isFinite(deadline) || now >= deadline) return lock(state, now);
  return { state: { ...state }, effects: [{ type: 'setAlarm', at: deadline }] };
}

function runCmd(state: RoomState, cmd: HostCmd, now: number, content: CaseContent): Result {
  switch (cmd.k) {
    case 'start': return start(state, now);
    case 'openVote': return openVote(state, now, cmd.seconds, content);
    case 'closeVote': return state.phase === 'vote' ? lock(state, now) : badPhase(state);
    case 'reveal': return reveal(state, now);
    case 'next': return next(state, now, content);
    case 'reopen': return reopen(state, now);
    case 'reset': return reset(state, now, content);
    case 'kick': return kick(state, now, cmd.playerId);
    case 'injectVotes': return injectVotes(state, now, cmd.counts);
    case 'hideNames': return update(state, now, { hideNames: Boolean(cmd.hide) });
    case 'callout': return callOut(state, now, cmd, content);
    case 'judge': return judge(state, now, cmd.awarded);
    case 'goto': return goto(state, now, cmd.stage, content);
    default: return nothing(state);
  }
}

function start(state: RoomState, now: number): Result {
  if (state.phase !== 'lobby') return badPhase(state);
  return update(state, now, { phase: 'travel', round: 0, trips: state.trips + 1 });
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
 * Settles a locked round: a call-out still pending was never judged, so it counts as declined, and the round's
 * majority is recorded (none for a round nobody voted in). Final, because reopen refuses a revealed round.
 */
function reveal(state: RoomState, now: number): Result {
  if (state.phase !== 'locked') return badPhase(state);
  const { round } = state;
  const callouts = (state.callouts[round] ?? []).map((co): Callout => (co.status === 'pending' ? { ...co, status: 'declined' } : co));
  return update(state, now, {
    phase: 'reveal',
    callouts: { ...state.callouts, [round]: callouts },
    majorities: [...state.majorities.slice(0, round), majorityOf(tallyFor(state, round)).majority],
  });
}

/** From a reveal to the next boss, or to the ending after the last. The ending closes the game. */
function next(state: RoomState, now: number, content: CaseContent): Result {
  if (state.phase !== 'reveal') return badPhase(state);
  if (state.round >= content.rounds.length - 1) return update(state, now, { phase: 'ending' });
  return update(state, now, { phase: 'travel', round: state.round + 1, voteOpenedAt: null, voteDeadline: null, trips: state.trips + 1 });
}

/**
 * Back to the lobby from any phase: players, bans and the trip count stay, their votes go. Trips only ever go up, so
 * no boss's arrival after a reset shares its trip with one before it.
 */
function reset(state: RoomState, now: number, content: CaseContent): Result {
  const players = Object.fromEntries(Object.entries(state.players).map(([id, p]): [string, Player] => [id, { ...p, votes: {} }]));
  const fresh = initialState(state.code, state.hostKey, state.createdAt, content);
  return {
    state: { ...fresh, updatedAt: stamp(state, now), players, banned: state.banned, hideNames: state.hideNames, trips: state.trips },
    effects: state.phase === 'vote' ? [{ type: 'clearAlarm' }] : [],
  };
}

/** A copy of the list grown to n entries, each new entry made by fill from its index. A list of n or more is copied as it is. */
const pad = <T>(list: readonly T[], n: number, fill: (i: number) => T): T[] =>
  [...list, ...Array.from({ length: Math.max(0, n - list.length) }, (_, i) => fill(list.length + i))];

/**
 * Jumps the room to a stage (spec 4.1): 0 to 4 is the arrival of that round's boss and 5, the number of rounds, is the
 * ending on the last round. A round is settled once it is revealed or jumped over, so the settled rounds are the first
 * majorities.length. A jump to a round keeps the settled rounds before it whole and clears every round from there on:
 * their votes, synthetic votes and call-outs go. Rounds jumped over without being settled get no majority, so the next
 * reveal lands at its own index. A jump to the ending clears only an unsettled current round and leaves every settled
 * one as it was.
 */
function goto(state: RoomState, now: number, stage: number, content: CaseContent): Result {
  const rounds = content.rounds.length;
  if (!(Number.isInteger(stage) && stage >= 0 && stage <= rounds)) return refuse(state, 'bad stage');
  const effects: Effect[] = state.phase === 'vote' ? [{ type: 'clearAlarm' }] : [];
  // majorities hold one entry per revealed or padded round, so only the current round can lie past the settled ones,
  // and only in travel, vote or locked.
  const settled = state.majorities.length;
  const cut = stage === rounds ? settled : Math.min(stage, settled);
  const keep = <T>(entries: Record<number, T>): Record<number, T> =>
    Object.fromEntries(Object.entries(entries).filter(([r]) => Number(r) < cut));
  const players = Object.fromEntries(Object.entries(state.players).map(([id, p]): [string, Player] => [id, { ...p, votes: keep(p.votes) }]));
  const kept = { players, synthetic: keep(state.synthetic), callouts: keep(state.callouts) };
  if (stage === rounds) {
    return update(state, now, { phase: 'ending', round: rounds - 1, voteOpenedAt: null, voteDeadline: null, ...kept }, effects);
  }
  return update(state, now, {
    phase: 'travel', round: stage, voteOpenedAt: null, voteDeadline: null, trips: state.trips + 1, ...kept,
    majorities: pad(state.majorities.slice(0, cut), stage, () => null),
  }, effects);
}

/** Removes the player with their votes and bans the client id, so a later join from it is refused. */
function kick(state: RoomState, now: number, playerId: string): Result {
  if (!playerOf(state, playerId)) return refuse(state, 'unknown player');
  const players = Object.fromEntries(Object.entries(state.players).filter(([id]) => id !== playerId));
  const banned = state.banned.includes(playerId) ? state.banned : [...state.banned, playerId];
  return update(state, now, { players, banned }, [{ type: 'kicked', clientId: playerId }]);
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
 * Who a call-out lands on (spec 2.6). The eligible voters are this round's voters not yet called, by join time then id.
 * An explicitly named one wins; otherwise the pick draws from those whose option no call-out of the round has covered
 * yet (a hand call-out covers none), or from all of them once every voted option has been heard. With nobody eligible
 * it is undefined, which callOut records as a hand call-out.
 */
function chooseVoter(state: RoomState, called: readonly Callout[], cmd: CalloutCmd): Player | undefined {
  const done = new Set(called.map((co) => co.playerId));
  const heard = new Set(called.flatMap((co) => (co.option === null ? [] : [co.option])));
  const eligible = Object.values(state.players)
    .filter((p) => p.votes[state.round] && !done.has(p.id))
    .sort(byJoinThenId);
  const named = eligible.find((p) => p.id === cmd.playerId);
  if (named) return named;
  const fresh = eligible.filter((p) => !heard.has(p.votes[state.round].option));
  const pool = fresh.length > 0 ? fresh : eligible;
  if (pool.length === 0) return undefined;
  const pick = typeof cmd.pick === 'number' && Number.isFinite(cmd.pick) ? cmd.pick : 0;
  return pool[Math.min(pool.length - 1, Math.max(0, Math.floor(pick * pool.length)))];
}

/**
 * A call-out in a locked round (spec 2.6): one at a time and at most maxCallouts a round, both checked before anyone
 * is drawn. With nobody to call, the call-out has no player so the facilitator can cold-call by hand.
 */
function callOut(state: RoomState, now: number, cmd: CalloutCmd, content: CaseContent): Result {
  if (state.phase !== 'locked') return badPhase(state);
  const { round } = state;
  const made = state.callouts[round] ?? [];
  if (made.some((co) => co.status === 'pending')) return refuse(state, 'call-out pending');
  if (made.length >= content.settings.maxCallouts) return refuse(state, 'call-out limit');
  const voter = chooseVoter(state, made, cmd);
  const entry: Callout = { playerId: voter?.id ?? null, option: voter?.votes[round].option ?? null, status: 'pending' };
  return update(state, now, { callouts: { ...state.callouts, [round]: [...made, entry] } });
}

/** Y or N on the pending call-out: Y flashes "Valid point" on the projector, N clears the banner. Neither awards anything. */
function judge(state: RoomState, now: number, awarded: boolean): Result {
  const made = state.callouts[state.round] ?? [];
  const at = made.findIndex((co) => co.status === 'pending');
  if (at < 0) return refuse(state, 'no pending call-out');
  const settled: Callout = { ...made[at], status: awarded ? 'awarded' : 'declined' };
  return update(state, now, { callouts: { ...state.callouts, [state.round]: made.map((co, i) => (i === at ? settled : co)) } });
}

// ---- Views -----------------------------------------------------------------------------------------

// Both views take the content like the reducer does, so the Durable Object and the offline client call them alike,
// though neither reads it now that no round has a lead role.

/** Everything the projector needs: the state without the host key, and the tally of the current round. */
export function hostView(state: RoomState, now: number, _content: CaseContent): HostView {
  const { hostKey: _hostKey, ...rest } = state;
  return { ...rest, serverNow: now, tally: tallyFor(state, state.round) };
}

/**
 * What one phone gets. Null for a client the room does not know (never joined, or kicked). No tally: the split is
 * the projector's to show, and the phone only says what this student picked.
 */
export function playerView(state: RoomState, clientId: string, now: number, _content: CaseContent): PlayerView | null {
  const me = playerOf(state, clientId);
  if (!me) return null;
  const { round } = state;
  const pending = (state.callouts[round] ?? []).find((co) => co.status === 'pending');
  const calledId = pending?.playerId ?? null;
  const calledName = calledId === null ? null : (playerOf(state, calledId)?.name ?? null);
  return {
    phase: state.phase, round, serverNow: now, voteDeadline: state.voteDeadline, voteWindowMs: state.voteWindowMs,
    name: me.name, role: me.role, table: me.table, myVote: me.votes[round]?.option ?? null,
    playerCount: Object.keys(state.players).length,
    picks: Array.from({ length: Math.max(0, round + 1) }, (_, i) => me.votes[i]?.option ?? null),
    callout: pending ? { name: calledName, option: pending.option, isMe: pending.playerId === clientId } : null,
  };
}
