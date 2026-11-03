// tests/scoring.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { shares, blendShares, majorityOf, synergyHits, effectiveScores, computeDamage, speedBonus, pointsFor, endingFor, consistencyAward, tableAward } from '../shared/scoring';
import type { Player, Role } from '../shared/types';
const c = loadContent(raw);
const T = (A: number, B: number, C: number, D: number) => ({ A, B, C, D });
const Z = T(0, 0, 0, 0);

describe('shares', () => {
  it('splits by total and handles zero', () => {
    expect(shares(T(4, 24, 4, 8))).toEqual({ A: 0.1, B: 0.6, C: 0.1, D: 0.2 });
    expect(shares(Z)).toEqual(Z);
  });
  it('blends lead and support half and half, falling back to whichever voted', () => {
    expect(blendShares(T(0, 1, 0, 0), T(1, 1, 0, 0))).toEqual({ A: 0.25, B: 0.75, C: 0, D: 0 });
    expect(blendShares(Z, T(0, 10, 0, 0))).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(blendShares(T(0, 10, 0, 0), Z)).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(blendShares(Z, Z)).toEqual(Z);
  });
  it('picks the top option, earliest letter on tie', () => {
    expect(majorityOf(shares(T(4, 24, 4, 8)))).toEqual({ majority: 'B', tied: false });
    expect(majorityOf(shares(T(5, 5, 1, 0)))).toEqual({ majority: 'A', tied: true });
    expect(majorityOf(Z)).toEqual({ majority: 'A', tied: true });
  });
});

describe('synergy and effective scores', () => {
  it('counts coherent earlier majorities', () => {
    expect(synergyHits('B', ['B', 'C', 'B'], c.synergy)).toBe(3);
    expect(synergyHits('A', ['B', 'C', 'B'], c.synergy)).toBe(0);
    expect(synergyHits('D', ['B', 'C', 'B'], c.synergy)).toBe(3);
    expect(synergyHits('A', ['A', 'C', 'A'], c.synergy)).toBe(1);
    expect(synergyHits('B', [null, null, null], c.synergy)).toBe(0);
  });
  it('uses evidence scores for rounds 1 to 3 and 50 + 15 per hit for round 4', () => {
    expect(effectiveScores(c, 0, [])).toEqual(T(40, 80, 15, 55));
    expect(effectiveScores(c, 3, ['B', 'C', 'B'])).toEqual(T(50, 95, 50, 95));
  });
});

describe('computeDamage', () => {
  const dmg = (over: Partial<Parameters<typeof computeDamage>[0]>) =>
    computeDamage({ content: c, roundIndex: 0, lead: T(1, 6, 1, 2), support: T(6, 15, 3, 6), prior: [], exhibits: 0, rallies: 0, ...over });
  it('matches the spec worked example for round 1', () => {
    const d = dmg({ exhibits: 2 });
    for (const [o, v] of Object.entries({ A: 0.15, B: 0.55, C: 0.1, D: 0.2 })) expect(d.shares[o as 'A']).toBeCloseTo(v, 10);
    expect(d.base).toBeCloseTo(62.5, 5);
    expect(d.focus).toBe(0); expect(d.alignment).toBe(10); expect(d.exhibit).toBe(10); expect(d.rally).toBe(0);
    expect(d.total).toBe(83);
    expect(d.majority).toBe('B'); expect(d.leadMajority).toBe('B'); expect(d.supportMajority).toBe('B');
    expect(d.leadTied).toBe(false); expect(d.supportTied).toBe(false);
  });
  it('gives focus when the blended top share reaches 60%', () => {
    const d = dmg({ lead: T(0, 10, 0, 0), support: T(10, 20, 0, 0) });
    expect(d.base).toBeCloseTo(73.333, 2); expect(d.focus).toBe(15); expect(d.alignment).toBe(10); expect(d.total).toBe(98);
  });
  it('gives an even split 48 with no focus and no alignment', () => {
    const d = dmg({ lead: T(1, 1, 1, 1), support: T(1, 1, 1, 1) });
    expect(d.total).toBe(48); expect(d.focus).toBe(0); expect(d.alignment).toBe(0); expect(d.tied).toBe(true);
    expect(d.leadTied).toBe(true); expect(d.supportTied).toBe(true);
  });
  it('withholds alignment when one group is tied even if the resolved letters match', () => {
    const d = dmg({ lead: T(0, 5, 0, 0), support: T(0, 3, 3, 0) });
    expect(d.leadMajority).toBe('B'); expect(d.supportMajority).toBe('B'); expect(d.supportTied).toBe(true); expect(d.alignment).toBe(0);
  });
  it('falls back to the support votes when no one of the lead class voted', () => {
    const d = dmg({ lead: Z, support: T(0, 10, 0, 0) });
    expect(d.total).toBe(95); expect(d.alignment).toBe(0); expect(d.leadMajority).toBeNull(); expect(d.leadTied).toBe(false);
  });
  it('matches the spec worked example for round 4', () => {
    const d = dmg({ roundIndex: 3, lead: T(2, 4, 1, 1), support: T(8, 16, 4, 4), prior: ['B', 'C', 'B'] });
    expect(d.base).toBeCloseTo(78.125, 5); expect(d.alignment).toBe(10); expect(d.total).toBe(88);
  });
  it('caps exhibits at 3, rallies at 2, and total at 100', () => {
    const d = dmg({ lead: T(0, 10, 0, 0), support: T(0, 10, 0, 0), exhibits: 7, rallies: 5 });
    expect(d.exhibit).toBe(15); expect(d.rally).toBe(20); expect(d.total).toBe(100);
  });
  it('handles an empty round without NaN', () => {
    const d = dmg({ roundIndex: 1, lead: Z, support: Z, prior: ['B'] });
    expect(d.total).toBe(0); expect(d.majority).toBe('A'); expect(d.tied).toBe(true);
    expect(Object.values(d.perOption).every(Number.isFinite)).toBe(true);
  });
  it('withholds alignment when the lead class is the tied group, even if the resolved letters match', () => {
    const d = dmg({ lead: T(3, 3, 0, 0), support: T(10, 2, 0, 0) });
    expect(d.leadTied).toBe(true); expect(d.leadMajority).toBe('A'); expect(d.supportMajority).toBe('A'); expect(d.alignment).toBe(0);
  });
  it('gives no support majority and no alignment when only the lead class voted', () => {
    const d = dmg({ lead: T(0, 10, 0, 0), support: Z });
    expect(d.leadMajority).toBe('B'); expect(d.supportMajority).toBeNull(); expect(d.supportTied).toBe(false);
    expect(d.alignment).toBe(0); expect(d.total).toBe(95);
  });
  it('caps the total at the round HP in the content, not at a fixed 100', () => {
    const tuned = { ...c, scoring: { ...c.scoring, roundHp: 80 } };
    const d = dmg({ content: tuned, lead: T(0, 10, 0, 0), support: T(0, 10, 0, 0), exhibits: 3, rallies: 2 });
    expect(d.total).toBe(80);
  });
});

describe('points, endings, awards', () => {
  it('speed bonus is linear and clamped', () => {
    expect(speedBonus(6000, 30000, 20)).toBe(16);
    expect(speedBonus(0, 30000, 20)).toBe(20);
    expect(speedBonus(45000, 30000, 20)).toBe(0);
  });
  it('speed bonus is 0, not NaN, when the window is zero or negative', () => {
    expect(speedBonus(0, 0, 20)).toBe(0);
    expect(speedBonus(5, 0, 20)).toBe(0);
    expect(speedBonus(5, -30000, 20)).toBe(0);
    expect(pointsFor({ content: c, roundIndex: 0, option: 'B', responseMs: 0, windowMs: 0, prior: [], isLead: true })).toBe(90);
  });
  it('speed bonus caps an answer stamped before the window opened', () => {
    expect(speedBonus(-1000, 30000, 20)).toBe(20);
  });
  it('points are effective score plus speed plus the caster bonus for the lead class', () => {
    const base = { content: c, roundIndex: 0, option: 'B' as const, responseMs: 6000, windowMs: 30000, prior: [] as const };
    expect(pointsFor({ ...base, isLead: true })).toBe(106);
    expect(pointsFor({ ...base, isLead: false })).toBe(96);
    expect(pointsFor({ content: c, roundIndex: 3, option: 'B', responseMs: 30000, windowMs: 30000, prior: ['B', 'C', 'B'], isLead: false })).toBe(95);
  });
  it('picks the ending by final blended majority and total damage tier', () => {
    const f = { content: c, finalLead: T(1, 5, 1, 1), finalSupport: T(4, 20, 4, 4) };
    expect(endingFor({ ...f, totalDamage: 300 })).toEqual({ ending: 'B', tier: 'decisive', majority: 'B', tiedWith: [] });
    expect(endingFor({ ...f, totalDamage: 200 })).toEqual({ ending: 'B', tier: 'fragile', majority: 'B', tiedWith: [] });
    expect(endingFor({ ...f, totalDamage: 179 })).toEqual({ ending: 'holds', tier: 'holds', majority: 'B', tiedWith: [] });
  });
  it('puts each tier boundary inside the tier it opens', () => {
    const f = { content: c, finalLead: T(1, 5, 1, 1), finalSupport: T(4, 20, 4, 4) };
    expect(endingFor({ ...f, totalDamage: 260 }).tier).toBe('decisive');
    expect(endingFor({ ...f, totalDamage: 259 }).tier).toBe('fragile');
    expect(endingFor({ ...f, totalDamage: 180 }).tier).toBe('fragile');
  });
  it('picks the ending from the blend of both groups, not from either alone', () => {
    // The lead class alone would say A and the rest alone C; the blend says B.
    expect(endingFor({ content: c, finalLead: T(8, 7, 0, 5), finalSupport: T(0, 7, 8, 5), totalDamage: 300 })).toEqual({ ending: 'B', tier: 'decisive', majority: 'B', tiedWith: [] });
  });
  it('names the letters a tied final round was level with: the earlier letter is the ending, as before', () => {
    expect(endingFor({ content: c, finalLead: T(1, 0, 1, 0), finalSupport: T(3, 0, 3, 0), totalDamage: 300 })).toEqual({ ending: 'A', tier: 'decisive', majority: 'A', tiedWith: ['C'] });
    expect(endingFor({ content: c, finalLead: Z, finalSupport: T(0, 3, 3, 3), totalDamage: 200 })).toEqual({ ending: 'B', tier: 'fragile', majority: 'B', tiedWith: ['C', 'D'] });
    expect(endingFor({ content: c, finalLead: T(0, 1, 0, 0), finalSupport: T(0, 0, 1, 0), totalDamage: 179 })).toEqual({ ending: 'holds', tier: 'holds', majority: 'B', tiedWith: ['C'] });
  });
  const p = (id: string, picks: string, score: number, table: string | null = null, role: Role = 'citizen'): Player => ({
    id, name: id, role, table, joinedAt: 0, score, lastPoints: 0,
    votes: Object.fromEntries([...picks].map((o, i) => [i, { option: o, at: 0 }])) as Player['votes'],
  });
  it('awards consistency to the player with most own-synergy hits, ties by score', () => {
    expect(consistencyAward([p('x', 'BCBB', 10), p('y', 'ACAA', 500), p('z', 'BCB', 999)], c)).toBe('x');
    expect(consistencyAward([p('x', 'BCBB', 10), p('y', 'BCBB', 11)], c)).toBe('y');
    expect(consistencyAward([p('z', 'BCB', 999)], c)).toBeNull();
  });
  it('awards the top table by mean score among tables with two or more members', () => {
    expect(tableAward([p('a', '', 100, 'Table 1'), p('b', '', 50, 'Table 1'), p('c', '', 400, 'Table 2'), p('d', '', 10, null)])).toEqual({ table: 'Table 1', mean: 75 });
    expect(tableAward([p('a', '', 100, null)])).toBeNull();
  });
  it('averages every member of a table and keeps the first table when the means are equal', () => {
    const rows = [p('a', '', 10, 'T1'), p('b', '', 20, 'T1'), p('c', '', 30, 'T1'), p('d', '', 20, 'T2'), p('e', '', 20, 'T2')];
    expect(tableAward(rows)).toEqual({ table: 'T1', mean: 20 });
  });
  it('groups tables whatever the case and spacing, names one by its first spelling, and never crowns a zero mean', () => {
    // Apart, the two spellings of table 3 would each be a table of one and drop out, and Red would win.
    expect(tableAward([p('a', '', 90, 'Table 3'), p('b', '', 70, 'table  3'), p('c', '', 40, 'Red'), p('d', '', 40, 'RED ')])).toEqual({ table: 'Table 3', mean: 80 });
    expect(tableAward([p('a', '', 0, 'T1'), p('b', '', 0, 't1')])).toBeNull();
    expect(tableAward([p('a', '', 0, 'T1'), p('b', '', 0, 'T1'), p('c', '', 10, 'T2'), p('d', '', 0, 'T2')])).toEqual({ table: 'T2', mean: 5 });
  });
});
