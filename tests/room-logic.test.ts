// tests/room-logic.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { initialState, reduce, sanitizeState, tallyFor, hostView, playerView } from '../shared/room-logic';
import type { RoomState, RoomEvent, HostCmd } from '../shared/types';
const c = loadContent(raw);
const KEY = 'host-secret';
const t0 = 1_000_000;
const mk = () => initialState('ABCD', KEY, t0, c);
const cmd = (s: RoomState, k: HostCmd, now = t0, key = KEY) => reduce(s, { type: 'cmd', key, cmd: k, now }, c);
const run = (s: RoomState, evs: RoomEvent[]) => evs.reduce((acc, ev) => reduce(acc.state, ev, c), { state: s, effects: [] as any[] });
const join = (id: string, name: string | undefined, role = 'government', now = t0, table: string | undefined = 'Team 1'): RoomEvent => ({ type: 'join', clientId: id, name, role, table, now });
const vote = (id: string, round: number, option: any, now = t0 + 6000): RoomEvent => ({ type: 'vote', clientId: id, round, option, now });
const toVote = () => run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'government'), join('p3', 'Cy', 'microsoft'), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, { type: 'cmd', key: KEY, cmd: { k: 'openVote' }, now: t0 }]).state;

describe('lobby and joins', () => {
  it('starts in lobby with round -1 and nothing to score', () => {
    const s = mk();
    expect(s).toMatchObject({ phase: 'lobby', round: -1, voteWindowMs: 120000, majorities: [], callouts: {}, synthetic: {}, trips: 0 });
    for (const key of ['bossHp', 'damageLog', 'exhibits']) expect(s).not.toHaveProperty(key);
  });
  it('joins keep identity on rejoin once the game has started, generate names, take the team', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'business', t0, 'Team 3'), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, join('p1', 'Other', 'microsoft')]).state;
    expect(Object.keys(s.players)).toHaveLength(2);
    expect(s.players.p1).toEqual({ id: 'p1', name: 'Ann', role: 'citizen', table: 'Team 1', joinedAt: t0, votes: {} });
    expect(s.players.p2.name.split(' ')).toHaveLength(2);
    expect(s.players.p2.table).toBe('Team 3');
  });
  it('refuses a join without one of the eight teams and adds no player', () => {
    for (const table of ['Front row', 'Team 9', ' Team 2', '', undefined]) {
      const r = reduce(mk(), { type: 'join', clientId: 'p4', name: 'Dee', role: 'business', table, now: t0 }, c);
      expect(r.effects).toEqual([{ type: 'error', clientId: 'p4', msg: 'bad team' }]);
      expect(r.state).toEqual(mk());
    }
  });
  it('refuses the 201st new player with room full, but a known player can still rejoin at the cap', () => {
    const full = run(mk(), Array.from({ length: 200 }, (_, i) => join(`p${i}`, `N${i}`))).state;
    expect(Object.keys(full.players)).toHaveLength(200);
    const r = reduce(full, join('late', 'Late'), c);
    expect(r.effects).toEqual([{ type: 'error', clientId: 'late', msg: 'room full' }]);
    expect(Object.keys(r.state.players)).toHaveLength(200);
    const again = reduce(full, join('p7', 'Renamed', 'citizen'), c);
    expect(again.effects.some((e: any) => e.type === 'error')).toBe(false);
    expect(again.state.players.p7.name).toBe('Renamed');
  });
  // Spec 4.1 fixes roles once the game starts: in the lobby a phone that tapped the wrong role joins again with the
  // right one.
  it('lets a known player change name, role and team in the lobby, and keeps when they joined and what they have', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen', t0, 'Team 1'), join('p2', 'Bo', 'government', t0 + 1000)]).state;
    // Nothing is earned in the lobby (a reset clears it), but a change must not touch it either way.
    const s: RoomState = { ...lobby, players: { ...lobby.players, p1: { ...lobby.players.p1, votes: { 0: { option: 'B', at: t0 } } } } };
    const r = reduce(s, join('p1', '  Annie ', 'business', t0 + 5000, 'Team 2'), c);
    expect(r.state.players.p1).toEqual({ ...s.players.p1, name: 'Annie', role: 'business', table: 'Team 2' });
    expect(r.state.players.p1).toMatchObject({ joinedAt: t0, votes: { 0: { option: 'B', at: t0 } } });
    expect(r.state.players.p2).toBe(s.players.p2);
    expect(r.state.updatedAt).not.toBe(s.updatedAt);   // a change: the room stores it and tells every screen
    expect(r.effects).toEqual([]);
    expect(playerView(r.state, 'p1', t0 + 5000, c)).toMatchObject({ name: 'Annie', role: 'business', table: 'Team 2' });
    // Cleaned as on a first join: no name gets the generated one.
    const fresh = reduce(mk(), join('p1', '', 'government'), c).state.players.p1;
    expect(reduce(r.state, join('p1', '', 'government', t0 + 6000, 'Team 4'), c).state.players.p1).toMatchObject({ name: fresh.name, role: 'government', table: 'Team 4' });
    // A change to a team outside the eight is refused and keeps the old details.
    const blank = reduce(r.state, join('p1', 'Annie', 'business', t0 + 6000, '  '), c);
    expect(blank.state).toEqual(r.state);
    expect(blank.effects).toEqual([{ type: 'error', clientId: 'p1', msg: 'bad team' }]);
    // The same details again still count as a change, so the phone that sent them always hears back.
    expect(reduce(r.state, join('p1', 'Annie', 'business', t0 + 7000, 'Team 2'), c).state.updatedAt).not.toBe(r.state.updatedAt);
  });
  it('refuses a change to a bad role and keeps the old details', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen', t0, 'Team 1')]).state;
    const r = reduce(s, join('p1', 'Annie', 'dragon', t0 + 5000), c);
    expect(r.state).toEqual(s);
    expect(r.effects).toEqual([{ type: 'error', clientId: 'p1', msg: 'bad role' }]);
  });
  it('ignores a change of details once the game has started, during the vote and in every later phase', () => {
    const vote = toVote();
    const r = reduce(vote, join('p1', 'Annie', 'business', t0 + 5000, 'Team 8'), c);
    expect(r.state).toEqual(vote);
    expect(r.state.players.p1).toMatchObject({ name: 'Ann', role: 'citizen', table: 'Team 1' });
    expect(r.effects).toEqual([]);
    const { reveal, ending } = finished();
    for (const s of [cmd(run(mk(), [join('p1', 'Ann', 'citizen')]).state, { k: 'start' }).state, cmd(vote, { k: 'closeVote' }).state, reveal, ending]) {
      expect(reduce(s, join('p1', 'Annie', 'business', t0 + 5000, 'Team 8'), c).state).toEqual(s);
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
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0 });
  });
  it('adds synthetic votes to the tally', () => {
    const s = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { C: 3 } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 1, B: 1, C: 3 });
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
    const s = cmd(toVote(), { k: 'injectVotes', counts: { B: 10, C: 2 } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 10, C: 2 });
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
    expect(all.state.players.p3.votes[0]).toEqual({ option: 'C', at: t0 + 7000 });
    expect(tallyFor(all.state, 0)).toEqual({ A: 1, B: 1, C: 1 });
    expect(reduce(all.state, vote('p3', 0, 'A'), c).effects).toContainEqual({ type: 'error', clientId: 'p3', msg: 'not accepting votes' });
    // The early lock is closeVote's transition exactly, on the state with the last vote in.
    expect(all).toEqual(cmd({ ...two.state, players: all.state.players }, { k: 'closeVote' }, t0 + 7000));
  });
  it('synthetic votes never lock it, a joiner during the vote holds it open, and an empty room never locks on a key vote', () => {
    expect(cmd(toVote(), { k: 'injectVotes', counts: { A: 30 } }).state.phase).toBe('vote');
    const three = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p3', 0, 'C', t0 + 7000)]).state;
    expect(three.phase).toBe('vote');
    expect(reduce(three, vote('p4', 0, 'A', t0 + 8000), c).state.phase).toBe('locked');
    const empty = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state;
    expect(cmd(empty, { k: 'injectVotes', counts: { B: 5 } }).state.phase).toBe('vote');
  });
  it('a reopen after an early lock runs the full window again and the standing votes stand', () => {
    const all = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), vote('p3', 0, 'C')]).state;
    const again = cmd(all, { k: 'reopen' }, t0 + 9000);
    expect(again.state.phase).toBe('vote');
    expect(again.state.voteDeadline).toBe(t0 + 9000 + 120_000);
    expect(tallyFor(again.state, 0)).toEqual({ A: 1, B: 1, C: 1 });
    expect(reduce(again.state, vote('p1', 0, 'C', t0 + 9500), c).effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'already voted' });
  });
});

describe('call-outs: one voice per option, four a round', () => {
  const locked = () => cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'closeVote' }).state;
  it('picks across every voter, and only once locked', () => {
    expect(cmd(toVote(), { k: 'callout', pick: 0.1 }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
    expect(cmd(locked(), { k: 'callout', pick: 0.1 }).state.callouts[0][0]).toEqual({ playerId: 'p1', option: 'B', status: 'pending' });
    expect(cmd(locked(), { k: 'callout', pick: 0.9 }).state.callouts[0][0]).toEqual({ playerId: 'p2', option: 'A', status: 'pending' });
  });
  it('each call-out goes to an option the round has not heard; then any uncalled voter; then a hand call-out; then the limit', () => {
    const open = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p4', 0, 'B', t0 + 7000)]).state;
    const s = cmd(open, { k: 'closeVote' }).state;   // p1 B, p2 A, p4 B; p3 did not vote
    const first = cmd(s, { k: 'callout', pick: 0.1 }).state;   // pool by join: p1, p2, p4; 0.1 is p1
    expect(first.callouts[0][0]).toMatchObject({ playerId: 'p1', option: 'B' });
    const second = cmd(cmd(first, { k: 'judge', awarded: true }).state, { k: 'callout', pick: 0.9 }).state;   // B is heard: p2 alone is preferred, whatever the pick
    expect(second.callouts[0][1]).toMatchObject({ playerId: 'p2', option: 'A' });
    // A named voter wins over that preference: p4's B has been heard, and p4 is called all the same.
    const named = cmd(cmd(first, { k: 'judge', awarded: true }).state, { k: 'callout', playerId: 'p4', pick: 0.9 }).state;
    expect(named.callouts[0][1]).toMatchObject({ playerId: 'p4', option: 'B' });
    const third = cmd(cmd(second, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // every voted option heard: any uncalled voter
    expect(third.callouts[0][2]).toMatchObject({ playerId: 'p4', option: 'B' });
    const fourth = cmd(cmd(third, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // nobody left: by hand
    expect(fourth.callouts[0][3]).toEqual({ playerId: null, option: null, status: 'pending' });
    const fifth = cmd(cmd(fourth, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 });
    expect(fifth.effects).toContainEqual({ type: 'error', msg: 'call-out limit' });
    expect(fifth.state.callouts[0]).toHaveLength(4);
  });
  it('with voters on A, B and C, the first three call-outs cover all three, and a fifth is refused', () => {
    for (const pick of [0, 0.5, 0.99]) {
      let s = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), vote('p3', 0, 'C')]).state;   // the last vote locks it
      expect(s.phase).toBe('locked');
      for (let i = 0; i < 4; i++) s = cmd(cmd(s, { k: 'callout', pick }).state, { k: 'judge', awarded: i % 2 === 0 }).state;
      expect(s.callouts[0].slice(0, 3).map((co) => co.option).sort()).toEqual(['A', 'B', 'C']);
      expect(s.callouts[0]).toHaveLength(4);
      expect(cmd(s, { k: 'callout', pick }).effects).toEqual([{ type: 'error', msg: 'call-out limit' }]);
    }
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
    expect(cmd(s, { k: 'callout', pick: 0.3 }).state.callouts[0][0]).toEqual({ playerId: null, option: null, status: 'pending' });
  });
  it('judging sets the status and nothing else; a call-out still pending at the reveal is declined', () => {
    const before = cmd(locked(), { k: 'callout', playerId: 'p1' }).state;
    const s = cmd(before, { k: 'judge', awarded: true }).state;
    expect(s.callouts[0][0]).toEqual({ playerId: 'p1', option: 'B', status: 'awarded' });
    expect(s.callouts[0][0]).not.toHaveProperty('points');
    expect(s.players).toEqual(before.players);
    const declined = cmd(before, { k: 'judge', awarded: false }).state;
    expect(declined.callouts[0][0]).toEqual({ playerId: 'p1', option: 'B', status: 'declined' });
    const t = cmd(s, { k: 'callout', playerId: 'p2' }).state;           // left pending on purpose
    const r = cmd(t, { k: 'reveal' }).state;
    expect(r.callouts[0]).toEqual([{ playerId: 'p1', option: 'B', status: 'awarded' }, { playerId: 'p2', option: 'A', status: 'declined' }]);
    expect(r.players).toEqual(t.players);
  });
});

describe('reveal and next', () => {
  it('records the majority and touches nothing but the phase, the call-outs and the majorities', () => {
    // p4 joins and never votes, so the vote stays open until the closeVote
    const s = cmd(run(toVote(), [join('p4', 'Dee', 'business'), vote('p1', 0, 'B'), vote('p2', 0, 'B'), vote('p3', 0, 'A')]).state, { k: 'closeVote' }).state;
    const r = cmd(s, { k: 'reveal' }, t0 + 50000).state;
    expect(r.phase).toBe('reveal');
    expect(r.majorities).toEqual(['B']);
    expect({ ...r, phase: s.phase, majorities: s.majorities, callouts: s.callouts, updatedAt: s.updatedAt }).toEqual(s);
  });
  it('reveals a round with no votes and records no majority', () => {
    const s = cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(s.phase).toBe('reveal');
    expect(s.majorities).toEqual([null]);
  });
  it('five rounds end in the ending, and next there is a bad phase', () => {
    let s = cmd(run(mk(), [join('p1', 'Ann', 'citizen')]).state, { k: 'start' }).state;
    for (let r = 0; r < 5; r++) {
      expect(s).toMatchObject({ phase: 'travel', round: r });
      s = run(s, [K({ k: 'openVote' }), vote('p1', r, 'ABCAB'[r]), K({ k: 'closeVote' }), K({ k: 'reveal' }), K({ k: 'next' })]).state;
    }
    expect(s).toMatchObject({ phase: 'ending', round: 4, trips: 5 });
    expect(s.majorities).toEqual(['A', 'B', 'C', 'A', 'B']);
    const r = cmd(s, { k: 'next' });
    expect(r.effects).toEqual([{ type: 'error', msg: 'bad phase' }]);
    expect(r.state).toEqual(s);
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
  it('reset returns to lobby keeping players and bans but clearing votes, majorities and call-outs', () => {
    const played = run(toVote(), [vote('p1', 0, 'B'), K({ k: 'closeVote' }), K({ k: 'callout', pick: 0 }), K({ k: 'reveal' })]).state;
    const banned = cmd(played, { k: 'kick', playerId: 'p3' }).state;
    const s = cmd(banned, { k: 'reset' }).state;
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1);
    expect(Object.keys(s.players)).toHaveLength(2); expect(s.players.p1.votes).toEqual({});
    expect(s.majorities).toEqual([]); expect(s.callouts).toEqual({});
    expect(s.banned).toEqual(['p3']);
  });
});

describe('views', () => {
  it('host view hides the key and carries the tally, and nothing of scoring', () => {
    const v = hostView(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, t0 + 1, c);
    expect((v as any).hostKey).toBeUndefined();
    expect(v.tally).toEqual({ A: 1, B: 1, C: 0 });
    expect(v.serverNow).toBe(t0 + 1);
    for (const key of ['bossHp', 'damageLog', 'leadTally', 'supportTally', 'lead', 'exhibits']) expect(v).not.toHaveProperty(key);
  });
  it('player view carries role, team, vote and picks, and never a score, rank or tally', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const v = playerView(s, 'p1', t0 + 1, c)!;
    expect(v).toEqual({
      phase: 'vote', round: 0, serverNow: t0 + 1, voteDeadline: t0 + 120000, voteWindowMs: 120000,
      name: 'Ann', role: 'citizen', table: 'Team 1', myVote: 'B', playerCount: 3, picks: ['B'], callout: null,
    });
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(playerView(r, 'p2', t0, c)!.picks).toEqual([null]);
    const { ending } = finished();
    for (const state of [mk(), run(mk(), [join('p1', 'Ann', 'citizen')]).state, s, cmd(s, { k: 'closeVote' }).state, r, ending]) {
      const view = playerView(state, 'p1', t0, c);
      if (!view) continue;
      for (const key of ['score', 'rank', 'lastPoints', 'tally', 'isLead', 'lead', 'leadTally', 'supportTally', 'majorities']) expect(view).not.toHaveProperty(key);
    }
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
function K(k: HostCmd, now = t0): RoomEvent { return { type: 'cmd', key: KEY, cmd: k, now }; }
const zero = { A: 0, B: 0, C: 0 };
const closeAndReveal = (s: RoomState) => cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
const nextRound = (s: RoomState) => cmd(cmd(s, { k: 'next' }).state, { k: 'openVote' }).state;
/** The last round revealed, then the ending, reached through the real transitions. */
function finished() {
  let s = toVote();
  for (let r = 0; r < 4; r++) s = nextRound(closeAndReveal(s));
  const reveal = closeAndReveal(s);
  return { reveal, ending: cmd(reveal, { k: 'next' }).state };
}

describe('purity', () => {
  const deepFreeze = <T>(x: T): T => {
    if (x !== null && typeof x === 'object' && !Object.isFrozen(x)) {
      Object.freeze(x);
      for (const v of Object.values(x)) deepFreeze(v);
    }
    return x;
  };
  // One scripted class night through every phase: a change of details in the lobby, a bad role, a bad team, a rejoin
  // after the start, injected votes, a tick that changes nothing and one that locks, a reopen that a late voter's vote,
  // the last in the room, locks again in even rounds and Space (closeVote) locks in odd ones, two call-outs (one judged,
  // one left pending), the ending, a refused next on it, a kick, a banned rejoin, hideNames and a reset.
  const night = (): RoomEvent[] => {
    const evs: RoomEvent[] = [
      join('p1', 'Ann', 'citizen'), join('p2', undefined, 'government'), join('p3', 'Cy', 'microsoft'),
      join('p4', 'Di', 'business', t0, 'Team 3'), join('p1', 'Other', 'microsoft'), join('p5', 'Eve', 'dragon'),
      join('p6', 'Fay', 'citizen', t0, 'Front row'),
      K({ k: 'start' }), join('p1', 'Ann', 'citizen'),
    ];
    for (let r = 0; r < 5; r++) {
      const at = t0 + r * 200_000;
      evs.push(
        K({ k: 'openVote' }, at),
        vote('p1', r, 'B', at + 4000), vote('p2', r, 'A', at + 8000), vote('p3', r, 'B', at + 9000),
        vote('p1', r, 'C', at + 9500), vote('ghost', r, 'B', at + 9600),
        K({ k: 'injectVotes', counts: { C: 2 } }, at + 10000),
        { type: 'tick', now: at + 5000 }, { type: 'tick', now: at + 120000 },
        K({ k: 'reopen' }, at + 121000), r % 2 === 0 ? vote('p4', r, 'C', at + 121500) : K({ k: 'closeVote' }, at + 121500),
        K({ k: 'callout', pick: 0.4 }, at + 123000), K({ k: 'judge', awarded: true }, at + 124000),
        K({ k: 'callout', pick: 0.9 }, at + 125000), K({ k: 'reveal' }, at + 126000), K({ k: 'next' }, at + 127000),
      );
    }
    evs.push(K({ k: 'next' }, t0 + 1_100_000), K({ k: 'kick', playerId: 'p2' }), join('p2', 'Bee', 'government'), K({ k: 'hideNames', hide: true }), K({ k: 'reset' }));
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
    expect([...new Set(plain.steps.map((s) => s.phase))].sort()).toEqual(['ending', 'lobby', 'locked', 'reveal', 'travel', 'vote']);
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
    const { ending } = finished();
    for (const s of [mk(), cmd(mk(), { k: 'start' }).state, lockedState, closeAndReveal(toVote()), ending]) {
      for (const now of [t0, t0 + 119999, t0 + 120000, t0 + 399999]) {
        const out = reduce(s, { type: 'tick', now }, c);
        expect(out.effects).toEqual([]);
        expect(out.state).toEqual(s);
      }
    }
  });
  it('locks an open vote whose deadline is not a finite time on its next tick, instead of arming an alarm for it', () => {
    // setAlarm refuses such a time, so arming it would make every alarm throw and be retried, and the vote never close.
    for (const voteDeadline of [Infinity, Number.NaN, null]) {
      const out = reduce({ ...toVote(), voteDeadline }, { type: 'tick', now: t0 + 1000 }, c);
      expect(out.state.phase).toBe('locked');
      expect(out.effects).toEqual([{ type: 'clearAlarm' }]);
    }
  });
});

describe('input hardening', () => {
  it('ignores a vote for an option outside A to C, D included, and the player can still vote properly', () => {
    for (const bad of ['D', 'Z', 'a', '', 'constructor', undefined]) {
      const r = reduce(toVote(), vote('p1', 0, bad as never), c);
      expect(r.state.players.p1.votes).toEqual({});
      expect(r.effects).toEqual([]);
    }
    expect(tallyFor(run(toVote(), [vote('p1', 0, 'D'), vote('p1', 0, 'C')]).state, 0)).toEqual({ A: 0, B: 0, C: 1 });
  });
  it('looks players up by own key, so constructor is no phantom player and __proto__ is not lost', () => {
    const s = toVote();
    for (const id of ['constructor', 'toString', 'hasOwnProperty', '__proto__']) {
      expect(reduce(s, vote(id, 0, 'B'), c).effects).toContainEqual({ type: 'error', clientId: id, msg: 'unknown player' });
      expect(playerView(s, id, t0, c)).toBeNull();
    }
    const odd = run(s, [join('__proto__', 'Pro', 'business'), vote('__proto__', 0, 'C')]).state;
    expect(Object.keys(odd.players)).toEqual(['p1', 'p2', 'p3', '__proto__']);
    expect(tallyFor(odd, 0)).toEqual({ A: 0, B: 0, C: 1 });
    expect(playerView(odd, '__proto__', t0, c)).toMatchObject({ name: 'Pro', myVote: 'C', playerCount: 4 });
  });
  it('adds only whole, positive injected votes for A to C and accumulates across calls', () => {
    const s = cmd(toVote(), { k: 'injectVotes', counts: { A: -3, B: 2.9, C: Number.NaN } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0 });
    expect(tallyFor(cmd(s, { k: 'injectVotes', counts: { A: Number.POSITIVE_INFINITY, D: 5 } as never }).state, 0)).toEqual({ A: 0, B: 2, C: 0 });
    const more = cmd(cmd(s, { k: 'injectVotes', counts: { B: 1 } }).state, { k: 'injectVotes', counts: { B: 2, C: 4 } }).state;
    expect(tallyFor(more, 0)).toEqual({ A: 0, B: 5, C: 4 });
  });
  it('injects while the vote is locked too, but not before it opens or after the reveal', () => {
    const lockedS = cmd(toVote(), { k: 'closeVote' }).state;
    expect(tallyFor(cmd(lockedS, { k: 'injectVotes', counts: { C: 4 } }).state, 0).C).toBe(4);
    const notAccepting = [{ type: 'error', msg: 'not accepting votes' }];
    expect(cmd(cmd(mk(), { k: 'start' }).state, { k: 'injectVotes', counts: { C: 4 } }).effects).toEqual(notAccepting);
    expect(cmd(mk(), { k: 'injectVotes', counts: { C: 4 } }).effects).toEqual(notAccepting);
  });
  it('treats an unknown command, the old exhibit one included, as nothing to do', () => {
    for (const k of ['explode', 'exhibit']) {
      const r = cmd(cmd(mk(), { k: 'start' }).state, { k, exhibitId: 'x' } as unknown as HostCmd);
      expect(r.state).toEqual(cmd(mk(), { k: 'start' }).state);
      expect(r.effects).toEqual([]);
    }
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
    expect(refused(finished().ending, { k: 'next' })).toEqual(bad);
  });
  it('a reveal is final: reopen is refused from reveal and the ending', () => {
    const { reveal, ending } = finished();
    expect([reveal.phase, ending.phase]).toEqual(['reveal', 'ending']);
    for (const s of [reveal, ending]) expect(refused(s, { k: 'reopen' })).toEqual(bad);
  });
  it('a second reveal is refused, so a majority is never recorded twice', () => {
    const once = closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state);
    expect(once.majorities).toEqual(['B']);
    expect(refused(once, { k: 'reveal' })).toEqual(bad);
  });
  it('next is refused while locked, so a reveal cannot be skipped', () => {
    expect(refused(cmd(toVote(), { k: 'closeVote' }).state, { k: 'next' })).toEqual(bad);
  });
  it('allows each phase-gated command in exactly its phases', () => {
    const { reveal, ending } = finished();
    const states: Record<string, RoomState> = {
      lobby: mk(), travel: cmd(mk(), { k: 'start' }).state, vote: toVote(), locked: cmd(toVote(), { k: 'closeVote' }).state, reveal, ending,
    };
    const allowedIn: Record<string, string[]> = {
      start: ['lobby'], openVote: ['travel'], closeVote: ['vote'], reveal: ['locked'],
      next: ['reveal'], reopen: ['locked', 'vote'], callout: ['locked'],
      goto: ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'],
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
    const played = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { C: 3 } }).state;
    const s = cmd(played, { k: 'reset' }).state;
    expect(s.players.p1.votes).toEqual({});
    expect(s.synthetic).toEqual({});
    expect(s.majorities).toEqual([]);
    expect(s).toMatchObject({ voteOpenedAt: null, voteDeadline: null, voteWindowMs: 120000 });
    const again = run(s, [K({ k: 'start' }), K({ k: 'openVote' }), vote('p1', 0, 'C')]).state;
    expect(tallyFor(again, 0)).toEqual({ A: 0, B: 0, C: 1 });
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
      ['bad team', join('p4', 'Di', 'business', at, 'Team 0'), false],
      ['vote in the lobby', vote('p1', 0, 'B', at), false],
      ['bad host key', { type: 'cmd', key: 'wrong', cmd: { k: 'start' }, now: at }, false],
      ['start', K({ k: 'start' }, at), true],
      ['start again', K({ k: 'start' }, at), false],
      ['rejoin after the start', join('p1', 'Other', 'business', at), false],
      ['openVote', K({ k: 'openVote' }, at), true],
      ['early tick', { type: 'tick', now: at }, false],
      ['vote', vote('p1', 0, 'B', at), true],
      ['second vote', vote('p2', 0, 'A', at), true],
      ['vote again', vote('p1', 0, 'C', at), false],
      ['injectVotes', K({ k: 'injectVotes', counts: { C: 2 } }, at), true],
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
    const last = reveal.updatedAt;   // the closing screen, at the same reading as the change before it
    const closing: [string, RoomEvent, boolean][] = [
      ['next to the ending', K({ k: 'next' }, last), true],
      ['next on the ending', K({ k: 'next' }, last), false],
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
    const judged = cmd(hand, { k: 'judge', awarded: true }).state;
    expect(judged.callouts[0][0]).toEqual({ playerId: null, option: null, status: 'awarded' });
    expect(playerView(judged, 'p1', t0, c)!.callout).toBeNull();
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
    // judged during the reopened vote instead: settled, and a second call-out is allowed after the next lock
    const judged = cmd(reopened, { k: 'judge', awarded: true }, t0 + 2000).state;
    expect(judged.callouts[0][0]).toEqual({ playerId: 'p1', option: 'B', status: 'awarded' });
    expect(playerView(judged, 'p1', t0, c)!.callout).toBeNull();
    const second = cmd(cmd(judged, { k: 'closeVote' }, t0 + 3000).state, { k: 'callout', playerId: 'p2' }).state;
    expect(second.callouts[0]).toHaveLength(2);
    expect(second.callouts[0][1]).toMatchObject({ playerId: 'p2', status: 'pending' });
  });
});

describe('reveal details', () => {
  it('synthetic votes alone give the round a majority', () => {
    const s = closeAndReveal(cmd(toVote(), { k: 'injectVotes', counts: { B: 8, C: 2 } }).state);
    expect(s.majorities).toEqual(['B']);
  });
  it('counts real and synthetic votes together for the majority', () => {
    const s = closeAndReveal(cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { C: 3 } }).state);
    expect(s.majorities).toEqual(['C']);
  });
  it('a tie goes to the earlier letter', () => {
    expect(closeAndReveal(run(toVote(), [vote('p1', 0, 'C'), vote('p2', 0, 'B')]).state).majorities).toEqual(['B']);
  });
  it('records one majority per round, null for a round nobody voted in', () => {
    let s = closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state);
    s = closeAndReveal(nextRound(s));
    s = closeAndReveal(run(nextRound(s), [vote('p1', 2, 'C')]).state);
    expect(s.majorities).toEqual(['B', null, 'C']);
  });
});

describe('view details', () => {
  it('in the lobby the tally is zero and the picks are empty', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', 'Bo', 'business')]).state;
    expect(hostView(s, t0, c)).toMatchObject({ phase: 'lobby', round: -1, tally: zero });
    expect(playerView(s, 'p1', t0, c)).toMatchObject({ round: -1, myVote: null, picks: [], playerCount: 2, table: 'Team 1' });
  });
  it('the next round starts with no vote and keeps the picks so far', () => {
    const r = closeAndReveal(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state);
    const v = playerView(cmd(r, { k: 'next' }).state, 'p1', t0, c)!;
    expect(v).toMatchObject({ phase: 'travel', round: 1, myVote: null });
    expect(v.picks).toEqual(['B', null]);
  });
  it('the ending lists all five picks', () => {
    let s = toVote();
    for (let r = 0; r < 5; r++) {
      if (r > 0) s = nextRound(s);
      s = closeAndReveal(r === 3 ? s : run(s, [vote('p1', r, 'ABCAC'[r])]).state);
    }
    expect(playerView(cmd(s, { k: 'next' }).state, 'p1', t0, c)!.picks).toEqual(['A', 'B', 'C', null, 'C']);
  });
  it('gives a kicked player no view', () => {
    expect(playerView(cmd(toVote(), { k: 'kick', playerId: 'p1' }).state, 'p1', t0, c)).toBeNull();
  });
});

describe('goto', () => {
  // Round 0 revealed, with votes from p1 and p2. Round 1 under way, with votes from p1 and p3, two synthetic votes and a
  // call-out, so a jump has entries of every kind to keep or clear, and p2 and p3 each lack a round the other has.
  const roundOneVoted = () => run(closeAndReveal(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state), [
    K({ k: 'next' }), K({ k: 'openVote' }),
    vote('p1', 1, 'C'), vote('p3', 1, 'B'), K({ k: 'injectVotes', counts: { C: 2 } }),
  ]).state;
  const twoRounds = () => run(roundOneVoted(), [K({ k: 'closeVote' }), K({ k: 'callout', pick: 0 }), K({ k: 'reveal' })]).state;   // round 1 revealed

  it('restarts the round it goes to, keeps the rounds before it, and clears the rest', () => {
    const s = twoRounds();
    expect(Object.keys(s.synthetic)).toEqual(['1']);
    expect(s.callouts[1]).toHaveLength(1);
    const r = cmd(s, { k: 'goto', stage: 1 }, t0 + 90000);
    expect(r.state).toMatchObject({ phase: 'travel', round: 1, voteOpenedAt: null, voteDeadline: null, trips: s.trips + 1 });
    for (const [id, p] of Object.entries(r.state.players)) expect(p.votes).toEqual(s.players[id].votes[0] ? { 0: s.players[id].votes[0] } : {});
    expect(r.state.majorities).toEqual([s.majorities[0]]);
    expect(r.state.synthetic).toEqual({});
    expect(r.state.callouts).toEqual({ 0: s.callouts[0] });
    expect(r.state.players).toMatchObject(Object.fromEntries(Object.keys(s.players).map((id) => [id, { id }])));   // nobody leaves
    expect(r.effects).toEqual([]);
  });

  it('pads the rounds it skips, so a later reveal lands at its own index', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    const r = cmd(lobby, { k: 'goto', stage: 2 }).state;
    expect(r).toMatchObject({ phase: 'travel', round: 2, trips: 1 });
    expect(r.majorities).toEqual([null, null]);
    const revealed = closeAndReveal(run(r, [K({ k: 'openVote' }), vote('p1', 2, 'C')]).state);
    expect(revealed.majorities).toEqual([null, null, 'C']);
    // padding after a settled round
    expect(cmd(closeAndReveal(run(toVote(), [vote('p1', 0, 'B')]).state), { k: 'goto', stage: 3 }).state.majorities).toEqual(['B', null, null]);
  });

  it('goes back to a road from a travel or the ending, keeping the rounds before it', () => {
    const { ending } = finished();
    const travel = cmd(closeAndReveal(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state), { k: 'next' }).state;
    for (const s of [travel, ending]) {
      const r = cmd(s, { k: 'goto', stage: 1 }).state;
      expect(r).toMatchObject({ phase: 'travel', round: 1, trips: s.trips + 1 });
      expect(r.majorities).toEqual([s.majorities[0]]);
      for (const [id, p] of Object.entries(r.players)) expect(Object.keys(p.votes)).toEqual(s.players[id].votes[0] ? ['0'] : []);
    }
    expect(cmd(ending, { k: 'goto', stage: 1 }).state.trips).toBe(6);
  });

  it('clears the alarm only when a vote was open', () => {
    expect(cmd(toVote(), { k: 'goto', stage: 0 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(toVote(), { k: 'goto', stage: 5 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'goto', stage: 0 }).effects).toEqual([]);
  });

  it('stage 5 is the ending on round 4 for what has been played, clearing nothing, and next there is refused', () => {
    const s = twoRounds();
    const r = cmd(s, { k: 'goto', stage: 5 }).state;
    expect(r).toMatchObject({ phase: 'ending', round: 4, voteOpenedAt: null, voteDeadline: null, trips: s.trips });
    // and nothing else moves: the votes, majorities, synthetic votes and call-outs of the settled rounds stay
    expect({ ...r, phase: s.phase, round: s.round, voteOpenedAt: s.voteOpenedAt, voteDeadline: s.voteDeadline, updatedAt: s.updatedAt }).toEqual(s);
    expect(cmd(r, { k: 'next' }).effects).toEqual([{ type: 'error', msg: 'bad phase' }]);
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    expect(cmd(lobby, { k: 'goto', stage: 5 }).state).toMatchObject({ phase: 'ending', round: 4 });
  });

  it('refuses a stage that is not 0 to 5 and changes nothing', () => {
    const s = twoRounds();
    for (const stage of [-1, 6, 1.5, Number.NaN]) {
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
    expect(finished().ending.trips).toBe(5);   // a next into the ending sets off on no road
  });

  it('a round voted on but never revealed does not survive a jump past it, forward or to the ending', () => {
    const voting = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'C')]).state;   // round 0 open, two votes in, no reveal
    const forward = cmd(voting, { k: 'goto', stage: 2 }).state;
    expect(Object.values(forward.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(forward.majorities).toEqual([null, null]);
    const ending = cmd(voting, { k: 'goto', stage: 5 }).state;
    expect(ending.phase).toBe('ending');
    expect(Object.values(ending.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(tallyFor(ending, 0)).toEqual(zero);
    expect(ending.majorities).toEqual([]);
  });
});

describe('rooms saved by an earlier build', () => {
  /** A state as an earlier build stored it: this one with the given changes, and without the trip count. */
  const earlier = (state: RoomState, changes: Record<string, unknown> = {}): RoomState => {
    const { trips: _trips, ...old } = { ...state, ...changes };
    return old as unknown as RoomState;
  };
  /** A room from the scoring build: boss HP, a damage log, exhibits, and players with scores. */
  const oldRoom = () => earlier(toVote(), { bossHp: 305, exhibits: { 0: ['t1a'] }, damageLog: [] });
  it('gives a room without trips, or with a trip count that is not a number, a count of 0, so a start sets off on trip 1', () => {
    const safe = sanitizeState(earlier(run(mk(), [join('p1', 'Ann', 'citizen')]).state), c);
    expect(safe.trips).toBe(0);
    expect(cmd(safe, { k: 'start' }).state.trips).toBe(1);
    for (const trips of [Number.NaN, Infinity, null, '2']) expect(sanitizeState({ ...mk(), trips } as unknown as RoomState, c).trips).toBe(0);
  });
  it('turns a deadline that is not a finite time into none, and the next tick locks that vote', () => {
    const safe = sanitizeState(earlier(toVote(), { voteDeadline: Infinity }), c);
    expect(safe).toMatchObject({ phase: 'vote', voteDeadline: null, trips: 0 });
    const ticked = reduce(safe, { type: 'tick', now: t0 + 1000 }, c);
    expect(ticked.state.phase).toBe('locked');
    expect(ticked.effects).toEqual([{ type: 'clearAlarm' }]);
  });
  it('gives every other field the reducer reads a usable value when it has none', () => {
    const fresh = mk();
    const safe = sanitizeState(earlier(toVote(), {
      voteOpenedAt: Number.NaN, voteWindowMs: Infinity, players: undefined, banned: null, synthetic: [],
      callouts: undefined, majorities: null, hideNames: 'yes',
    }), c);
    const fields = ['voteOpenedAt', 'voteWindowMs', 'players', 'banned', 'synthetic', 'callouts', 'majorities', 'hideNames'] as const;
    expect(Object.fromEntries(fields.map((f) => [f, safe[f]]))).toEqual(Object.fromEntries(fields.map((f) => [f, fresh[f]])));
    for (const voteWindowMs of [0, -5, Number.NaN, '120000']) {
      expect(sanitizeState(earlier(toVote(), { voteWindowMs }), c).voteWindowMs).toBe(120_000);
    }
  });
  it('loads a room left on the leaderboard as the ending, with its scoring and option D gone', () => {
    const old = oldRoom();
    const p = old.players.p1;
    const stored = {
      ...old, phase: 'leaderboard', round: 3, damageLog: [{ round: 0, total: 80 }],
      players: { p: { ...p, id: 'p', table: null, score: 90, lastPoints: 10, votes: { 0: { option: 'D', at: 1 }, 1: { option: 'B', at: 2, points: 40 } } } },
    } as unknown as RoomState;
    const safe = sanitizeState(stored, c);
    expect(safe.phase).toBe('ending');
    expect(safe.round).toBe(3);
    expect(safe.players.p).toEqual({ id: 'p', name: 'Ann', role: 'citizen', table: 'Team 1', joinedAt: t0, votes: { 1: { option: 'B', at: 2 } } });
    expect(sanitizeState({ ...stored, players: { p: { ...p, table: null, votes: { 0: { option: 'D', at: 1 } } } } } as unknown as RoomState, c).players.p.votes).toEqual({});
    for (const key of ['bossHp', 'damageLog', 'exhibits']) expect(safe).not.toHaveProperty(key);
    expect(() => reduce(safe, { type: 'tick', now: t0 + 1000 }, c)).not.toThrow();
    const view = hostView(safe, t0, c);
    for (const key of ['bossHp', 'damageLog', 'exhibits']) expect(view).not.toHaveProperty(key);
    expect(view.players.p).not.toHaveProperty('score');
  });
  it('turns an unknown phase into the lobby and clamps the round to -1 to 4', () => {
    expect(sanitizeState(earlier(mk(), { phase: 'gate' }), c).phase).toBe('lobby');
    for (const [round, want] of [[9, 4], [-7, -1], [2, 2], [Number.NaN, -1], ['3', -1], [1.5, -1]] as const) {
      expect(sanitizeState(earlier(mk(), { round }), c).round).toBe(want);
    }
  });
  it('reduces call-outs to playerId, option and status, and drops majorities outside A to C', () => {
    const safe = sanitizeState(earlier(toVote(), {
      callouts: { 0: [
        { playerId: 'p1', option: 'B', status: 'awarded', points: 30 },
        { playerId: 'p2', option: 'D', status: 'odd', points: 10 },
        { playerId: 7, option: 'A', status: 'pending' },
      ] },
      majorities: ['B', 'D', 7, null, 'C'],
    }), c);
    expect(safe.callouts).toEqual({ 0: [
      { playerId: 'p1', option: 'B', status: 'awarded' },
      { playerId: 'p2', option: null, status: 'declined' },
      { playerId: null, option: 'A', status: 'pending' },
    ] });
    expect(safe.majorities).toEqual(['B', null, null, null, 'C']);
  });
  it('keeps only whole counts for A to C in synthetic votes', () => {
    const safe = sanitizeState(earlier(toVote(), { synthetic: { 0: { A: 2, B: 0, C: 1, D: 4 }, 1: { A: 'x', B: Number.NaN, C: 3 }, 2: 'odd' } }), c);
    expect(safe.synthetic).toEqual({ 0: { A: 2, B: 0, C: 1 }, 1: { A: 0, B: 0, C: 3 } });
    expect(tallyFor(safe, 1)).toEqual({ A: 0, B: 0, C: 3 });
  });
  it('leaves a room saved by this build as it was', () => {
    const { reveal, ending } = finished();
    const called = run(toVote(), [vote('p1', 0, 'B'), K({ k: 'closeVote' }), K({ k: 'callout', pick: 0 }), K({ k: 'judge', awarded: true }), K({ k: 'callout', pick: 0 })]).state;
    for (const s of [mk(), toVote(), cmd(toVote(), { k: 'reopen' }, t0 + 9000).state, called, reveal, ending]) expect(sanitizeState(s, c)).toEqual(s);
  });
});
