// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';

describe('content/case.json', () => {
  const c = loadContent(raw);
  it('has four roles by their new names, blurbs kept', () => {
    expect(c.roles.map((r) => r.id)).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(c.roles.map((r) => r.name)).toEqual(['Citizen', 'Government', 'Local Businessman', 'Satya Nadella']);
    for (const r of c.roles) expect(r.blurb.length).toBeGreaterThan(10);
  });
  it('has five rounds of three options, each with its boss and problem', () => {
    expect(c.rounds.map((r) => r.id)).toEqual(['power', 'demand', 'competition', 'risk', 'core']);
    expect(c.rounds.every((r) => r.options.map((o) => o.id).join('') === 'ABC')).toBe(true);
    expect(c.rounds.map((r) => r.boss)).toEqual(['Grid Wyrm', 'Fog of Demand', 'Hydra of Rivalry', 'Wraith of Risk', 'The Deadlock']);
    expect(c.rounds.map((r) => r.problem)).toEqual(['Power', 'Demand', 'Competition', 'Risk', 'The Deadlock']);
  });
  it('carries the spec text word for word', () => {
    expect(c.rounds[0].question).toBe("What should Kenya do about the data centre's electricity needs?");
    expect(c.rounds[2].question).toBe('AWS, Google and Oracle are already investing in SSA. How should Microsoft respond?');
    expect(c.rounds[4].options[1].text).toBe('Start small. Build a smaller facility (24-60 MW) and grow later. Less money is at risk, but rivals may build bigger first.');
  });
  it('keeps no scoring, explanations, old endings or American spelling, and no em dash', () => {
    expect(JSON.stringify(raw)).not.toMatch(/data center|score|debrief|"phone"|mustBeTrue|\u2014/);
  });
  it('has the congratulations ending and the vote settings', () => {
    expect(c.ending).toEqual({ title: 'Congratulations!', text: 'The Deadlock is broken.' });
    expect(c.settings).toEqual({ voteSeconds: 120, maxCallouts: 4 });
  });
  it('rejects a broken file', () => {
    expect(() => loadContent({ ...raw, rounds: [] })).toThrow();
    expect(() => loadContent({ ...raw, settings: { voteSeconds: 0, maxCallouts: 4 } })).toThrow();
    const swapped = raw.rounds.map((r, i) => (i === 0 ? { ...r, options: [r.options[1], r.options[0], r.options[2]] } : r));
    expect(() => loadContent({ ...raw, rounds: swapped })).toThrow();
  });
});
