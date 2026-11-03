// tests/room-logic.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { initialState, reduce, tallyFor, leadTallyFor, supportTallyFor, hostView, playerView } from '../shared/room-logic';
import type { RoomState, RoomEvent, HostCmd } from '../shared/types';
const c = loadContent(raw);
const KEY = 'host-secret';
const t0 = 1_000_000;
const mk = () => initialState('ABCD', KEY, t0, c);
const cmd = (s: RoomState, k: HostCmd, now = t0, key = KEY) => reduce(s, { type: 'cmd', key, cmd: k, now }, c);
const run = (s: RoomState, evs: RoomEvent[]) => evs.reduce((acc, ev) => reduce(acc.state, ev, c), { state: s, effects: [] as any[] });
const join = (id: string, name: string | undefined, role = 'government', now = t0, table?: string): RoomEvent => ({ type: 'join', clientId: id, name, role, table, now });
const vote = (id: string, round: number, option: any, now = t0 + 6000): RoomEvent => ({ type: 'vote', clientId: id, round, option, now });
// p1 Ann is a citizen (Rogue), so p1 leads round 0; p2 and p3 are support in round 0
const toVote = () => run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'government'), join('p3', 'Cy', 'microsoft'), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, { type: 'cmd', key: KEY, cmd: { k: 'openVote' }, now: t0 }]).state;

describe('lobby and joins', () => {
  it('starts in lobby with full boss hp and round -1', () => {
    const s = mk();
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400); expect(s.voteWindowMs).toBe(120000);
  });
  it('joins keep identity on rejoin once the game has started, generate names, clean tables', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'business', t0, '  Table 3 '), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, join('p1', 'Other', 'microsoft')]).state;
    expect(Object.keys(s.players)).toHaveLength(2);
    expect(s.players.p1).toMatchObject({ name: 'Ann', role: 'citizen', table: null });
    expect(s.players.p2.name.split(' ')).toHaveLength(2);
    expect(s.players.p2.table).toBe('Table 3');
  });
  // Spec 4.1 fixes roles for the session, which the ruling reads as from the start of the game: in the lobby a phone
  // that tapped the wrong role joins again with the right one.
  it('lets a known player change name, role and table in the lobby, and keeps when they joined and what they have', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen', t0, 'Table 1'), join('p2', 'Bo', 'government', t0 + 1000)]).state;
    // Nothing is earned in the lobby (a reset clears it), but a change must not touch it either way.
    const s: RoomState = { ...lobby, players: { ...lobby.players, p1: { ...lobby.players.p1, score: 40, lastPoints: 5, votes: { 0: { option: 'B', at: t0 } } } } };
    const r = reduce(s, join('p1', '  Annie ', 'business', t0 + 5000, ' Table 2 '), c);
    expect(r.state.players.p1).toEqual({ ...s.players.p1, name: 'Annie', role: 'business', table: 'Table 2' });
    expect(r.state.players.p1).toMatchObject({ joinedAt: t0, score: 40, lastPoints: 5, votes: { 0: { option: 'B', at: t0 } } });
    expect(r.state.players.p2).toBe(s.players.p2);
    expect(r.state.updatedAt).not.toBe(s.updatedAt);   // a change: the room stores it and tells every screen
    expect(r.effects).toEqual([]);
    expect(playerView(r.state, 'p1', t0 + 5000, c)).toMatchObject({ name: 'Annie', role: 'business', table: 'Table 2' });
    // Cleaned as on a first join: no name gets the generated one, a blank table none.
    const fresh = reduce(mk(), join('p1', '', 'government'), c).state.players.p1;
    expect(reduce(r.state, join('p1', '', 'government', t0 + 6000, '  '), c).state.players.p1).toMatchObject({ name: fresh.name, role: 'government', table: null });
    // The same details again still count as a change, so the phone that sent them always hears back.
    expect(reduce(r.state, join('p1', 'Annie', 'business', t0 + 7000, 'Table 2'), c).state.updatedAt).not.toBe(r.state.updatedAt);
  });
  it('refuses a change to a bad role and keeps the old details', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen', t0, 'Table 1')]).state;
    const r = reduce(s, join('p1', 'Annie', 'dragon', t0 + 5000), c);
    expect(r.state).toEqual(s);
    expect(r.effects).toEqual([{ type: 'error', clientId: 'p1', msg: 'bad role' }]);
  });
  it('ignores a change of details once the game has started, during the vote and in every later phase', () => {
    const vote = toVote();
    const r = reduce(vote, join('p1', 'Annie', 'business', t0 + 5000, 'Table 9'), c);
    expect(r.state).toEqual(vote);
    expect(r.state.players.p1).toMatchObject({ name: 'Ann', role: 'citizen', table: null });
    expect(r.effects).toEqual([]);
    const { reveal, ending, leaderboard } = finished();
    for (const s of [cmd(run(mk(), [join('p1', 'Ann', 'citizen')]).state, { k: 'start' }).state, cmd(vote, { k: 'closeVote' }).state, reveal, ending, leaderboard]) {
      expect(reduce(s, join('p1', 'Annie', 'business', t0 + 5000, 'Table 9'), c).state).toEqual(s);
    }
  });
  it('rejects a bad role and does not create the player', () => {
    const r = reduce(mk(), join('p4', 'Dee', 'dragon'), c);
    expect(r.state.players.p4).toBeUndefined();
    expect(r.effects).toContainEqual({ type: 'error', clientId: 'p4', msg: 'bad role' });
  });
  it('rejects host commands with a bad key', () => {
    const r = cmd(mk(), { k: 'start' }, t0, 'wrong');
    expect(r.state.phase).toBe('lobby');
    expect(r.effects).toContainEqual({ type: 'error', msg: 'bad host key' });
  });
});

describe('vote window', () => {
  it('openVote sets a deadline and an alarm', () => {
    const r = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' });
    expect(r.state.phase).toBe('vote'); expect(r.state.round).toBe(0);
    expect(r.state.voteDeadline).toBe(t0 + 120000);
    expect(r.effects).toContainEqual({ type: 'setAlarm', at: t0 + 120000 });
  });
  it('counts one vote per player, first vote locks, rejoin cannot revote', () => {
    const s = run(toVote(), [vote('p1', 0, 'B'), vote('p1', 0, 'A'), join('p1', 'Ann', 'citizen'), vote('p1', 0, 'C'), vote('p2', 0, 'B')]).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0, D: 0 });
  });
  it('splits the tally into the lead class and the rest, synthetic votes count as support', () => {
    const s = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { D: 3 } }).state;
    expect(leadTallyFor(s, 0, c)).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(supportTallyFor(s, 0, c)).toEqual({ A: 1, B: 0, C: 0, D: 3 });
    expect(tallyFor(s, 0)).toEqual({ A: 1, B: 1, C: 0, D: 3 });
  });
  it('rejects votes for the wrong round, unknown players, and outside the vote phase', () => {
    const s = toVote();
    expect(reduce(s, vote('p1', 1, 'B'), c).effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'wrong round' });
    expect(reduce(s, vote('ghost', 0, 'B'), c).effects).toContainEqual({ type: 'error', clientId: 'ghost', msg: 'unknown player' });
    const locked = cmd(s, { k: 'closeVote' }).state;
    expect(tallyFor(reduce(locked, vote('p1', 0, 'B'), c).state, 0).B).toBe(0);
  });
  it('tick at the deadline locks the vote and later votes are rejected', () => {
    const s = toVote();
    const ticked = reduce(s, { type: 'tick', now: t0 + 120000 }, c);
    expect(ticked.state.phase).toBe('locked');
    expect(ticked.effects).toContainEqual({ type: 'clearAlarm' });
    expect(tallyFor(reduce(ticked.state, vote('p2', 0, 'B', t0 + 120500), c).state, 0).B).toBe(0);
    expect(reduce(s, { type: 'tick', now: t0 + 1000 }, c).state.phase).toBe('vote');
  });
  it('injectVotes only while accepting votes, and synthetic voters never appear as players', () => {
    const s = cmd(toVote(), { k: 'injectVotes', counts: { B: 10, D: 2 } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 10, C: 0, D: 2 });
    expect(Object.keys(s.players)).toHaveLength(3);
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' });
    expect(cmd(r.state, { k: 'injectVotes', counts: { A: 5 } }).effects).toContainEqual({ type: 'error', msg: 'not accepting votes' });
  });
  it('reopen returns a locked round to vote with a fresh deadline, extends an open one, and is refused elsewhere', () => {
    const locked = cmd(toVote(), { k: 'closeVote' }).state;
    const r = cmd(locked, { k: 'reopen' }, t0 + 40000);
    expect(r.state.phase).toBe('vote'); expect(r.state.voteDeadline).toBe(t0 + 160000); expect(r.state.voteOpenedAt).toBe(t0);
    const e = cmd(toVote(), { k: 'reopen' }, t0 + 10000);
    expect(e.state.voteDeadline).toBe(t0 + 130000); expect(e.effects).toContainEqual({ type: 'setAlarm', at: t0 + 130000 });
    expect(cmd(mk(), { k: 'reopen' }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
  });
});

describe('two-minute votes that lock when everyone has voted', () => {
  it('the window is two minutes', () => {
    expect(mk().voteWindowMs).toBe(120_000);
    const open = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' });
    expect(open.state.voteDeadline).toBe(t0 + 120_000);
    expect(open.effects).toContainEqual({ type: 'setAlarm', at: t0 + 120_000 });
  });
  it('locks the vote as soon as every player has voted, clears the alarm, and keeps the last vote', () => {
    const two = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]);
    expect(two.state.phase).toBe('vote');
    const all = reduce(two.state, vote('p3', 0, 'C', t0 + 7000), c);
    expect(all.state.phase).toBe('locked');
    expect(all.effects).toContainEqual({ type: 'clearAlarm' });
    expect(all.state.players.p3.votes[0]).toMatchObject({ option: 'C', at: t0 + 7000 });
    expect(tallyFor(all.state, 0)).toEqual({ A: 1, B: 1, C: 1, D: 0 });
    expect(reduce(all.state, vote('p3', 0, 'D'), c).effects).toContainEqual({ type: 'error', clientId: 'p3', msg: 'not accepting votes' });
  });
  it('synthetic votes never lock it, a joiner during the vote holds it open, and an empty room never locks on a key vote', () => {
    expect(cmd(toVote(), { k: 'injectVotes', counts: { A: 30 } }).state.phase).toBe('vote');
    const three = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p3', 0, 'C', t0 + 7000)]).state;
    expect(three.phase).toBe('vote');
    expect(reduce(three, vote('p4', 0, 'D', t0 + 8000), c).state.phase).toBe('locked');
    const empty = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state;
    expect(cmd(empty, { k: 'injectVotes', counts: { B: 5 } }).state.phase).toBe('vote');
  });
  it('a reopen after an early lock runs the full window again and the standing votes stand', () => {
    const all = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), vote('p3', 0, 'C')]).state;
    const again = cmd(all, { k: 'reopen' }, t0 + 9000);
    expect(again.state.phase).toBe('vote');
    expect(again.state.voteDeadline).toBe(t0 + 9000 + 120_000);
    expect(tallyFor(again.state, 0)).toEqual({ A: 1, B: 1, C: 1, D: 0 });
    expect(reduce(again.state, vote('p1', 0, 'D', t0 + 9500), c).effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'already voted' });
  });
});

describe('call-outs: one voice per option, four a round', () => {
  const locked = () => cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'closeVote' }).state;
  it('picks across every voter, with no preference for the lead class, and only once locked', () => {
    expect(cmd(toVote(), { k: 'callout', pick: 0.1 }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
    expect(cmd(locked(), { k: 'callout', pick: 0.1 }).state.callouts[0][0]).toMatchObject({ playerId: 'p1', option: 'B', status: 'pending' });
    expect(cmd(locked(), { k: 'callout', pick: 0.9 }).state.callouts[0][0]).toMatchObject({ playerId: 'p2', option: 'A', status: 'pending' });
  });
  it('each call-out goes to an option the round has not heard; then any uncalled voter; then a hand call-out; then the limit', () => {
    const open = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p4', 0, 'B', t0 + 7000)]).state;
    const s = cmd(open, { k: 'closeVote' }).state;   // p1 B, p2 A, p4 B; p3 did not vote
    const first = cmd(s, { k: 'callout', pick: 0.1 }).state;   // pool by join: p1, p2, p4; 0.1 is p1
    expect(first.callouts[0][0]).toMatchObject({ playerId: 'p1', option: 'B' });
    const second = cmd(cmd(first, { k: 'judge', awarded: true }).state, { k: 'callout', pick: 0.9 }).state;   // B is heard: p2 alone is preferred, whatever the pick
    expect(second.callouts[0][1]).toMatchObject({ playerId: 'p2', option: 'A' });
    const third = cmd(cmd(second, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // every voted option heard: any uncalled voter
    expect(third.callouts[0][2]).toMatchObject({ playerId: 'p4', option: 'B' });
    const fourth = cmd(cmd(third, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // nobody left: by hand
    expect(fourth.callouts[0][3]).toMatchObject({ playerId: null, option: null, status: 'pending' });
    const fifth = cmd(cmd(fourth, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 });
    expect(fifth.effects).toContainEqual({ type: 'error', msg: 'call-out limit' });
    expect(fifth.state.callouts[0]).toHaveLength(4);
  });
  it('allows an explicit pick and refuses a second pending call-out', () => {
    const s = cmd(locked(), { k: 'callout', playerId: 'p2' }).state;
    expect(s.callouts[0][0].playerId).toBe('p2');
    expect(cmd(s, { k: 'callout', pick: 0.2 }).effects).toContainEqual({ type: 'error', msg: 'call-out pending' });
    const t = cmd(s, { k: 'judge', awarded: false }).state;
    expect(cmd(t, { k: 'judge', awarded: true }).effects).toContainEqual({ type: 'error', msg: 'no pending call-out' });
  });
  it('falls back to a nameless hand call-out when nobody is eligible', () => {
    const s = cmd(cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state, { k: 'closeVote' }).state;
    expect(cmd(s, { k: 'callout', pick: 0.3 }).state.callouts[0][0]).toMatchObject({ playerId: null, option: null, status: 'pending' });
  });
  it('judging sets call-out points; reveal adds rally damage and the points, pending counts as declined', () => {
    const s = cmd(cmd(locked(), { k: 'callout', playerId: 'p1' }).state, { k: 'judge', awarded: true }).state;
    expect(s.callouts[0][0]).toMatchObject({ status: 'awarded', points: 30 });
    const t = cmd(s, { k: 'callout', playerId: 'p2' }).state;           // left pending on purpose
    const r = cmd(t, { k: 'reveal' }).state;
    // lead B only, support A only: blended A 0.5 B 0.5, base = 20 + 40 = 60, tie so no focus, majorities differ so no alignment, rally 10 -> 70
    expect(r.damageLog[0].rally).toBe(10); expect(r.damageLog[0].total).toBe(70);
    expect(r.callouts[0][1]).toMatchObject({ status: 'declined', points: 10 });
    expect(r.players.p1.lastPoints).toBe(80 + 19 + 10 + 30);   // score, speed, caster, call-out awarded
    expect(r.players.p2.lastPoints).toBe(40 + 19 + 10);        // score, speed, call-out spoke
  });
});

describe('reveal and scoring', () => {
  const revealed = () => {
    // p4 joins and never votes, so the vote stays open until the closeVote
    const s = run(toVote(), [join('p4', 'Dee', 'business'), vote('p1', 0, 'B', t0 + 6000), vote('p2', 0, 'B', t0 + 6000), vote('p3', 0, 'A', t0 + 15000)]).state;
    const withExhibit = { ...s, exhibits: { 0: ['t1a', 't1b'] } };
    return cmd(cmd(withExhibit, { k: 'closeVote' }).state, { k: 'reveal' }).state;
  };
  it('applies damage, records the majority, awards points with the caster bonus', () => {
    const s = revealed();
    const d = s.damageLog[0];
    // lead B 1; support A 1, B 1 (tied): blended A 0.25 B 0.75, base = 10 + 60 = 70, focus 15, alignment 0 (support tied), exhibit 10 -> 95
    expect(d.total).toBe(95); expect(d.alignment).toBe(0); expect(d.supportTied).toBe(true); expect(d.leadTied).toBe(false);
    expect(s.bossHp).toBe(305);
    expect(s.majorities[0]).toBe('B');
    expect(s.players.p1.lastPoints).toBe(80 + 19 + 10); expect(s.players.p1.score).toBe(109);
    expect(s.players.p2.lastPoints).toBe(80 + 19);
    expect(s.players.p3.lastPoints).toBe(40 + 18);
  });
  it('reveals an empty round without NaN and without damage', () => {
    const s = cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(s.damageLog[0].total).toBe(0); expect(s.bossHp).toBe(400);
    expect(s.players.p1.lastPoints).toBe(0);
  });
  it('next advances through travel to the next round, then ending, then leaderboard', () => {
    let s = cmd(revealed(), { k: 'next' }).state;
    expect(s.phase).toBe('travel'); expect(s.round).toBe(1);
    for (let r = 1; r <= 3; r++) s = cmd(cmd(cmd(cmd(s, { k: 'openVote' }).state, { k: 'closeVote' }).state, { k: 'reveal' }).state, { k: 'next' }).state;
    expect(s.phase).toBe('ending');
    expect(cmd(s, { k: 'next' }).state.phase).toBe('leaderboard');
  });
  it('exhibit collects at most three per round and only in travel', () => {
    let s = cmd(mk(), { k: 'start' }).state;
    for (const id of ['a', 'b', 'c', 'd']) s = cmd(s, { k: 'exhibit', exhibitId: id }).state;
    expect(s.exhibits[0]).toEqual(['a', 'b', 'c']);
    expect(cmd(cmd(s, { k: 'openVote' }).state, { k: 'exhibit', exhibitId: 'e' }).effects).toContainEqual({ type: 'error', msg: 'not in travel' });
  });
  it('kick removes a player, their votes, bans the client id and tells the phone', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const r = cmd(s, { k: 'kick', playerId: 'p1' });
    expect(r.state.players.p1).toBeUndefined(); expect(tallyFor(r.state, 0).B).toBe(0);
    expect(r.state.banned).toEqual(['p1']);
    expect(r.effects).toContainEqual({ type: 'kicked', clientId: 'p1' });
    const again = reduce(r.state, join('p1', 'Ann', 'citizen'), c);
    expect(again.state.players.p1).toBeUndefined();
    expect(again.effects).toContainEqual({ type: 'kicked', clientId: 'p1' });
    expect(again.effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'removed' });
  });
  it('reset returns to lobby keeping players and bans but clearing scores, damage and call-outs', () => {
    const banned = cmd(revealed(), { k: 'kick', playerId: 'p3' }).state;
    const s = cmd(banned, { k: 'reset' }).state;
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400);
    expect(Object.keys(s.players)).toHaveLength(3); expect(s.players.p1.score).toBe(0); expect(s.damageLog).toEqual([]); expect(s.callouts).toEqual({});
    expect(s.banned).toEqual(['p3']);
  });
});

describe('views', () => {
  it('host view hides the key and carries the lead role and both tallies', () => {
    const v = hostView(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, t0 + 1, c);
    expect((v as any).hostKey).toBeUndefined();
    expect(v.lead).toBe('citizen');
    expect(v.leadTally).toEqual({ A: 0, B: 1, C: 0, D: 0 }); expect(v.supportTally).toEqual({ A: 1, B: 0, C: 0, D: 0 }); expect(v.tally).toEqual({ A: 1, B: 1, C: 0, D: 0 });
    expect(v.serverNow).toBe(t0 + 1);
  });
  it('player view carries role, lead flag and picks, hides tallies until reveal, ranks players', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const v = playerView(s, 'p1', t0 + 1, c)!;
    expect(v).toMatchObject({ role: 'citizen', lead: 'citizen', isLead: true, myVote: 'B', playerCount: 3, rank: 1, callout: null, tally: null, leadTally: null });
    expect(v.picks).toEqual(['B']);
    expect(playerView(s, 'p2', t0, c)!.isLead).toBe(false);
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(playerView(r, 'p1', t0, c)!.tally).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(playerView(r, 'p2', t0, c)!.rank).toBe(2);
    expect(playerView(r, 'p2', t0, c)!.picks).toEqual([null]);
    expect(playerView(r, 'nobody', t0, c)).toBeNull();
    expect(playerView(mk(), 'p1', t0, c)).toBeNull();
  });
  it('player view carries the pending call-out and flags the called player', () => {
    const s = cmd(cmd(run(toVote(), [vote('p1', 0, 'B')]).state, { k: 'closeVote' }).state, { k: 'callout', playerId: 'p1' }).state;
    expect(playerView(s, 'p1', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: true });
    expect(playerView(s, 'p3', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: false });
    expect(hostView(s, t0, c).callouts[0][0].playerId).toBe('p1');
  });
});

// Behaviour the cases above leave open: purity, hardening against odd input, guard rails and view edges.
const K = (k: HostCmd, now = t0): RoomEvent => ({ type: 'cmd', key: KEY, cmd: k, now });
const zero = { A: 0, B: 0, C: 0, D: 0 };
const closeAndReveal = (s: RoomState) => cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
const nextRound = (s: RoomState) => cmd(cmd(s, { k: 'next' }).state, { k: 'openVote' }).state;
/** The last round revealed, then the ending and the leaderboard, reached through the real transitions. */
const finished = () => {
  let s = toVote();
  for (let r = 0; r < 3; r++) s = nextRound(closeAndReveal(s));
  const reveal = closeAndReveal(s);
  const ending = cmd(reveal, { k: 'next' }).state;
  return { reveal, ending, leaderboard: cmd(ending, { k: 'next' }).state };
};

describe('purity', () => {
  const deepFreeze = <T>(x: T): T => {
    if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
      Object.freeze(x);
      for (const v of Object.values(x)) deepFreeze(v);
    }
    return x;
  };
  // One scripted class night through every phase: a change of details in the lobby, a bad role, a rejoin after the
  // start, exhibits, injected votes, a tick that changes nothing and one that locks, a reopen with a late voter whose
  // vote, the last in the room, locks it again, two call-outs (one judged, one left pending), the ending, the
  // leaderboard, a kick, a banned rejoin, hideNames and a reset.
  const night = (): RoomEvent[] => {
    const evs: RoomEvent[] = [
      join('p1', 'Ann', 'citizen'), join('p2', undefined, 'government'), join('p3', 'Cy', 'microsoft'),
      join('p4', 'Di', 'business', t0, ' Table 3 '), join('p1', 'Other', 'microsoft'), join('p5', 'Eve', 'dragon'),
      K({ k: 'start' }), join('p1', 'Ann', 'citizen'), K({ k: 'exhibit', exhibitId: 'x1' }), K({ k: 'exhibit', exhibitId: 'x2' }),
    ];
    for (let r = 0; r < 4; r++) {
      const at = t0 + r * 200_000;
      evs.push(
        K({ k: 'openVote' }, at),
        vote('p1', r, 'B', at + 4000), vote('p2', r, 'A', at + 8000), vote('p3', r, 'B', at + 9000),
        vote('p1', r, 'C', at + 9500), vote('ghost', r, 'B', at + 9600),
        K({ k: 'injectVotes', counts: { D: 2 } }, at + 10000),
        { type: 'tick', now: at + 5000 }, { type: 'tick', now: at + 120000 },
        K({ k: 'reopen' }, at + 121000), vote('p4', r, 'D', at + 121500),
        K({ k: 'callout', pick: 0.4 }, at + 123000), K({ k: 'judge', awarded: true }, at + 124000),
        K({ k: 'callout', pick: 0.9 }, at + 125000), K({ k: 'reveal' }, at + 126000), K({ k: 'next' }, at + 127000),
      );
    }
    evs.push(K({ k: 'next' }, t0 + 900_000), K({ k: 'kick', playerId: 'p2' }), join('p2', 'Bee', 'government'), K({ k: 'hideNames', hide: true }), K({ k: 'reset' }));
    return evs;
  };
  const play = (frozen: boolean) => {
    const content = frozen ? deepFreeze(JSON.parse(JSON.stringify(c)) as typeof c) : c;
    let state = mk();
    const steps: { phase: string; effects: unknown }[] = [];
    for (const ev of night()) {
      const out = reduce(frozen ? deepFreeze(state) : state, frozen ? deepFreeze(ev) : ev, content);
      state = out.state;
      steps.push({ phase: state.phase, effects: out.effects });
    }
    return { state, steps };
  };
  it('hands back a new state object even when it refuses or has nothing to do', () => {
    const s = toVote();
    const outs = [reduce(s, vote('ghost', 0, 'B'), c), reduce(s, { type: 'tick', now: t0 + 1 }, c), cmd(s, { k: 'start' }), reduce(s, join('p1', 'Ann', 'citizen'), c)];
    for (const out of outs) {
      expect(out.state).not.toBe(s);
      expect(out.state).toEqual(s);
    }
  });
  it('never mutates the state, the event or the content', () => {
    const plain = play(false);
    const frozen = play(true);   // a write to a frozen object throws, so any in-place update fails the run
    expect(frozen).toEqual(plain);
    expect([...new Set(plain.steps.map((s) => s.phase))].sort()).toEqual(['ending', 'leaderboard', 'lobby', 'locked', 'reveal', 'travel', 'vote']);
  });
});

describe('vote window details', () => {
  const opened = (seconds?: number) => cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote', seconds }).state;
  it('openVote takes a custom window in seconds', () => {
    expect(opened(10)).toMatchObject({ voteWindowMs: 10000, voteOpenedAt: t0, voteDeadline: t0 + 10000 });
  });
  it('treats a seconds value that is not a finite number above 0 as absent', () => {
    for (const bad of [undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(opened(bad)).toMatchObject({ voteWindowMs: 120000, voteDeadline: t0 + 120000 });
    }
  });
  it('keeps the window above zero even for a sliver of a second', () => {
    expect(opened(0.0001).voteWindowMs).toBe(1);
  });
  it('pays the speed bonus against the window the host chose', () => {
    // p2 never votes, so the vote stays open until the closeVote
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', 'Bo', 'government'), K({ k: 'start' }), K({ k: 'openVote', seconds: 10 }), vote('p1', 0, 'B', t0 + 5000)]).state;
    expect(closeAndReveal(s).players.p1.lastPoints).toBe(80 + 10 + 10);   // score, half the speed bonus, caster
  });
  it('reopen reuses the window the host opened the vote with, from locked and from an open vote', () => {
    const open = run(mk(), [K({ k: 'start' }), K({ k: 'openVote', seconds: 10 })]).state;
    const reopened = cmd(cmd(open, { k: 'closeVote' }, t0 + 4000).state, { k: 'reopen' }, t0 + 5000);
    expect(reopened.state).toMatchObject({ phase: 'vote', voteWindowMs: 10000, voteOpenedAt: t0, voteDeadline: t0 + 15000 });
    expect(reopened.effects).toEqual([{ type: 'setAlarm', at: t0 + 15000 }]);
    expect(cmd(open, { k: 'reopen' }, t0 + 3000).state.voteDeadline).toBe(t0 + 13000);
  });
  it('an early tick leaves the vote open and arms the alarm again for the real deadline', () => {
    const s = toVote();
    const early = reduce(s, { type: 'tick', now: t0 + 120000 - 1 }, c);
    expect(early.state).toEqual(s);
    expect(early.effects).toEqual([{ type: 'setAlarm', at: t0 + 120000 }]);
    expect(reduce(s, { type: 'tick', now: t0 + 1000 }, c).effects).toEqual([{ type: 'setAlarm', at: t0 + 120000 }]);
  });
  it('a stale tick from before a reopen re-arms at the new deadline, and the real one locks', () => {
    const reopened = cmd(toVote(), { k: 'reopen' }, t0 + 10000).state;   // the deadline moves from t0 + 120000 to t0 + 130000
    const stale = reduce(reopened, { type: 'tick', now: t0 + 120000 }, c);
    expect(stale.state).toEqual(reopened);
    expect(stale.effects).toEqual([{ type: 'setAlarm', at: t0 + 130000 }]);
    const real = reduce(reopened, { type: 'tick', now: t0 + 130000 }, c);
    expect(real.state.phase).toBe('locked');
    expect(real.effects).toEqual([{ type: 'clearAlarm' }]);
  });
  it('a tick outside an open vote changes nothing and arms nothing, even in locked where the old deadline is still stored', () => {
    const lockedState = cmd(toVote(), { k: 'closeVote' }).state;
    expect(lockedState.voteDeadline).toBe(t0 + 120000);
    const { ending, leaderboard } = finished();
    for (const s of [mk(), cmd(mk(), { k: 'start' }).state, lockedState, closeAndReveal(toVote()), ending, leaderboard]) {
      for (const now of [t0, t0 + 119999, t0 + 120000, t0 + 399999]) {
        const out = reduce(s, { type: 'tick', now }, c);
        expect(out.effects).toEqual([]);
        expect(out.state).toEqual(s);
      }
    }
  });
});

describe('input hardening', () => {
  it('ignores a vote for an option outside A to D, and the player can still vote properly', () => {
    for (const bad of ['Z', 'a', '', 'constructor', undefined]) {
      const r = reduce(toVote(), vote('p1', 0, bad), c);
      expect(r.state.players.p1.votes).toEqual({});
      expect(r.effects).toEqual([]);
    }
    expect(tallyFor(run(toVote(), [vote('p1', 0, 'Z'), vote('p1', 0, 'C')]).state, 0)).toEqual({ A: 0, B: 0, C: 1, D: 0 });
  });
  it('looks players up by own key, so constructor is no phantom player and __proto__ is not lost', () => {
    const s = toVote();
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(reduce(s, vote(id, 0, 'B'), c).effects).toContainEqual({ type: 'error', clientId: id, msg: 'unknown player' });
      expect(playerView(s, id, t0, c)).toBeNull();
    }
    const odd = run(s, [join('__proto__', 'Pro', 'business'), vote('__proto__', 0, 'D')]).state;
    expect(Object.keys(odd.players)).toEqual(['p1', 'p2', 'p3', '__proto__']);
    expect(tallyFor(odd, 0)).toEqual({ A: 0, B: 0, C: 0, D: 1 });
    expect(playerView(odd, '__proto__', t0, c)).toMatchObject({ name: 'Pro', myVote: 'D', playerCount: 4 });
  });
  it('adds only whole, positive injected votes and accumulates across calls', () => {
    const s = cmd(toVote(), { k: 'injectVotes', counts: { A: -3, B: 2.9, C: Number.NaN, D: Number.POSITIVE_INFINITY } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0, D: 0 });
    const more = cmd(cmd(s, { k: 'injectVotes', counts: { B: 1 } }).state, { k: 'injectVotes', counts: { B: 2, C: 4 } }).state;
    expect(tallyFor(more, 0)).toEqual({ A: 0, B: 5, C: 4, D: 0 });
  });
  it('injects while the vote is locked too, but not before it opens or after the reveal', () => {
    const lockedS = cmd(toVote(), { k: 'closeVote' }).state;
    expect(tallyFor(cmd(lockedS, { k: 'injectVotes', counts: { C: 4 } }).state, 0).C).toBe(4);
    const notAccepting = [{ type: 'error', msg: 'not accepting votes' }];
    expect(cmd(cmd(mk(), { k: 'start' }).state, { k: 'injectVotes', counts: { C: 4 } }).effects).toEqual(notAccepting);
    expect(cmd(mk(), { k: 'injectVotes', counts: { C: 4 } }).effects).toEqual(notAccepting);
  });
  it('treats an unknown command as nothing to do', () => {
    const r = cmd(mk(), { k: 'explode' } as unknown as HostCmd);
    expect(r.state).toEqual(mk());
    expect(r.effects).toEqual([]);
  });
});

describe('guard rails and bookkeeping', () => {
  const bad = [{ type: 'error', msg: 'bad phase' }];
  const refused = (s: RoomState, k: HostCmd) => {
    const r = cmd(s, k);
    expect(r.state).toEqual(s);
    return r.effects;
  };
  it('refuses each command outside its phase with bad phase and changes nothing', () => {
    const travel = cmd(mk(), { k: 'start' }).state;
    expect(refused(mk(), { k: 'openVote' })).toEqual(bad);
    expect(refused(mk(), { k: 'closeVote' })).toEqual(bad);
    expect(refused(mk(), { k: 'reveal' })).toEqual(bad);
    expect(refused(mk(), { k: 'next' })).toEqual(bad);
    expect(refused(travel, { k: 'start' })).toEqual(bad);
    expect(refused(travel, { k: 'closeVote' })).toEqual(bad);
    expect(refused(toVote(), { k: 'start' })).toEqual(bad);
    expect(refused(toVote(), { k: 'openVote' })).toEqual(bad);
    expect(refused(toVote(), { k: 'reveal' })).toEqual(bad);
    expect(refused(toVote(), { k: 'next' })).toEqual(bad);
    expect(refused({ ...mk(), phase: 'leaderboard' }, { k: 'next' })).toEqual(bad);
  });
  it('a reveal is final: reopen is refused from reveal, ending and leaderboard', () => {
    const { reveal, ending, leaderboard } = finished();
    expect([reveal.phase, ending.phase, leaderboard.phase]).toEqual(['reveal', 'ending', 'leaderboard']);
    for (const s of [reveal, ending, leaderboard]) expect(refused(s, { k: 'reopen' })).toEqual(bad);
  });
  it('a second reveal is refused, so damage and points are never paid twice', () => {
    const once = closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state);
    expect(once.bossHp).toBe(305);
    expect(refused(once, { k: 'reveal' })).toEqual(bad);
  });
  it('next is refused while locked, so a reveal cannot be skipped', () => {
    expect(refused(cmd(toVote(), { k: 'closeVote' }).state, { k: 'next' })).toEqual(bad);
  });
  it('allows each phase-gated command in exactly its phases', () => {
    const { reveal, ending, leaderboard } = finished();
    const states: Record<string, RoomState> = {
      lobby: mk(), travel: cmd(mk(), { k: 'start' }).state, vote: toVote(), locked: cmd(toVote(), { k: 'closeVote' }).state, reveal, ending, leaderboard,
    };
    const allowedIn: Record<string, string[]> = {
      start: ['lobby'], openVote: ['travel'], closeVote: ['vote'], reveal: ['locked'],
      next: ['reveal', 'ending'], reopen: ['locked', 'vote'], callout: ['locked'],
      goto: ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending', 'leaderboard'],
    };
    const wrong: string[] = [];
    for (const [k, phases] of Object.entries(allowedIn)) {
      for (const [phase, s] of Object.entries(states)) {
        // stage 0 makes goto a valid jump, so only a phase gate could refuse it here
        const badPhase = cmd(s, { k, pick: 0, stage: 0 } as unknown as HostCmd).effects.some((e) => e.type === 'error' && e.msg === 'bad phase');
        if (badPhase === phases.includes(phase)) wrong.push(`${k} in ${phase}`);
      }
    }
    expect(wrong).toEqual([]);
  });
  it('hideNames sets and clears the flag in any phase, and reset leaves it alone', () => {
    const on = cmd(toVote(), { k: 'hideNames', hide: true }).state;
    expect(on.hideNames).toBe(true);
    expect(cmd(on, { k: 'reset' }).state.hideNames).toBe(true);
    expect(cmd(on, { k: 'hideNames', hide: false }).state.hideNames).toBe(false);
  });
  it('after a reset everyone starts clean and can vote in round one again', () => {
    const played = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { D: 3 } }).state;
    const s = cmd(played, { k: 'reset' }).state;
    expect(s.players.p1.votes).toEqual({});
    expect(s.synthetic).toEqual({});
    expect(s.exhibits).toEqual({});
    expect(s.majorities).toEqual([]);
    expect(s).toMatchObject({ voteOpenedAt: null, voteDeadline: null, voteWindowMs: 120000 });
    const again = run(s, [K({ k: 'start' }), K({ k: 'openVote' }), vote('p1', 0, 'C')]).state;
    expect(tallyFor(again, 0)).toEqual({ A: 0, B: 0, C: 1, D: 0 });
  });
  it('reset clears the alarm only when a vote was open', () => {
    expect(cmd(toVote(), { k: 'reset' }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(cmd(mk(), { k: 'start' }).state, { k: 'reset' }).effects).toEqual([]);
  });
  it('kicking someone the room does not know is an error that bans nobody, and a repeat kick bans once', () => {
    const r = cmd(toVote(), { k: 'kick', playerId: 'ghost' });
    expect(r.effects).toEqual([{ type: 'error', msg: 'unknown player' }]);
    expect(r.state.banned).toEqual([]);
    const once = cmd(toVote(), { k: 'kick', playerId: 'p1' }).state;
    expect(cmd(once, { k: 'kick', playerId: 'p1' }).state.banned).toEqual(['p1']);
  });
  it('a rejoin emits nothing, and a banned join gets the error before the kick so the phone still hears it', () => {
    expect(reduce(toVote(), join('p1', 'Ann', 'citizen'), c).effects).toEqual([]);
    const banned = cmd(toVote(), { k: 'kick', playerId: 'p1' }).state;
    const again = reduce(banned, join('p1', 'Ann', 'citizen'), c);
    expect(again.effects.map((e) => e.type)).toEqual(['error', 'kicked']);
    expect(again.state).toEqual(banned);
  });
  it('updatedAt follows accepted events only', () => {
    const voted = reduce(toVote(), vote('p1', 0, 'B', t0 + 6000), c).state;
    expect(voted.updatedAt).toBe(t0 + 6000);
    expect(reduce(voted, join('p1', 'Ann', 'citizen', t0 + 7000), c).state.updatedAt).toBe(t0 + 6000);   // rejoin
    expect(reduce(voted, vote('p1', 0, 'C', t0 + 8000), c).state.updatedAt).toBe(t0 + 6000);             // refused
    expect(reduce(voted, { type: 'tick', now: t0 + 9000 }, c).state.updatedAt).toBe(t0 + 6000);          // nothing due
    expect(reduce(voted, { type: 'tick', now: t0 + 120000 }, c).state.updatedAt).toBe(t0 + 120000);      // locks
  });
  // The converse of the test above, and the guard for the Durable Object, which stores and broadcasts a state only when
  // its updatedAt has moved: an accepted event that left it alone would never reach a screen. All at one clock reading,
  // because two changes inside one millisecond are ordinary when sixty phones vote at once.
  it('moves updatedAt forward on every accepted event of a whole game, even within one millisecond, and on no refusal', () => {
    const at = t0;
    const end = t0 + 120000;   // the reopened vote's deadline: the tick that locks it, and everything after it, come then
    const steps: [string, RoomEvent, boolean][] = [
      ['join', join('p1', 'Ann', 'citizen', at), true],
      ['second join', join('p2', 'Bo', 'government', at), true],
      ['third join', join('p3', 'Cy', 'business', at), true],
      ['change of role in the lobby', join('p3', 'Cy', 'microsoft', at), true],
      ['bad role', join('p4', 'Di', 'dragon', at), false],
      ['vote in the lobby', vote('p1', 0, 'B', at), false],
      ['bad host key', { type: 'cmd', key: 'wrong', cmd: { k: 'start' }, now: at }, false],
      ['start', K({ k: 'start' }, at), true],
      ['start again', K({ k: 'start' }, at), false],
      ['rejoin after the start', join('p1', 'Other', 'business', at), false],
      ['exhibit', K({ k: 'exhibit', exhibitId: 'x1' }, at), true],
      ['openVote', K({ k: 'openVote' }, at), true],
      ['early tick', { type: 'tick', now: at }, false],
      ['vote', vote('p1', 0, 'B', at), true],
      ['second vote', vote('p2', 0, 'A', at), true],
      ['vote again', vote('p1', 0, 'C', at), false],
      ['injectVotes', K({ k: 'injectVotes', counts: { D: 2 } }, at), true],
      ['hideNames', K({ k: 'hideNames', hide: true }, at), true],
      ['callout while open', K({ k: 'callout', pick: 0 }, at), false],
      ['closeVote', K({ k: 'closeVote' }, at), true],
      ['callout', K({ k: 'callout', pick: 0 }, at), true],
      ['judge', K({ k: 'judge', awarded: true }, at), true],
      ['judge again', K({ k: 'judge', awarded: true }, at), false],
      ['reopen', K({ k: 'reopen' }, at), true],
      ['tick that locks', { type: 'tick', now: end }, true],
      ['tick after the lock', { type: 'tick', now: end }, false],
      ['reveal', K({ k: 'reveal' }, end), true],
      ['reveal again', K({ k: 'reveal' }, end), false],
      ['next', K({ k: 'next' }, end), true],
      ['kick', K({ k: 'kick', playerId: 'p2' }, end), true],
      ['banned rejoin', join('p2', 'Bo', 'government', end), false],
      ['kick nobody', K({ k: 'kick', playerId: 'ghost' }, end), false],
      ['reset', K({ k: 'reset' }, end), true],
    ];
    const { reveal } = finished();
    const last = reveal.updatedAt;   // the closing screens, at the same reading as the change before them
    const closing: [string, RoomEvent, boolean][] = [
      ['next to the ending', K({ k: 'next' }, last), true],
      ['next to the leaderboard', K({ k: 'next' }, last), true],
      ['next on the leaderboard', K({ k: 'next' }, last), false],
    ];
    for (const [from, walk] of [[mk(), steps], [reveal, closing]] as const) {
      let s = from;
      for (const [what, ev, accepted] of walk) {
        const next = reduce(s, ev, c).state;
        if (accepted) {
          expect(next.updatedAt, what).toBeGreaterThan(s.updatedAt);
          expect({ ...next, updatedAt: 0 }, `${what} changes something`).not.toEqual({ ...s, updatedAt: 0 });
        } else {
          expect(next, what).toEqual(s);
        }
        s = next;
      }
    }
  });
  it('an init event rebuilds the room from scratch', () => {
    const r = reduce(toVote(), { type: 'init', code: 'WXYZ', hostKey: 'other-key', now: t0 + 5 }, c);
    expect(r.state).toEqual(initialState('WXYZ', 'other-key', t0 + 5, c));
    expect(r.effects).toEqual([]);
  });
});

describe('call-out details', () => {
  const locked = () => cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'closeVote' }).state;
  it('ignores an explicit player who did not vote and draws instead', () => {
    expect(cmd(locked(), { k: 'callout', playerId: 'p3', pick: 0.5 }).state.callouts[0][0].playerId).toBe('p2');   // p3 did not vote, so 0.5 draws from p1 and p2
  });
  it('ignores an explicit player who was already called', () => {
    const s = cmd(cmd(locked(), { k: 'callout', playerId: 'p2' }).state, { k: 'judge', awarded: false }).state;
    expect(cmd(s, { k: 'callout', playerId: 'p2', pick: 0.5 }).state.callouts[0][1].playerId).toBe('p1');
  });
  it('draws over voters sorted by join time then id, and a pick of 1 still lands on the last', () => {
    // inserted z, m, a; sorted by joinedAt then id they are z (t0), a (t0 + 1), m (t0 + 1). n joins last and never votes:
    // it keeps the vote open until the closeVote, and as it would sort last, a pick near 1 shows non-voters are never drawn
    const s = run(mk(), [
      join('z', 'Zed', 'government', t0), join('m', 'Max', 'business', t0 + 1), join('a', 'Amy', 'microsoft', t0 + 1),
      join('n', 'Nia', 'citizen', t0 + 2),
      K({ k: 'start' }), K({ k: 'openVote' }), vote('z', 0, 'A'), vote('m', 0, 'A'), vote('a', 0, 'A'), K({ k: 'closeVote' }),
    ]).state;
    const drawn = [0, 0.34, 0.67, 0.999, 1].map((pick) => cmd(s, { k: 'callout', pick }).state.callouts[0][0].playerId);
    expect(drawn).toEqual(['z', 'a', 'm', 'm', 'm']);
  });
  it('a hand call-out reaches phones as a nameless call-out and flags nobody; judging clears it', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), K({ k: 'start' }), K({ k: 'openVote' }), K({ k: 'closeVote' })]).state;   // p1 never voted
    const hand = cmd(s, { k: 'callout', pick: 0.2 }).state;
    expect(playerView(hand, 'p1', t0, c)!.callout).toEqual({ name: null, option: null, isMe: false });
    expect(playerView(cmd(hand, { k: 'judge', awarded: true }).state, 'p1', t0, c)!.callout).toBeNull();
  });
  it('a nameless call-out judged awarded still counts as a rally and pays nobody', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', 'Bo', 'government'), K({ k: 'start' }), K({ k: 'openVote' }), vote('p1', 0, 'B'), K({ k: 'closeVote' })]).state;
    // p1 is the only voter (p2 never votes, so the vote stays open until the closeVote): the first call-out takes them
    // (declined), the second has nobody left and is nameless
    const first = cmd(cmd(s, { k: 'callout', pick: 0 }).state, { k: 'judge', awarded: false }).state;
    const second = cmd(cmd(first, { k: 'callout', pick: 0 }).state, { k: 'judge', awarded: true }).state;
    expect(second.callouts[0][1]).toMatchObject({ playerId: null, status: 'awarded', points: 30 });
    const r = cmd(second, { k: 'reveal' }).state;
    expect(r.damageLog[0].rally).toBe(10);
    expect(r.players.p1.lastPoints).toBe(80 + 19 + 10 + 10);   // score, speed, caster, their own declined call-out; the 30 went to nobody
  });
  it('a pending call-out survives a reopen: phones keep seeing it, judge works in vote, and the next lock allows a second call-out', () => {
    const called = cmd(locked(), { k: 'callout', playerId: 'p1' }).state;
    const reopened = cmd(called, { k: 'reopen' }, t0 + 1000).state;
    expect(reopened.phase).toBe('vote');
    expect(playerView(reopened, 'p1', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: true });
    expect(playerView(reopened, 'p2', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: false });
    // locked again without judging: the first call-out is still pending
    const relocked = cmd(reopened, { k: 'closeVote' }, t0 + 2000).state;
    expect(cmd(relocked, { k: 'callout', pick: 0.5 }).effects).toEqual([{ type: 'error', msg: 'call-out pending' }]);
    // judged during the reopened vote instead: settled, paid, and a second call-out is allowed after the next lock
    const judged = cmd(reopened, { k: 'judge', awarded: true }, t0 + 2000).state;
    expect(judged.callouts[0][0]).toMatchObject({ playerId: 'p1', status: 'awarded', points: 30 });
    expect(playerView(judged, 'p1', t0, c)!.callout).toBeNull();
    const second = cmd(cmd(judged, { k: 'closeVote' }, t0 + 3000).state, { k: 'callout', playerId: 'p2' }).state;
    expect(second.callouts[0]).toHaveLength(2);
    expect(second.callouts[0][1]).toMatchObject({ playerId: 'p2', status: 'pending' });
  });
});

describe('reveal details', () => {
  it('strikes with the lead class alone when nobody else voted', () => {
    const s = closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state);
    // lead B only: base 80, focus 15, no alignment because the support side is empty
    expect(s.damageLog[0]).toMatchObject({ total: 95, alignment: 0, leadMajority: 'B', supportMajority: null });
    expect(s.bossHp).toBe(305);
  });
  it('strikes with the support alone when the lead class did not vote', () => {
    const s = closeAndReveal(run(toVote(), [vote('p2', 0, 'B')]).state);
    expect(s.damageLog[0]).toMatchObject({ total: 95, alignment: 0, leadMajority: null, supportMajority: 'B' });
    expect(s.bossHp).toBe(305);
  });
  it('records no majority for a round nobody voted in, so it cannot feed the round 4 synergy bonus', () => {
    const emptyRound = (s: RoomState) => nextRound(closeAndReveal(s));
    let s = emptyRound(toVote());
    s = emptyRound(s);
    s = emptyRound(s);
    expect(s.majorities).toEqual([null, null, null]);
    s = closeAndReveal(run(s, [vote('p1', 3, 'B')]).state);
    expect(s.damageLog[3].effective).toEqual({ A: 50, B: 50, C: 50, D: 50 });
    expect(s.majorities).toEqual([null, null, null, 'B']);
  });
  it('feeds the earlier majorities into the round 4 scores', () => {
    let s = closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state);
    s = closeAndReveal(run(nextRound(s), [vote('p1', 1, 'C')]).state);
    s = closeAndReveal(run(nextRound(s), [vote('p1', 2, 'B')]).state);
    s = closeAndReveal(run(nextRound(s), [vote('p1', 3, 'D')]).state);
    expect(s.majorities).toEqual(['B', 'C', 'B', 'D']);
    expect(s.damageLog[3].effective).toEqual({ A: 50, B: 95, C: 50, D: 95 });
  });
  it('strikes with synthetic votes alone, which count as support and give the round a majority', () => {
    const s = closeAndReveal(cmd(toVote(), { k: 'injectVotes', counts: { B: 8, D: 2 } }).state);
    // support only, B .8 and D .2: base 0.8 * 80 + 0.2 * 55 = 75, focus 15, no lead side so no alignment, total 90
    expect(s.damageLog[0]).toMatchObject({ total: 90, base: 75, focus: 15, alignment: 0, majority: 'B', leadMajority: null, supportMajority: 'B' });
    expect(s.bossHp).toBe(310);
    expect(s.majorities).toEqual(['B']);
    expect(Object.values(s.players).map((p) => p.lastPoints)).toEqual([0, 0, 0]);   // synthetic voters are not players, so nobody is paid
  });
  it('adds synthetic votes to the support side when real votes are mixed in', () => {
    const s = closeAndReveal(cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { D: 3 } }).state);
    // lead B 1; support A 1 and D 3: blended A .125, B .5, D .375, base 5 + 40 + 20.625 = 65.625, no focus below 60%, B against D so no alignment, total 66
    expect(s.damageLog[0]).toMatchObject({ total: 66, focus: 0, alignment: 0, majority: 'B', leadMajority: 'B', supportMajority: 'D' });
    expect(s.damageLog[0].base).toBeCloseTo(65.625, 10);
    expect(s.majorities).toEqual(['B']);
    expect(s.players.p1.lastPoints).toBe(80 + 19 + 10);   // score, speed, caster
    expect(s.players.p2.lastPoints).toBe(40 + 19);        // score, speed
  });
  it('never takes the boss below zero', () => {
    const s = closeAndReveal(run({ ...toVote(), bossHp: 20 }, [vote('p1', 0, 'B')]).state);
    expect(s.bossHp).toBe(0);
  });
});

describe('view details', () => {
  it('in the lobby the lead is the first round\'s, tallies are zero and the picks are empty', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', 'Bo', 'business')]).state;
    expect(hostView(s, t0, c)).toMatchObject({ phase: 'lobby', round: -1, lead: 'citizen', leadTally: zero, supportTally: zero, tally: zero });
    expect(playerView(s, 'p1', t0, c)).toMatchObject({ round: -1, lead: 'citizen', isLead: true, myVote: null, picks: [], tally: null, rank: 1, playerCount: 2 });
    expect(playerView(s, 'p2', t0, c)).toMatchObject({ isLead: false, rank: 1 });
  });
  it('shows all three tallies from reveal on, and hides them again in the next travel segment', () => {
    const r = closeAndReveal(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state);
    expect(playerView(r, 'p3', t0, c)).toMatchObject({ tally: { A: 1, B: 1, C: 0, D: 0 }, leadTally: { A: 0, B: 1, C: 0, D: 0 }, supportTally: { A: 1, B: 0, C: 0, D: 0 } });
    const v = playerView(cmd(r, { k: 'next' }).state, 'p1', t0, c)!;
    expect(v).toMatchObject({ phase: 'travel', round: 1, lead: 'government', isLead: false, myVote: null, tally: null, leadTally: null, supportTally: null });
    expect(v.picks).toEqual(['B', null]);
    expect(v.majorities).toEqual(['A']);   // lead B against support A blends to a tie, and a tie goes to the earlier letter
  });
  it('keeps all three tallies hidden while the vote is locked', () => {
    const s = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'closeVote' }).state;
    expect(playerView(s, 'p3', t0, c)).toMatchObject({ phase: 'locked', tally: null, leadTally: null, supportTally: null });
  });
  it('ranks tied scores together and puts a non-voter behind them', () => {
    const r = closeAndReveal(run(toVote(), [vote('p2', 0, 'B'), vote('p3', 0, 'B')]).state);
    expect([1, 2, 3].map((n) => playerView(r, `p${n}`, t0, c)!.rank)).toEqual([3, 1, 1]);
  });
  it('gives a kicked player no view', () => {
    expect(playerView(cmd(toVote(), { k: 'kick', playerId: 'p1' }).state, 'p1', t0, c)).toBeNull();
  });
});

describe('goto', () => {
  // Round 0 paid, with votes from p1 and p2. Round 1 under way, with an exhibit, votes from p1 and p3 and two synthetic
  // votes, so a jump has points, HP and entries of every kind to give back, and p2 and p3 each lack a round the other has.
  const roundOneVoted = () => run(closeAndReveal(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state), [
    K({ k: 'next' }), K({ k: 'exhibit', exhibitId: 'x1' }), K({ k: 'openVote' }),
    vote('p1', 1, 'C'), vote('p3', 1, 'B'), K({ k: 'injectVotes', counts: { D: 2 } }),
  ]).state;
  const twoRounds = () => closeAndReveal(roundOneVoted());   // round 1 revealed, round 0 before it

  it('restarts the round it goes to, keeps the rounds before it, and gives back the points and HP of the rest', () => {
    const s = twoRounds();
    const r = cmd(s, { k: 'goto', stage: 1 }, t0 + 90000);
    expect(r.state).toMatchObject({ phase: 'travel', round: 1, voteOpenedAt: null, voteDeadline: null, trips: s.trips + 1 });
    for (const p of Object.values(r.state.players)) {
      expect(Object.keys(p.votes)).toEqual(p.votes[0] ? ['0'] : []);
      expect(p.score).toBe(p.votes[0]?.points ?? 0);
      expect(p.lastPoints).toBe(p.votes[0]?.points ?? 0);
    }
    expect(r.state.damageLog).toEqual([s.damageLog[0]]);
    expect(r.state.majorities).toEqual([s.majorities[0]]);
    expect(r.state.bossHp).toBe(400 - s.damageLog[0].total);
    const keys = [...Object.keys(r.state.synthetic), ...Object.keys(r.state.exhibits), ...Object.keys(r.state.callouts)];
    expect(keys.every((k) => Number(k) < 1)).toBe(true);
    expect(r.state.players).toMatchObject(Object.fromEntries(Object.keys(s.players).map((id) => [id, { id }])));   // nobody leaves
    expect(r.effects).toEqual([]);
  });

  it('a restart of the revealed round takes back exactly that round\'s points', () => {
    const before = roundOneVoted();   // round 1 under way, round 0 paid
    const after = closeAndReveal(before);
    const r = cmd(after, { k: 'goto', stage: 1 }).state;
    for (const id of Object.keys(before.players)) {
      expect(r.players[id].score).toBe(before.players[id].score);
      expect(r.players[id].lastPoints).toBe(before.players[id].lastPoints);
    }
    expect(r.bossHp).toBe(before.bossHp);
  });

  it('pads the rounds it skips, so a later reveal lands at its own index', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    const r = cmd(lobby, { k: 'goto', stage: 2 }).state;
    expect(r).toMatchObject({ phase: 'travel', round: 2, trips: 1, bossHp: 400 });
    expect(r.majorities).toEqual([null, null]);
    expect(r.damageLog.map((d) => d.total)).toEqual([0, 0]);
    const revealed = closeAndReveal(cmd(r, { k: 'openVote' }).state);
    expect(revealed.damageLog).toHaveLength(3);
    expect(revealed.damageLog[2].round).toBe(2);
    expect(revealed.majorities).toHaveLength(3);
    // padding after a settled round numbers each zero round by its own index too
    expect(cmd(closeAndReveal(toVote()), { k: 'goto', stage: 3 }).state.damageLog.map((d) => d.round)).toEqual([0, 1, 2]);
  });

  it('clears the alarm only when a vote was open', () => {
    expect(cmd(toVote(), { k: 'goto', stage: 0 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(toVote(), { k: 'goto', stage: 4 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'goto', stage: 0 }).effects).toEqual([]);
  });

  it('goes to the ending for what has been played, clearing nothing, and next still shows the leaderboard', () => {
    const s = twoRounds();
    const r = cmd(s, { k: 'goto', stage: 4 }).state;
    expect(r).toMatchObject({ phase: 'ending', round: 3, voteOpenedAt: null, voteDeadline: null, trips: s.trips });
    expect(r.players).toEqual(s.players);
    expect(r.damageLog).toEqual(s.damageLog);
    expect(r.bossHp).toBe(s.bossHp);
    // and nothing else moves: the majorities, synthetic votes, exhibits and call-outs of the settled rounds stay
    expect({ ...r, phase: s.phase, round: s.round, voteOpenedAt: s.voteOpenedAt, voteDeadline: s.voteDeadline, updatedAt: s.updatedAt }).toEqual(s);
    expect(cmd(r, { k: 'next' }).state.phase).toBe('leaderboard');
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    expect(cmd(lobby, { k: 'goto', stage: 4 }).state).toMatchObject({ phase: 'ending', round: 3 });
  });

  it('refuses a stage that is not 0 to 4 and changes nothing', () => {
    const s = twoRounds();
    for (const stage of [-1, 5, 1.5, Number.NaN]) {
      const r = cmd(s, { k: 'goto', stage });
      expect(r.state).toEqual(s);
      expect(r.effects).toEqual([{ type: 'error', msg: 'bad stage' }]);
    }
  });

  it('counts trips: start, each next into a travel and each goto to a road; reset keeps the count', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    expect(lobby.trips).toBe(0);
    const started = cmd(lobby, { k: 'start' }).state;
    expect(started.trips).toBe(1);
    const second = nextRound(closeAndReveal(cmd(started, { k: 'openVote' }).state));
    expect(second.trips).toBe(2);
    expect(cmd(second, { k: 'goto', stage: 1 }).state.trips).toBe(3);
    const back = cmd(second, { k: 'reset' }).state;
    expect(back.trips).toBe(2);
    expect(cmd(back, { k: 'start' }).state.trips).toBe(3);
    expect(hostView(second, t0, c).trips).toBe(2);
    expect(finished().leaderboard.trips).toBe(4);   // a next into the ending or the leaderboard sets off on no road
  });

  it('writes each voter\'s points on their vote at the reveal', () => {
    // p1 is called out and awarded, so their points carry the call-out's too; p3 does not vote
    const s = run(toVote(), [
      vote('p1', 0, 'B'), vote('p2', 0, 'A'),
      K({ k: 'closeVote' }), K({ k: 'callout', playerId: 'p1' }), K({ k: 'judge', awarded: true }), K({ k: 'reveal' }),
    ]).state;
    for (const p of Object.values(s.players)) {
      if (p.votes[0]) expect(p.votes[0].points).toBe(p.lastPoints);
      else expect(p.lastPoints).toBe(0);
    }
  });

  it('a round voted on but never revealed does not survive a jump past it, forward or to the ending', () => {
    const voting = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'C')]).state;   // round 0 open, two votes in, no reveal
    const forward = cmd(voting, { k: 'goto', stage: 2 }).state;
    expect(Object.values(forward.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(forward.majorities).toEqual([null, null]);
    expect(forward.damageLog.map((d) => d.total)).toEqual([0, 0]);
    expect(forward.bossHp).toBe(400);
    const ending = cmd(voting, { k: 'goto', stage: 4 }).state;
    expect(ending.phase).toBe('ending');
    expect(Object.values(ending.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(tallyFor(ending, 0)).toEqual({ A: 0, B: 0, C: 0, D: 0 });
    expect(ending.damageLog).toEqual([]);
  });
});
