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
  alignmentText, bannerFor, debriefFor, judgedNotes, judgeFlash, narrationFor, strikePlan, timerText, votedText,
  type Strike, type StrikePlan,
} from '../host/strikers';

const T = (A: number, B: number, C: number, D: number): Tally => ({ A, B, C, D });
const Z = T(0, 0, 0, 0);
const damage = (round: number, lead: Tally, support: Tally, extra: { exhibits?: number; rallies?: number } = {}, content = c): DamageResult =>
  computeDamage({ content, roundIndex: round, lead, support, prior: [], exhibits: extra.exhibits ?? 0, rallies: extra.rallies ?? 0 });
const player = (id: string, name: string, role: Role): Player => ({ id, name, role, table: null, joinedAt: 0, score: 0, lastPoints: 0, votes: {} });
const called = (playerId: string | null, option: OptionId | null, status: Callout['status']): Callout =>
  ({ playerId, option, status, points: status === 'awarded' ? 30 : status === 'declined' ? 10 : 0 });
const strikes = (plan: StrikePlan): Strike[] => plan.flatMap((step) => (step.kind === 'skip' ? [] : [step]));
const shown = (plan: StrikePlan): number => strikes(plan).reduce((sum, s) => sum + s.amount, 0);
const preCap = (d: DamageResult): number => d.base + d.focus + d.alignment + d.exhibit + d.rally;
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

  it('labels the rally of a student no longer in the room "Rally +10", performed by the lead class', () => {
    const d = damage(0, T(0, 1, 0, 0), T(0, 3, 0, 0), { rallies: 1 });
    const plan = strikePlan(d, c, 0, [called('gone', 'B', 'awarded')], {});
    expect(shown(plan)).toBeCloseTo(preCap(d), 9);
    expect(strikes(plan).at(-1)).toMatchObject({ kind: 'rally', label: 'Rally +10', by: ['citizen'], colour: 'B' });
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
  it('counts the votes against the room online, and the votes alone offline', () => {
    expect(votedText(T(1, 2, 0, 0), 5, false)).toBe('3 of 5 voted');
    expect(votedText(T(2, 10, 0, 0), 0, true)).toBe('12 voted');
    expect(votedText(Z, 0, false)).toBe('0 of 0 voted');
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

  it('narrates each round, with Ruto before the first and Tanui before the second', () => {
    expect(narrationFor(c, 0)).toEqual({
      boss: 'Grid Wyrm', title: c.rounds[0].title, narration: c.rounds[0].narration,
      quote: `“${c.quotes.ruto}” President William Ruto (Semafor, 2026)`, footer: 'Space opens the vote',
    });
    expect(narrationFor(c, 1).quote).toBe(`“${c.quotes.tanui}” PS John Tanui (James, 2026; Vimal, 2026)`);
    expect(narrationFor(c, 2).quote).toBeUndefined();
    expect(narrationFor(c, 3)).toMatchObject({ boss: 'The core', title: c.rounds[3].title, footer: 'Space opens the vote' });
    expect(narrationFor(c, 3).quote).toBeUndefined();
  });
});
