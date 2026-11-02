// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';

describe('content/case.json', () => {
  const c = loadContent(raw);
  it('has four roles and four rounds of four options, each round led by the next role', () => {
    expect(c.roles.map(r => r.id)).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(c.roles.map(r => r.className)).toEqual(['Rogue', 'Knight', 'Bard', 'Wizard']);
    expect(c.roles.map(r => r.stakeholder)).toEqual(['Citizen', 'Kenyan Government', 'Local Businesses', 'Microsoft']);
    expect(c.rounds.map(r => r.id)).toEqual(['grid', 'debt', 'fog', 'core']);
    expect(c.rounds.map(r => r.lead)).toEqual(['citizen', 'government', 'business', 'microsoft']);
    for (const r of c.rounds) expect(r.options.map(o => o.id)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('scores evidence rounds only and pins the spec scores', () => {
    const s = (ri: number) => c.rounds[ri].options.map(o => o.score);
    expect(s(0)).toEqual([40, 80, 15, 55]);
    expect(s(1)).toEqual([10, 45, 65, 60]);
    expect(s(2)).toEqual([70, 80, 40, 35]);
    expect(s(3)).toEqual([null, null, null, null]);
  });
  it('keeps phone labels and projector lines short, with debriefs on evidence rounds', () => {
    for (const r of c.rounds) for (const o of r.options) {
      expect(o.phone.length).toBeLessThanOrEqual(28);
      expect(o.projector.length).toBeLessThanOrEqual(130);
      if (o.score !== null) { expect(o.debrief.length).toBeGreaterThan(20); expect(o.projector.length).toBeGreaterThan(20); }
    }
  });
  it('has a complete synergy table', () => {
    for (const id of ['A', 'B', 'C', 'D'] as const) expect(c.synergy[id]).toHaveLength(3);
    expect(c.synergy.B).toEqual([['B', 'D'], ['C', 'D'], ['A', 'B']]);
    expect(c.synergy.C).toEqual([['A'], ['B'], ['C', 'D']]);
  });
  it('has scoring constants, endings, exhibits and quotes', () => {
    expect(c.scoring).toMatchObject({ roundHp: 100, focusThreshold: 0.6, focusBonus: 15, alignmentBonus: 10, casterBonus: 10, exhibitBonus: 5, maxExhibits: 3, calloutBonus: 10, maxCallouts: 2, calloutPointsSpoke: 10, calloutPointsAwarded: 30, decisionBase: 50, synergyBonus: 15, speedBonusMax: 20, voteSeconds: 30 });
    expect(c.scoring.tiers).toEqual({ decisive: 260, fragile: 180 });
    expect(Object.keys(c.endings).sort()).toEqual(['A', 'B', 'C', 'D', 'holds']);
    expect(c.exhibits).toHaveLength(4);
    for (const set of c.exhibits) expect(set).toHaveLength(3);
    expect(Object.keys(c.quotes).sort()).toEqual(['ruto', 'smith', 'tanui']);
  });
  it('rejects a broken file', () => {
    expect(() => loadContent({ ...raw, rounds: [] })).toThrow();
  });
});
