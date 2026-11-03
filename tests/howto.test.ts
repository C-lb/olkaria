// @vitest-environment happy-dom
import { expect, it } from 'vitest';
import raw from '../content/case.json';
import { howtoSlides } from '../host/howto';
import { loadContent } from '../shared/content';

const c = loadContent(raw);

it('eight slides from the case: the first boss, its question and options, the lead class, the constants', () => {
  const s = howtoSlides(c);
  expect(s.map((x) => x.kind)).toEqual(['title', 'join', 'round', 'lead', 'points', 'damage', 'ending', 'awards']);
  const [title, join, round, lead, points, damage, ending, awards] = s;
  if (title.kind !== 'title' || join.kind !== 'join' || round.kind !== 'round' || lead.kind !== 'lead' || points.kind !== 'points' || damage.kind !== 'damage' || ending.kind !== 'ending' || awards.kind !== 'awards') throw new Error('kinds');
  expect([title.name, title.sub]).toEqual(['Olkaria', 'the Deadlock']);
  expect(title.party.map((p) => [p.role, p.className, p.stakeholder])).toEqual([['citizen', 'Rogue', 'Citizen'], ['government', 'Knight', 'Kenyan Government'], ['business', 'Bard', 'Local Businesses'], ['microsoft', 'Wizard', 'Microsoft']]);
  expect(join.steps).toEqual(['Scan the code on the screen', 'Pick your class', 'Type your name']);
  expect(round).toMatchObject({ boss: 'Grid Wyrm', question: 'What will Kenyans accept on power?', hp: 100, clock: '2:00', hit: 62 });
  expect(round.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
  expect(round.options[1].label).toBe('Yes to 60 to 100 MW, tied');
  expect(round.lines).toEqual(['Talk at your table. Vote on your phone.', 'The clock stops when everyone has voted.']);
  expect(lead.lead).toBe('citizen');
  expect(lead.halves).toEqual(['Lead class', 'The rest of the party']);
  expect(points.chips.map((ch) => ch.value)).toEqual(['0 to 100', 'up to +20', '+10', '+10', '+30']);
  expect(damage.chunks.map((ch) => ch.width)).toEqual([50, 15, 10, 15, 10]);
  expect(damage.chunks.map((ch) => ch.note)).toEqual(['0 to 100', '+15', '+10', '+5 each, up to 3', '+10 each, up to 4']);
  expect(damage.chunks[1].label).toBe('Focus: 60% or more of you on one option');
  expect(damage.line).toBe('Four bosses, 100 each. 400 in all.');
  expect(ending).toMatchObject({ max: 400, fragile: 180, decisive: 260, fill: 260, holds: 'Under 180, the Deadlock holds.' });
  expect(ending.lines[0]).toBe('Microsoft decides.');
  expect(awards.items).toEqual(['Top five players', 'Most consistent strategist', 'Top table']);
});

it('no slide gives away an option score by letter, a debrief, a projector line or an ending title', () => {
  const text = JSON.stringify(howtoSlides(c));
  for (const r of c.rounds.slice(0, 3)) for (const o of r.options) {
    expect(text).not.toContain(o.debrief);
    expect(text).not.toContain(o.projector);
    expect(text).not.toContain(`${o.id} ${o.score}`);
  }
  for (const [key, e] of Object.entries(c.endings)) if (key !== 'holds') expect(text).not.toContain(e.title);
  expect(text).not.toMatch(/[\u2013\u2014]/);
});
