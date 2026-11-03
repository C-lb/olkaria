import { it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { classFor, labelFor } from '../host/strikers';
const c = loadContent(raw);
it('names the lead class and the three support classes of a round', () => {
  expect(classFor(c, 0)).toEqual({ lead: 'citizen', support: ['government', 'business', 'microsoft'] });
  expect(classFor(c, 2)).toEqual({ lead: 'business', support: ['citizen', 'government', 'microsoft'] });
  expect(labelFor(c, 'citizen', true)).toBe('Rogues'); expect(labelFor(c, 'business')).toBe('Bard');
});

// ---- Beyond the brief: the test above is its code unchanged ----------------------------------------------
import { describe } from 'vitest';
import { computeDamage } from '../shared/scoring';
import type { Callout, DamageResult, OptionId, Player, Role, Tally } from '../shared/types';
import {
  alignmentText, AUTO_LOCK_MS, bannerFor, BEAT_MS, beatsFor, CLOCK_LOCK_NOTE, debriefFor, DRAIN_MS, FRAME_MS, judgedNotes, judgeFlash,
  lockedByClock, lockoutAfterLock, lungeReach, narrationFor, optionsFooter, REVEAL_MS, SEND_LOCK_MS, spaceAction, strikePlan, timerText,
  votedText,
  type SpaceState, type Strike, type StrikePlan,
} from '../host/strikers';
import { SPEAKERS } from '../host/quotes';

const T = (A: number, B: number, C: number, D: number): Tally => ({ A, B, C, D });
const Z = T(0, 0, 0, 0);
const damage = (round: number, lead: Tally, support: Tally, extra: { exhibits?: number; rallies?: number } = {}, content = c): DamageResult =>
  computeDamage({ content, roundIndex: round, lead, support, prior: [], exhibits: extra.exhibits ?? 0, rallies: extra.rallies ?? 0 });
const player = (id: string, name: string, role: Role): Player => ({ id, name, role, table: null, joinedAt: 0, score: 0, lastPoints: 0, votes: {} });
const called = (playerId: string | null, option: OptionId | null, status: Callout['status']): Callout =>
  ({ playerId, option, status, points: status === 'awarded' ? 30 : status === 'declined' ? 10 : 0 });
const strikes = (plan: StrikePlan): Strike[] => plan.flatMap((step) => (step.kind === 'skip' ? [] : [step]));
const shown = (plan: StrikePlan): number => strikes(plan).reduce((sum, s) => sum + s.amount, 0);
/** What the canvas prints, added up: "36.7" and "+15" read as numbers. */
const printed = (plan: StrikePlan): number => strikes(plan).reduce((sum, s) => sum + Number(s.figure), 0);
const preCap = (d: DamageResult): number => d.base + d.focus + d.alignment + d.exhibit + d.rally;
/** The base as the debrief's breakdown prints it, to a tenth. */
const printedBase = (d: DamageResult): number => Math.round(d.base * 10) / 10;
const PARTY: Role[] = ['citizen', 'government', 'business', 'microsoft'];

describe('strikePlan: what the special attack shows adds up to what it drains', () => {
  it('splits the base between the Rogues and the party when both voted, then one flourish per bonus', () => {
    // Spec 4.4's worked example: Rogues A 1, B 6, C 1, D 2; the rest A 6, B 15, C 3, D 6; two exhibits. Damage 83.
    const d = damage(0, T(1, 6, 1, 2), T(6, 15, 3, 6), { exhibits: 2 });
    const plan = strikePlan(d, c, 0, [], {});
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(d.total).toBe(83);
    expect(plan.map((s) => s.kind)).toEqual(['lead', 'support', 'alignment', 'exhibit', 'exhibit']);
    const [lead, support] = strikes(plan);
    expect(lead.amount).toBeCloseTo(32.25, 9);   // half of the Rogues' 0.1 x 40 + 0.6 x 80 + 0.1 x 15 + 0.2 x 55
    expect(support.amount).toBeCloseTo(30.25, 9);
    expect(lead).toMatchObject({ figure: '32.3', label: null, by: ['citizen'], colour: 'B' });
    expect(support).toMatchObject({ figure: '30.2', label: null, by: ['government', 'business', 'microsoft'], colour: 'B' });
    expect(strikes(plan).slice(2).map((s) => [s.label, s.figure, s.colour])).toEqual([
      ['Party stands together +10', '+10', null], ['Exhibit +5', '+5', null], ['Exhibit +5', '+5', null],
    ]);
    expect(strikes(plan)[2].by).toEqual(PARTY);
  });

  it('gives the Rogues all of the base when the rest of the party cast no votes, and says why the party does not strike', () => {
    const d = damage(0, T(0, 4, 0, 0), Z);
    const plan = strikePlan(d, c, 0, [], {});
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(plan).toEqual([
      { kind: 'lead', amount: 80, figure: '80.0', label: null, by: ['citizen'], colour: 'B' },
      { kind: 'skip', toast: 'The party left it to the Rogues' },
      { kind: 'focus', amount: 15, figure: '+15', label: 'Focus +15', by: PARTY, colour: null },
    ]);
  });

  it('gives the party all of the base when no Rogues voted, as in the offline rehearsal, with a hand call-out rally', () => {
    // Offline: 2 ten times and 1 twice, then C and Y. Base 73.3, Focus +15, Rally +10, total 98.
    const d = damage(0, Z, T(2, 10, 0, 0), { rallies: 1 });
    const plan = strikePlan(d, c, 0, [called(null, null, 'awarded')], {});
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(d.total).toBe(98);
    expect(plan.map((s) => (s.kind === 'skip' ? s.toast : `${s.kind} ${s.figure}`))).toEqual([
      'No Rogues voted this round', 'support 73.3', 'focus +15', 'rally +10',
    ]);
    expect(strikes(plan)[0]).toMatchObject({ by: ['government', 'business', 'microsoft'], colour: 'B' });
    expect(strikes(plan)[2]).toMatchObject({ label: 'Hand call-out +10', by: ['citizen'], colour: null });
  });

  it('strikes once per convincing call-out: the student by their own class, a hand call-out by the lead class', () => {
    // Round 2, the Knights lead. Sarah (a Bard) convinced, Ann did not, then a hand call-out convinced.
    const d = damage(1, T(0, 1, 3, 0), T(1, 2, 6, 3), { rallies: 2 });
    const players = { p1: player('p1', 'Sarah', 'business'), p2: player('p2', 'Ann', 'government') };
    const callouts = [called('p1', 'C', 'awarded'), called('p2', 'A', 'declined'), called(null, null, 'awarded')];
    const plan = strikePlan(d, c, 1, callouts, players);
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(d.rally).toBe(20);
    const rallies = strikes(plan).filter((s) => s.kind === 'rally');
    expect(rallies.map((s) => [s.label, s.by, s.colour, s.amount])).toEqual([
      ['Sarah +10', ['business'], 'C', 10],
      ['Hand call-out +10', ['government'], null, 10],
    ]);
    expect(strikes(plan)[0].by).toEqual(['government']);
  });

  it('labels the rally of a student no longer in the room "Removed student +10", struck by the lead class, as the list and the debrief name them', () => {
    const d = damage(0, T(0, 1, 0, 0), T(0, 3, 0, 0), { rallies: 1 });
    const callouts = [called('gone', 'B', 'awarded')];
    const plan = strikePlan(d, c, 0, callouts, {});
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(strikes(plan).at(-1)).toMatchObject({ kind: 'rally', label: 'Removed student +10', by: ['citizen'], colour: 'B' });
    expect(debriefFor(d, c, 0, callouts, {}).rally).toBe('Rally: Removed student +10');
    expect(judgedNotes(c, callouts, {})).toEqual(['Removed student: +10 rally']);
  });

  it('prints figures that add up to the base as the debrief prints it, plus every bonus', () => {
    const players = { p1: player('p1', 'Sarah', 'business') };
    const rounds: [DamageResult, Callout[]][] = [
      [damage(0, T(1, 6, 1, 2), T(6, 15, 3, 6), { exhibits: 2 }), []],                                       // both groups
      [damage(0, T(0, 4, 0, 0), Z), []],                                                                       // the lead class alone
      [damage(0, Z, T(2, 10, 0, 0), { rallies: 1 }), [called(null, null, 'awarded')]],                         // the party alone
      [damage(1, T(0, 1, 3, 0), T(1, 2, 6, 3), { rallies: 2 }), [called('p1', 'C', 'awarded'), called(null, null, 'awarded')]],
      [damage(0, T(1, 5, 0, 0), T(2, 10, 0, 0)), []],                                                          // halves of 36.67
      [damage(2, T(1, 1, 1, 0), T(0, 2, 1, 4), { exhibits: 3 }), []],
    ];
    for (const [d, callouts] of rounds) {
      const plan = strikePlan(d, c, d.round, callouts, players);
      expect(printed(plan)).toBeCloseTo(printedBase(d) + d.focus + d.alignment + d.exhibit + d.rally, 9);
    }
  });

  it('rounds the two halves so their figures add up to the base as the debrief prints it', () => {
    // Both halves are 36.67: printed one by one they would read 36.7 and 36.7, a tenth over the base of 73.3.
    const d = damage(0, T(1, 5, 0, 0), T(2, 10, 0, 0));
    const [lead, support] = strikes(strikePlan(d, c, 0, [], {}));
    expect(lead.amount + support.amount).toBeCloseTo(d.base, 9);
    expect([lead.figure, support.figure]).toEqual(['36.7', '36.6']);
    expect(Number(lead.figure) + Number(support.figure)).toBeCloseTo(73.3, 9);
  });

  it('says so when nobody voted, and still strikes for the exhibits', () => {
    const d = damage(2, Z, Z, { exhibits: 1 });
    const plan = strikePlan(d, c, 2, [], {});
    expect(plan).toEqual([
      { kind: 'skip', toast: 'No one voted this round' },
      { kind: 'exhibit', amount: 5, figure: '+5', label: 'Exhibit +5', by: ['business', 'citizen', 'government', 'microsoft'], colour: null },
    ]);
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
  });

  it('takes every bonus from the content, never a number of its own', () => {
    const k = structuredClone(c);
    Object.assign(k.scoring, { focusBonus: 20, alignmentBonus: 12, exhibitBonus: 7, calloutBonus: 11 });
    const d = damage(0, T(0, 4, 0, 0), T(0, 8, 0, 0), { exhibits: 2, rallies: 1 }, k);
    const plan = strikePlan(d, k, 0, [called('p1', 'B', 'awarded')], { p1: player('p1', 'Cy', 'citizen') });
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(strikes(plan).slice(2).map((s) => s.label)).toEqual(['Focus +20', 'Party stands together +12', 'Exhibit +7', 'Exhibit +7', 'Cy +11']);
  });
});

describe('the debrief', () => {
  it('reads the alignment in one of four forms, with the round lead class named', () => {
    expect(alignmentText(damage(0, T(1, 6, 1, 2), T(6, 15, 3, 6)), c, 0)).toBe('The party stood with the Rogues: both chose B');
    // The online check: a Rogue voting B and a Knight voting A.
    expect(alignmentText(damage(0, T(0, 1, 0, 0), T(1, 0, 0, 0)), c, 0)).toBe('Split: Rogues chose B, the party chose A');
    expect(alignmentText(damage(0, T(1, 1, 0, 0), T(0, 3, 0, 0)), c, 0)).toBe('The Rogues were split');
    expect(alignmentText(damage(0, T(0, 2, 0, 0), T(1, 1, 0, 0)), c, 0)).toBe('The party was split');
    expect(alignmentText(damage(0, T(1, 1, 0, 0), T(0, 0, 2, 2)), c, 0)).toBe('The Rogues were split. The party was split');
    expect(alignmentText(damage(0, Z, T(2, 10, 0, 0)), c, 0)).toBe('No Rogues voted this round');
    expect(alignmentText(damage(1, Z, T(1, 1, 0, 0)), c, 1)).toBe('No Knights voted this round');
    expect(alignmentText(damage(0, Z, Z), c, 0)).toBe('No Rogues voted this round');
  });

  it('says the Rogues struck alone when the rest of the party cast no votes', () => {
    expect(alignmentText(damage(0, T(0, 4, 0, 0), Z), c, 0)).toBe('The party left it to the Rogues');
  });

  it('lists every option with its damage and projector line, the breakdown with the cap, the rally and the discuss line', () => {
    const d = damage(0, Z, T(2, 10, 0, 0), { rallies: 1 });
    const debrief = debriefFor(d, c, 0, [called(null, null, 'awarded')], {});
    expect(debrief.lines.map((l) => l.letter)).toEqual(['A', 'B', 'C', 'D']);
    expect(debrief.lines.map((l) => l.text)).toEqual(c.rounds[0].options.map((o) => o.projector));
    expect(debrief.lines[0].damage).toBeCloseTo(40 / 6, 9);
    expect(debrief.lines[1].damage).toBeCloseTo(400 / 6, 9);
    expect(debrief.breakdown).toEqual({ base: d.base, focus: 15, alignment: 0, exhibit: 0, rally: 10, total: 98, capped: false, cap: 100 });
    expect(debrief.alignment).toBe('No Rogues voted this round');
    expect(debrief.rally).toBe('Rally: Hand call-out +10');
    expect(debrief.discuss).toBe(c.rounds[0].discuss);
  });

  it('names the cap from the content when the strike passed it, and has no rally line without a rally', () => {
    const d = damage(0, T(0, 4, 0, 0), T(0, 8, 0, 0), { exhibits: 3 });
    expect(preCap(d)).toBe(120);
    const debrief = debriefFor(d, c, 0, [called('p1', 'B', 'declined')], { p1: player('p1', 'Cy', 'citizen') });
    expect(debrief.breakdown).toMatchObject({ total: 100, capped: true, cap: c.scoring.roundHp });
    expect(debrief.rally).toBeNull();
    const k = structuredClone(c);
    k.scoring.roundHp = 130;
    expect(debriefFor(damage(0, T(0, 4, 0, 0), T(0, 8, 0, 0), { exhibits: 3 }, k), k, 0, [], {}).breakdown).toMatchObject({ total: 120, capped: false, cap: 130 });
  });

  it('does not call a sum of exactly the cap capped when the shares land a hair over it', () => {
    // 65 + 15 + 10 + 10 on paper; the party's thirteenths add up to 100.00000000000001.
    const d = damage(0, T(0, 1, 0, 0), T(1, 6, 5, 1), { rallies: 1 });
    expect(preCap(d)).toBeGreaterThan(100);
    expect(preCap(d)).toBeCloseTo(100, 9);
    expect(debriefFor(d, c, 0, [called(null, null, 'awarded')], {}).breakdown).toMatchObject({ total: 100, capped: false });
  });

  it('names each student whose call-out struck in the rally line', () => {
    const d = damage(1, T(0, 1, 3, 0), T(1, 2, 6, 3), { rallies: 2 });
    const players = { p1: player('p1', 'Sarah', 'business') };
    expect(debriefFor(d, c, 1, [called('p1', 'C', 'awarded'), called(null, null, 'awarded')], players).rally).toBe('Rally: Sarah +10, Hand call-out +10');
  });
});

describe('the words around the vote', () => {
  it('counts the votes against the room online, each bot vote counted as a voter, and the votes alone offline', () => {
    expect(votedText(T(1, 2, 0, 0), 5, undefined, false)).toBe('3 of 5 voted');
    // Two phones voted, one did not, and three bot votes came in: 5 of the 6 who could vote.
    expect(votedText(T(1, 4, 0, 0), 3, T(0, 3, 0, 0), false)).toBe('5 of 6 voted');
    expect(votedText(T(2, 10, 0, 0), 0, T(2, 10, 0, 0), true)).toBe('12 voted');
    expect(votedText(Z, 0, undefined, false)).toBe('0 of 0 voted');
  });

  it('counts the clock down in whole seconds, rounding up, never below zero', () => {
    expect(timerText(31_000, 1_000)).toBe('30 s');
    expect(timerText(31_000, 1_001)).toBe('30 s');
    expect(timerText(31_000, 30_001)).toBe('1 s');
    expect(timerText(31_000, 31_000)).toBe('0 s');
    expect(timerText(31_000, 45_000)).toBe('0 s');
    expect(timerText(null, 0)).toBe('');
  });

  it('puts the called student and their choice on the banner, or a hand call-out when there is no student', () => {
    const players = { p1: player('p1', 'Sarah', 'citizen') };
    expect(bannerFor(c, 0, [called('p1', 'B', 'pending')], players)).toEqual({ name: 'Sarah', letter: 'B', phone: 'Yes to 60 to 100 MW, tied', footer: 'Y convincing, N not' });
    expect(bannerFor(c, 0, [called('p1', 'B', 'declined'), called(null, null, 'pending')], players)).toEqual({ name: null, letter: null, phone: null, footer: 'Y convincing, N not' });
    expect(bannerFor(c, 0, [called('gone', 'B', 'pending')], players)).toMatchObject({ name: null });
    expect(bannerFor(c, 0, [called('p1', 'B', 'awarded')], players)).toBeNull();
    expect(bannerFor(c, 0, [], players)).toBeNull();
  });

  it('notes each judged call-out for the list under the cards, and flashes the judgement', () => {
    const players = { p1: player('p1', 'Sarah', 'citizen') };
    const callouts = [called('p1', 'B', 'awarded'), called(null, null, 'declined'), called('gone', 'A', 'awarded'), called('p1', 'B', 'pending')];
    expect(judgedNotes(c, callouts, players)).toEqual(['Sarah: +10 rally', 'Hand call-out: no bonus', 'Removed student: +10 rally']);
    expect(judgeFlash(c, true)).toBe('+10 rally');
    expect(judgeFlash(c, false)).toBe('no bonus');
    const k = structuredClone(c);
    k.scoring.calloutBonus = 12;
    expect(judgedNotes(k, callouts.slice(0, 1), players)).toEqual(['Sarah: +12 rally']);
    expect(judgeFlash(k, true)).toBe('+12 rally');
  });

  it('narrates each round, with Ruto before the first and Tanui before the second, attributed from host/quotes.ts', () => {
    expect(narrationFor(c, 0)).toEqual({
      boss: 'Grid Wyrm', title: c.rounds[0].title, narration: c.rounds[0].narration,
      quote: `“${c.quotes.ruto}” President William Ruto (Semafor, 2026)`, footer: 'Space opens the vote',
    });
    expect(narrationFor(c, 1).quote).toBe(`“${c.quotes.tanui}” PS John Tanui (James, 2026; Vimal, 2026)`);
    expect(narrationFor(c, 0).quote).toBe(`“${c.quotes.ruto}” ${SPEAKERS.ruto}`);
    expect(narrationFor(c, 1).quote).toBe(`“${c.quotes.tanui}” ${SPEAKERS.tanui}`);
    expect(narrationFor(c, 2).quote).toBeUndefined();
    expect(narrationFor(c, 3)).toMatchObject({ boss: 'The core', title: c.rounds[3].title, footer: 'Space opens the vote' });
    expect(narrationFor(c, 3).quote).toBeUndefined();
  });

  it('tells the facilitator what C, Y, N and Space do now', () => {
    const strikes = 'C calls a student out. Space: the party strikes';
    expect(optionsFooter(c, 'vote', [])).toBe('Space locks the vote');
    expect(optionsFooter(c, 'vote', [called(null, null, 'pending')])).toBe('Space locks the vote');   // Y and N judge only once it is locked
    expect(optionsFooter(c, 'locked', [])).toBe(strikes);
    expect(optionsFooter(c, 'locked', [called('p1', 'B', 'pending')])).toBe('Y convincing, N not');
    expect(optionsFooter(c, 'locked', [called('p1', 'B', 'declined')])).toBe(strikes);
    expect(optionsFooter(c, 'locked', [called('p1', 'B', 'declined'), called(null, null, 'pending')])).toBe('Y convincing, N not');
    const four = [called('p1', 'B', 'declined'), called('p2', 'A', 'awarded'), called('p3', 'C', 'declined'), called(null, null, 'awarded')];
    expect(optionsFooter(c, 'locked', four)).toBe('Space: the party strikes');
    expect(optionsFooter(c, 'reveal', [])).toBe('');
    const k = structuredClone(c);
    k.scoring.maxCallouts = 5;
    expect(optionsFooter(k, 'locked', four)).toBe(strikes);
  });
});

describe('the reveal takes 6 s at most', () => {
  it('fits the heaviest plan, the drain with its shake, and a frame per beat into 6 s', () => {
    const d = damage(0, T(0, 4, 0, 0), T(0, 8, 0, 0), { exhibits: c.scoring.maxExhibits, rallies: c.scoring.maxCallouts });
    const plan = strikePlan(d, c, 0, Array.from({ length: c.scoring.maxCallouts }, () => called(null, null, 'awarded')), {});
    expect(plan.map((s) => s.kind)).toEqual(['lead', 'support', 'focus', 'alignment', 'exhibit', 'exhibit', 'exhibit', 'rally', 'rally', 'rally', 'rally']);
    const beats = beatsFor(plan);
    expect(beats).toHaveLength(plan.length);
    expect(beats.reduce((sum, ms) => sum + ms, 0) + DRAIN_MS + FRAME_MS * (beats.length + 1)).toBeLessThanOrEqual(REVEAL_MS);
    expect([REVEAL_MS, DRAIN_MS]).toEqual([6000, 1500]);
  });

  it('keeps a common plan at its natural pace', () => {
    const plan = strikePlan(damage(0, Z, T(2, 10, 0, 0), { rallies: 1 }), c, 0, [called(null, null, 'awarded')], {});
    expect(beatsFor(plan)).toEqual(plan.map((s) => BEAT_MS[s.kind]));
  });
});

describe('Space', () => {
  const press = (over: Partial<SpaceState> = {}) =>
    spaceAction({ phase: 'locked', busy: false, onDebrief: false, lockedUntil: 0, time: 5000, ...over });

  it('sends each phase its command, then rests a second', () => {
    expect(press({ phase: 'travel' })).toEqual({ kind: 'send', cmd: { k: 'openVote' }, lockedUntil: 6000 });
    expect(press({ phase: 'vote' })).toEqual({ kind: 'send', cmd: { k: 'closeVote' }, lockedUntil: 6000 });
    expect(press({ phase: 'locked' })).toEqual({ kind: 'send', cmd: { k: 'reveal' }, lockedUntil: 6000 });
    for (const phase of ['lobby', 'reveal', 'ending', 'leaderboard'] as const) expect(press({ phase })).toEqual({ kind: 'ignore' });
  });

  it('ignores every Space inside a lockout, during the strike and on the debrief too', () => {
    const states: Partial<SpaceState>[] = [{}, { phase: 'travel' }, { phase: 'reveal', busy: true }, { phase: 'reveal', onDebrief: true }];
    for (const s of states) expect(press({ ...s, lockedUntil: 5001 })).toEqual({ kind: 'ignore' });
  });

  it('ignores a second Space inside a second of a send', () => {
    expect(press({ phase: 'vote', time: 1000 })).toEqual({ kind: 'send', cmd: { k: 'closeVote' }, lockedUntil: 2000 });
    expect(press({ phase: 'vote', time: 1999, lockedUntil: 2000 })).toEqual({ kind: 'ignore' });
    expect(press({ phase: 'reveal', onDebrief: true, time: 1500, lockedUntil: 2000 })).toEqual({ kind: 'ignore' });   // no second next
    expect(press({ phase: 'vote', time: 2000, lockedUntil: 2000 })).toMatchObject({ kind: 'send' });
  });

  it('skips the strike while it plays, then rests 600 ms before next', () => {
    expect(press({ phase: 'reveal', busy: true, time: 3000, lockedUntil: 2000 })).toEqual({ kind: 'skip', lockedUntil: 3600 });
    expect(press({ phase: 'reveal', onDebrief: true, time: 3599, lockedUntil: 3600 })).toEqual({ kind: 'ignore' });
    expect(press({ phase: 'reveal', onDebrief: true, time: 3600, lockedUntil: 3600 })).toEqual({ kind: 'send', cmd: { k: 'next' }, lockedUntil: 4600 });
  });

  it('sends next only from the debrief', () => {
    expect(press({ phase: 'reveal' })).toEqual({ kind: 'ignore' });
    expect(press({ phase: 'reveal', onDebrief: true })).toEqual({ kind: 'send', cmd: { k: 'next' }, lockedUntil: 6000 });
  });

  // The room locks the vote at 0 s. A Space meant to lock it that lands a moment later used to reveal at once and skip
  // the call-out (seen live with a 429 ms gap), so the Battle rests Space on every view that moves vote to locked.
  it('rests Space a second and a half once a view shows the vote moving to locked', () => {
    expect(AUTO_LOCK_MS).toBe(1500);
    const until = lockoutAfterLock('vote', 'locked', 0, 5000);
    expect(until).toBe(5000 + AUTO_LOCK_MS);
    expect(press({ phase: 'locked', time: 5429, lockedUntil: until })).toEqual({ kind: 'ignore' });   // the press meant to lock
    expect(press({ phase: 'locked', time: 6499, lockedUntil: until })).toEqual({ kind: 'ignore' });
    expect(press({ phase: 'locked', time: 6500, lockedUntil: until })).toEqual({ kind: 'send', cmd: { k: 'reveal' }, lockedUntil: 7500 });
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
    const sent = press({ phase: 'vote', time: 5000 });
    expect(sent).toEqual({ kind: 'send', cmd: { k: 'closeVote' }, lockedUntil: 5000 + SEND_LOCK_MS });
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
});

describe('lunges', () => {
  // Round 1's line-up: the three support classes at 30, 52 and 74, the Rogue in front at 104, all 12 px wide.
  const stands = [
    { role: 'government', x: 30, w: 12 }, { role: 'business', x: 52, w: 12 }, { role: 'microsoft', x: 74, w: 12 }, { role: 'citizen', x: 104, w: 12 },
  ] as const;

  it('stop 2 px short of the sprite standing in front, so no sprite covers another', () => {
    expect(lungeReach(stands, ['government', 'business', 'microsoft'], 20, 2)).toBe(16);   // the Wizard stops 2 px short of the Rogue
    expect(lungeReach(stands, ['microsoft'], 28, 2)).toBe(16);
    expect(lungeReach(stands, ['business'], 28, 2)).toBe(8);
    expect(lungeReach(stands, ['business'], 4, 2)).toBe(4);
    expect(lungeReach(stands, ['citizen'], 28, 2)).toBe(28);                               // nobody stands in front of the lead
  });
});
