// The pure side of the Battle scene (host/strikers.ts): the words around the question, the vote and the call-outs,
// what Space does, and the cues for the clock and the phases.
import { describe, expect, it } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { hostView, initialState, reduce } from '../shared/room-logic';
import type { Callout, OptionId, Phase, Player, Role, RoomEvent, RoomState, Tally } from '../shared/types';
import {
  AUTO_LOCK_MS, bannerFor, CLOCK_LOCK_NOTE, clockCues, EVERYONE_LOCK_NOTE, judgeFlash, KILL_MS, labelFor, lockedByClock, lockedEarly,
  lockNoteFor, lockoutAfterLock, optionsFooter, phaseCues, questionFor, SEND_LOCK_MS, spaceAction, timerText, validNotes, votedText,
  type SpaceState,
} from '../host/strikers';

const c = loadContent(raw);
const content = c;
const T = (A: number, B: number, C: number): Tally => ({ A, B, C });
const Z = T(0, 0, 0);
const player = (id: string, name: string, role: Role): Player => ({ id, name, role, table: 'Team 1', joinedAt: 0, votes: {} });
const called = (playerId: string | null, option: OptionId | null, status: Callout['status']): Callout => ({ playerId, option, status });
const players = { p1: player('p1', 'Ann', 'citizen'), p2: player('p2', 'Ben', 'business') };

describe('the question', () => {
  it('names the question, its boss and its problem, and says Space opens the vote', () => {
    expect(questionFor(content, 1)).toEqual({ eyebrow: 'Question 2 of 5: Demand', boss: 'Fog of Demand', question: content.rounds[1].question, footer: 'Space opens the vote' });
    expect(questionFor(c, 0)).toMatchObject({ eyebrow: 'Question 1 of 5: Power', boss: 'Grid Wyrm' });
    expect(questionFor(c, 4)).toEqual({ eyebrow: 'Question 5 of 5: The Deadlock', boss: 'The Deadlock', question: c.rounds[4].question, footer: 'Space opens the vote' });
  });

  it('names a role by the name the content gives it', () => {
    expect(labelFor(c, 'microsoft')).toBe('Satya Nadella');
    expect(labelFor(c, 'business')).toBe('Local Businessman');
  });
});

describe('the words around the vote', () => {
  it('counts the votes against the room online, each bot vote counted as a voter, and the votes alone offline', () => {
    expect(votedText(T(1, 2, 0), 5, undefined, { offline: false, open: false })).toBe('3 of 5 voted');
    // Two phones voted, one did not, and three bot votes came in: 5 of the 6 who could vote.
    expect(votedText(T(1, 4, 0), 3, T(0, 3, 0), { offline: false, open: false })).toBe('5 of 6 voted');
    expect(votedText(T(2, 10, 0), 0, T(2, 10, 0), { offline: true, open: false })).toBe('12 voted');
    expect(votedText(Z, 0, undefined, { offline: false, open: false })).toBe('0 of 0 voted');
  });

  it('the count says who is still to vote while the vote is open, and who voted once it is locked', () => {
    expect(votedText(T(1, 2, 0), 5, undefined, { offline: false, open: true })).toBe('2 still to vote');
    expect(votedText(T(1, 4, 0), 3, T(0, 3, 0), { offline: false, open: true })).toBe('1 still to vote');
    expect(votedText(T(1, 2, 0), 3, undefined, { offline: false, open: true })).toBe('Everyone has voted');
    expect(votedText(T(5, 0, 0), 2, T(5, 0, 0), { offline: false, open: true })).toBe('2 still to vote');
    expect(votedText(T(5, 0, 0), 2, undefined, { offline: false, open: true })).toBe('Everyone has voted');   // more votes than players: none to go
    expect(votedText(Z, 0, undefined, { offline: false, open: true })).toBe('No players yet');
    expect(votedText(T(1, 2, 0), 5, undefined, { offline: false, open: false })).toBe('3 of 5 voted');
    expect(votedText(T(1, 4, 0), 3, T(0, 3, 0), { offline: false, open: false })).toBe('5 of 6 voted');
    expect(votedText(T(2, 10, 0), 0, T(2, 10, 0), { offline: true, open: true })).toBe('12 voted');
    expect(votedText(T(2, 10, 0), 0, T(2, 10, 0), { offline: true, open: false })).toBe('12 voted');
  });

  it('counts the clock down in whole seconds, rounding up, never below zero', () => {
    expect(timerText(31_000, 1_000)).toBe('0:30');
    expect(timerText(31_000, 1_001)).toBe('0:30');
    expect(timerText(31_000, 30_001)).toBe('0:01');
    expect(timerText(31_000, 31_000)).toBe('0:00');
    expect(timerText(31_000, 45_000)).toBe('0:00');
    expect(timerText(null, 0)).toBe('');
  });

  it('the timer reads the time left as minutes and seconds, rounded up', () => {
    expect(timerText(121_000, 1_000)).toBe('2:00');
    expect(timerText(121_000, 1_001)).toBe('2:00');
    expect(timerText(121_000, 61_500)).toBe('1:00');
    expect(timerText(121_000, 112_000)).toBe('0:09');
    expect(timerText(121_000, 121_000)).toBe('0:00');
    expect(timerText(121_000, 150_000)).toBe('0:00');
    expect(timerText(null, 0)).toBe('');
  });

  it('lockNoteFor picks the note from views the reducer builds: the clock, the last vote, or none for Space', () => {
    const key = 'host';
    const t0 = 1_000_000;
    const step = (st: RoomState, ev: RoomEvent): RoomState => reduce(st, ev, c).state;
    const vote = (id: string, now: number): RoomEvent => ({ type: 'vote', clientId: id, round: 0, option: 'B', now });
    const open = [
      { type: 'join', clientId: 'p1', name: 'Ann', role: 'citizen', table: 'Team 1', now: t0 },
      { type: 'join', clientId: 'p2', name: 'Bo', role: 'government', table: 'Team 2', now: t0 },
      { type: 'cmd', key, cmd: { k: 'start' }, now: t0 },
      { type: 'cmd', key, cmd: { k: 'openVote' }, now: t0 },
    ].reduce((st, ev) => step(st, ev as RoomEvent), initialState('ABCD', key, t0, c));
    const view = (st: RoomState) => hostView(st, st.updatedAt, c);
    const byClock = step(open, { type: 'tick', now: open.voteDeadline! });
    const byLastVote = step(step(open, vote('p1', t0 + 5000)), vote('p2', t0 + 6000));
    const bySpace = step(step(open, vote('p1', t0 + 5000)), { type: 'cmd', key, cmd: { k: 'closeVote' }, now: t0 + 7000 });
    expect([byClock, byLastVote, bySpace].map((st) => st.phase)).toEqual(['locked', 'locked', 'locked']);
    expect(lockNoteFor('vote', view(byClock))).toBe(CLOCK_LOCK_NOTE);
    expect(lockNoteFor('vote', view(byLastVote))).toBe(EVERYONE_LOCK_NOTE);
    expect(lockNoteFor('vote', view(bySpace))).toBeNull();
    expect(lockNoteFor('vote', view(open))).toBeNull();      // still open
    expect(lockNoteFor(null, view(byClock))).toBeNull();     // a reload into a locked vote
  });

  it('puts the called student and their letter on the banner, or a hand call-out when there is no student, and no option text', () => {
    const footer = 'Y: valid point, N: move on';
    expect(bannerFor([called('p1', 'B', 'pending')], players)).toEqual({ name: 'Ann', letter: 'B', footer });
    expect(bannerFor([called('p1', 'B', 'declined'), called(null, null, 'pending')], players)).toEqual({ name: null, letter: null, footer });
    expect(bannerFor([called('gone', 'B', 'pending')], players)).toEqual({ name: null, letter: null, footer });
    expect(bannerFor([called('p1', 'B', 'awarded')], players)).toBeNull();
    expect(bannerFor([], players)).toBeNull();
  });

  it('flashes "Valid point" on Y, with the name when there is one, and nothing on N', () => {
    expect(judgeFlash({ playerId: 'p1', option: 'B', status: 'pending' }, players, true)).toBe('Valid point, Ann!');
    expect(judgeFlash({ playerId: null, option: null, status: 'pending' }, players, true)).toBe('Valid point!');
    expect(judgeFlash({ playerId: 'gone', option: 'A', status: 'pending' }, players, true)).toBe('Valid point!');
    expect(judgeFlash({ playerId: 'p1', option: 'B', status: 'pending' }, players, false)).toBeNull();
    expect(judgeFlash({ playerId: null, option: null, status: 'pending' }, players, false)).toBeNull();
  });

  it('notes each call-out judged a valid point, in order, and nothing for the others', () => {
    const callouts = [
      called('p1', 'B', 'awarded'), called('p2', 'A', 'declined'), called(null, null, 'awarded'), called('gone', 'C', 'awarded'), called('p2', 'C', 'pending'),
    ];
    expect(validNotes(callouts, players)).toEqual(['Valid point: Ann', 'Valid point', 'Valid point']);
    expect(validNotes([], players)).toEqual([]);
  });

  it('tells the facilitator what Space, C, Y and N do now', () => {
    const at = (phase: Phase, callouts: Callout[], round = 1) => optionsFooter(c, { phase, round, callouts: { [round]: callouts } });
    expect(at('vote', [])).toBe('Space locks the vote');
    expect(at('vote', [called(null, null, 'pending')])).toBe('Space locks the vote');
    expect(at('locked', [])).toBe('C calls a student out, Space strikes');
    expect(at('locked', [called('p1', 'B', 'pending')])).toBe('');   // the banner carries Y and N
    expect(at('locked', [called('p1', 'B', 'declined')])).toBe('C calls a student out, Space strikes');
    const four = [called('p1', 'B', 'declined'), called('p2', 'A', 'awarded'), called('p3', 'C', 'declined'), called(null, null, 'awarded')];
    expect(at('locked', four)).toBe('Space strikes');
    expect(at('reveal', [])).toBe('Space: next question');
    expect(at('reveal', [], 3)).toBe('Space: next question');
    expect(at('reveal', [], 4)).toBe('Space: the ending');
    expect(optionsFooter(c, { phase: 'locked', round: 2, callouts: {} })).toBe('C calls a student out, Space strikes');
    for (const phase of ['lobby', 'travel', 'ending'] as const) expect(at(phase, [])).toBe('');
    const k = structuredClone(c);
    k.settings.maxCallouts = 5;
    expect(optionsFooter(k, { phase: 'locked', round: 1, callouts: { 1: four } })).toBe('C calls a student out, Space strikes');
  });

  it('says nothing a person reads about points, scores, damage or the old classes', () => {
    const words = [
      ...[0, 1, 2, 3, 4].flatMap((r) => Object.values(questionFor(c, r))),
      ...(['vote', 'locked', 'reveal'] as const).map((phase) => optionsFooter(c, { phase, round: 0, callouts: {} })),
      JSON.stringify(bannerFor([called('p1', 'B', 'pending')], players)),
      CLOCK_LOCK_NOTE, EVERYONE_LOCK_NOTE,
    ];
    for (const w of words) expect(w).not.toMatch(/points|score|damage|leaderboard|Rogue|Knight|Bard|Wizard/i);
  });
});

describe('Space', () => {
  const press = (over: Partial<SpaceState> = {}) =>
    spaceAction({ phase: 'locked', busy: false, killing: false, lockedUntil: 0, time: 5000, ...over });

  it('sends each phase its command', () => {
    expect(press({ phase: 'travel' })).toEqual({ kind: 'send', cmd: { k: 'openVote' } });
    expect(press({ phase: 'vote' })).toEqual({ kind: 'send', cmd: { k: 'closeVote' } });
    expect(press({ phase: 'locked' })).toEqual({ kind: 'send', cmd: { k: 'reveal' } });
    expect(press({ phase: 'reveal' })).toEqual({ kind: 'send', cmd: { k: 'next' } });
    for (const phase of ['lobby', 'ending'] as const) expect(press({ phase })).toEqual({ kind: 'none' });
  });

  it('skips the kill while it plays, and only then', () => {
    expect(spaceAction({ phase: 'reveal', busy: false, killing: true, lockedUntil: 0, time: 5 })).toEqual({ kind: 'skip' });
    expect(KILL_MS).toBe(2400);
  });

  it('does nothing inside a lockout or while the scene is busy', () => {
    expect(spaceAction({ phase: 'reveal', busy: false, killing: false, lockedUntil: 10, time: 5 })).toEqual({ kind: 'none' });
    expect(press({ phase: 'reveal', killing: true, lockedUntil: 5001 })).toEqual({ kind: 'none' });
    for (const phase of ['travel', 'vote', 'locked', 'reveal'] as const) {
      expect(press({ phase, lockedUntil: 5001 })).toEqual({ kind: 'none' });
      expect(press({ phase, busy: true })).toEqual({ kind: 'none' });
    }
    expect(press({ phase: 'vote', time: 2000, lockedUntil: 2000 })).toEqual({ kind: 'send', cmd: { k: 'closeVote' } });
    expect(SEND_LOCK_MS).toBe(1000);
  });

  // The room locks the vote at 0 s. A Space meant to lock it that lands a moment later used to reveal at once and skip
  // the call-out (seen live with a 429 ms gap), so the Battle rests Space on every view that moves vote to locked.
  it('rests Space a second and a half once a view shows the vote moving to locked', () => {
    expect(AUTO_LOCK_MS).toBe(1500);
    const until = lockoutAfterLock('vote', 'locked', 0, 5000);
    expect(until).toBe(5000 + AUTO_LOCK_MS);
    expect(press({ phase: 'locked', time: 5429, lockedUntil: until })).toEqual({ kind: 'none' });   // the press meant to lock
    expect(press({ phase: 'locked', time: 6499, lockedUntil: until })).toEqual({ kind: 'none' });
    expect(press({ phase: 'locked', time: 6500, lockedUntil: until })).toEqual({ kind: 'send', cmd: { k: 'reveal' } });
  });

  it('rests again when a reopened vote locks a second time', () => {
    const first = lockoutAfterLock('vote', 'locked', 0, 5000);
    const reopened = lockoutAfterLock('locked', 'vote', first, 9000);
    expect(reopened).toBe(first);   // R reopens without a rest of its own
    expect(lockoutAfterLock('vote', 'locked', reopened, 40000)).toBe(40000 + AUTO_LOCK_MS);
  });

  it('does not rest for any other change, nor for a first view that is already locked (a reload)', () => {
    expect(lockoutAfterLock('travel', 'vote', 0, 5000)).toBe(0);
    expect(lockoutAfterLock(null, 'locked', 0, 5000)).toBe(0);
    expect(lockoutAfterLock(null, 'vote', 0, 5000)).toBe(0);
    expect(lockoutAfterLock('vote', 'vote', 0, 5000)).toBe(0);
    expect(lockoutAfterLock('locked', 'locked', 0, 5000)).toBe(0);
    expect(lockoutAfterLock('locked', 'reveal', 0, 5000)).toBe(0);
  });

  it('keeps a longer lockout, so the order of a press and the view it causes does not matter', () => {
    expect(lockoutAfterLock('vote', 'locked', 9000, 5000)).toBe(9000);
    // Space locks the vote itself: its one-second rest becomes a second and a half, whether the view lands inside
    // send() (offline) or after it (online), because the extension never shortens what the press set.
    expect(press({ phase: 'vote', time: 5000 })).toEqual({ kind: 'send', cmd: { k: 'closeVote' } });
    expect(lockoutAfterLock('vote', 'locked', 5000 + SEND_LOCK_MS, 5000)).toBe(6500);
    expect(lockoutAfterLock('vote', 'locked', 5000 + SEND_LOCK_MS, 5080)).toBe(6580);
  });

  it('says the clock locked the vote only when the lock came at or after the deadline', () => {
    const view = (phase: 'vote' | 'locked', updatedAt: number, voteDeadline: number | null = 30000) => ({ phase, updatedAt, voteDeadline });
    expect(lockedByClock('vote', view('locked', 30000))).toBe(true);
    expect(lockedByClock('vote', view('locked', 30420))).toBe(true);    // the room's alarm fired a little late
    expect(lockedByClock('vote', view('locked', 21000))).toBe(false);   // Space locked it with 9 s to go
    expect(lockedByClock(null, view('locked', 30000))).toBe(false);     // a reload into the locked vote
    expect(lockedByClock('locked', view('locked', 31000))).toBe(false); // already locked: a later change, a call-out say
    expect(lockedByClock('vote', view('vote', 30000))).toBe(false);
    expect(lockedByClock('vote', view('locked', 30000, null))).toBe(false);
    expect(CLOCK_LOCK_NOTE).toBe('Locked by the clock. C calls a student out, Space strikes');
  });

  it('tells an early lock from the clock lock and from a Space lock', () => {
    const players = { p1: player('p1', 'Sarah', 'citizen') };
    const voted = (id: string, option: OptionId) => ({ ...players.p1, id, name: id, votes: { 0: { option, at: 1 } } });
    const everyone = { p1: voted('p1', 'B'), p2: voted('p2', 'A') };
    const early = { phase: 'locked' as const, updatedAt: 50_000, voteDeadline: 121_000, players: everyone, round: 0 };
    expect(lockedEarly('vote', early)).toBe(true);
    expect(lockedByClock('vote', early)).toBe(false);
    expect(lockedEarly('vote', { ...early, players: { ...everyone, p3: { ...players.p1, id: 'p3', votes: {} } } })).toBe(false);   // Space, with p3 still to vote
    expect(lockedEarly('vote', { ...early, players: {} })).toBe(false);
    expect(lockedEarly('vote', { ...early, updatedAt: 121_000 })).toBe(false);   // the clock
    expect(lockedEarly('vote', { ...early, round: 1 })).toBe(false);             // their votes are for round 0
    expect(lockedEarly('locked', early)).toBe(false);                             // already locked: a later change
    expect(lockedEarly(null, early)).toBe(false);                                 // a reload into the locked vote
    expect(lockedEarly('vote', { ...early, phase: 'vote' as const })).toBe(false);
    expect(EVERYONE_LOCK_NOTE).toBe('Everyone has voted. C calls a student out, Space strikes');
  });
});

describe('clockCues', () => {
  it('crossing 10 s tightens the music to 1 and ticks; each whole second down to 1 ticks', () => {
    expect(clockCues(10_100, 9_900)).toEqual({ tension: 1, tick: true, tickHigh: false, riser: false });
    for (let s = 9; s >= 4; s -= 1) expect(clockCues(s * 1000 + 100, s * 1000 - 150), `${s} s`).toEqual({ tension: 1, tick: true, tickHigh: false, riser: false });
    expect(clockCues(9_700, 9_450)).toEqual({ tension: 1, tick: false, tickHigh: false, riser: false });   // no second crossed
  });
  it('crossing 3 s tightens to 2, ticks and starts the riser; under 3 s the half seconds tick high', () => {
    expect(clockCues(3_100, 2_900)).toEqual({ tension: 2, tick: true, tickHigh: false, riser: true });
    expect(clockCues(2_600, 2_400)).toEqual({ tension: 2, tick: false, tickHigh: true, riser: false });
    expect(clockCues(2_100, 1_900)).toEqual({ tension: 2, tick: true, tickHigh: false, riser: false });
    expect(clockCues(1_600, 1_400)).toEqual({ tension: 2, tick: false, tickHigh: true, riser: false });
    expect(clockCues(1_100, 900)).toEqual({ tension: 2, tick: true, tickHigh: false, riser: false });
    expect(clockCues(600, 400)).toEqual({ tension: 2, tick: false, tickHigh: true, riser: false });
    expect(clockCues(100, -150)).toEqual({ tension: 2, tick: false, tickHigh: false, riser: false });   // no tick at 0: the lock sounds
    expect(clockCues(3_600, 3_400)).toEqual({ tension: 1, tick: false, tickHigh: false, riser: false });   // no half second above 3 s
  });
  it('the riser comes once, on the crossing, and nothing sounds above 10 s', () => {
    const fromTop = [30_000, 20_000, 12_000, 10_250, 10_000, 9_000, 5_000, 3_250, 3_000, 2_750, 2_000, 1_000, 0];
    let risers = 0;
    for (let i = 1; i < fromTop.length; i += 1) if (clockCues(fromTop[i - 1], fromTop[i]).riser) risers += 1;
    expect(risers).toBe(1);
    expect(clockCues(25_000, 24_750)).toEqual({ tension: 0, tick: false, tickHigh: false, riser: false });
    expect(clockCues(10_500, 10_250)).toEqual({ tension: 0, tick: false, tickHigh: false, riser: false });
    expect(clockCues(Infinity, 29_750)).toEqual({ tension: 0, tick: false, tickHigh: false, riser: false });   // the first sample of a vote
  });
  it('a clock that jumps several seconds at once (a hidden tab) gives one tick and one high tick, not a backlog', () => {
    expect(clockCues(9_500, 4_200)).toEqual({ tension: 1, tick: true, tickHigh: false, riser: false });
    expect(clockCues(12_000, 1_200)).toEqual({ tension: 2, tick: true, tickHigh: true, riser: true });
  });
});

describe('phaseCues', () => {
  it('a vote that opens while the scene watches gets the fanfare and the theme; a reload mid-vote only the theme', () => {
    expect(phaseCues('travel', 'vote', true)).toEqual({ sfx: 'voteOpen', music: 'vote', clock: true });
    expect(phaseCues('locked', 'vote', true)).toEqual({ sfx: 'voteOpen', music: 'vote', clock: true });   // reopened from locked
    expect(phaseCues(null, 'vote', true)).toEqual({ sfx: null, music: 'vote', clock: true });   // the vote opened before the reload
  });
  it('a reopen inside an open vote restarts the clock only; the same deadline changes nothing', () => {
    expect(phaseCues('vote', 'vote', true)).toEqual({ sfx: null, music: null, clock: true });
    expect(phaseCues('vote', 'vote', false)).toEqual({ sfx: null, music: null, clock: false });
  });
  it('the lock thuds only from an open vote; travel and locked set their theme once', () => {
    expect(phaseCues('vote', 'locked', false)).toEqual({ sfx: 'lock', music: 'locked', clock: false });
    expect(phaseCues(null, 'locked', false)).toEqual({ sfx: null, music: 'locked', clock: false });
    expect(phaseCues('locked', 'locked', false)).toEqual({ sfx: null, music: null, clock: false });
    expect(phaseCues(null, 'travel', false)).toEqual({ sfx: null, music: 'narration', clock: false });
    expect(phaseCues('travel', 'travel', false)).toEqual({ sfx: null, music: null, clock: false });
    expect(phaseCues('locked', 'reveal', false)).toEqual({ sfx: null, music: null, clock: false });
  });
});
