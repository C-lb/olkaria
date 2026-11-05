// The ending screen's words and columns (host/finale.ts), built from views the room's own reducer makes.
import { describe, expect, it } from 'vitest';
import raw from '../content/case.json';
import { endingArgs, NAMES_SHOWN } from '../host/finale';
import { loadContent } from '../shared/content';
import { hostView, initialState, reduce } from '../shared/room-logic';
import type { HostView, OptionId, RoomEvent, RoomState } from '../shared/types';

const c = loadContent(raw);
const KEY = 'host';
const LAST = c.rounds.length - 1;

/** A room driven by events, as the Durable Object drives it. */
function play(events: RoomEvent[]): RoomState {
  return events.reduce((st, ev) => reduce(st, ev, c).state, initialState('ABCD', KEY, 0, c));
}
const cmd = (cmd: Extract<RoomEvent, { type: 'cmd' }>['cmd'], now: number): RoomEvent => ({ type: 'cmd', key: KEY, cmd, now });
const join = (id: string, name: string, now: number): RoomEvent => ({ type: 'join', clientId: id, name, role: 'citizen', table: 'Team 1', now });

/** The room at the ending, with `votes` cast in the last round (player id and option) and `hand` counted in by key. */
function endingView(players: [string, string, number][], votes: [string, OptionId][], hand: Partial<Record<OptionId, number>> = {}): HostView {
  let t = 1000;
  const events: RoomEvent[] = players.map(([id, name, at]) => join(id, name, at));
  events.push(cmd({ k: 'start' }, (t += 10)), cmd({ k: 'goto', stage: LAST }, (t += 10)), cmd({ k: 'openVote' }, (t += 10)));
  for (const [id, option] of votes) events.push({ type: 'vote', clientId: id, round: LAST, option, now: (t += 10) });
  events.push(cmd({ k: 'injectVotes', counts: hand }, (t += 10)));
  events.push(cmd({ k: 'closeVote' }, (t += 10)), cmd({ k: 'reveal' }, (t += 10)), cmd({ k: 'next' }, (t += 10)));
  const st = play(events);
  expect(st.phase).toBe('ending');
  return hostView(st, t, c);
}

describe('endingArgs', () => {
  it('congratulates the room and lists who picked each option of the last question, in the order they joined', () => {
    // Ann and Ben joined at the same moment, so the id puts Ann first; Cy joined later still.
    const args = endingView(
      [['p3', 'Cy', 30], ['p2', 'Ben', 10], ['p1', 'Ann', 10], ['p4', 'Dee', 40]],
      [['p2', 'B'], ['p3', 'C'], ['p1', 'B']],
      { A: 2 },
    );
    const a = endingArgs(c, args);
    expect(a.title).toBe('Congratulations!');
    expect(a.text).toBe('The Deadlock is broken.');
    expect(a.question).toBe(c.rounds[4].question);
    expect(a.columns.map((col) => [col.letter, col.count, col.names])).toEqual([['A', 2, []], ['B', 2, ['Ann', 'Ben']], ['C', 1, ['Cy']]]);
    expect(a.columns.map((col) => col.text)).toEqual(c.rounds[4].options.map((o) => o.text));
    expect(a.columns[1].text).toBe(c.rounds[4].options[1].text);
    expect(a.columns.every((col) => col.more === 0)).toBe(true);
  });

  it('shows at most 30 names a column and counts the rest as more', () => {
    expect(NAMES_SHOWN).toBe(30);
    const players: [string, string, number][] = Array.from({ length: 34 }, (_, i) => [`p${String(i).padStart(2, '0')}`, `Student ${i}`, i]);
    const view = endingView(players, players.map(([id]) => [id, 'B']));
    const b = endingArgs(c, view).columns[1];
    expect(b.count).toBe(34);
    expect(b.names).toHaveLength(30);
    expect(b.names[0]).toBe('Student 0');
    expect(b.names[29]).toBe('Student 29');
    expect(b.more).toBe(4);
  });

  it('with names hidden every column has its count only', () => {
    const view = endingView([['p1', 'Ann', 1], ['p2', 'Ben', 2]], [['p1', 'B'], ['p2', 'C']], { A: 3 });
    const hidden = endingArgs(c, { ...view, hideNames: true });
    expect(hidden.columns.map((col) => [col.letter, col.count, col.names, col.more])).toEqual([['A', 3, [], 0], ['B', 1, [], 0], ['C', 1, [], 0]]);
  });

  it('reads counts of 0 and lists nobody when no one voted, without throwing', () => {
    const view = endingView([['p1', 'Ann', 1]], []);
    const a = endingArgs(c, view);
    expect(a.columns.map((col) => [col.count, col.names, col.more])).toEqual([[0, [], 0], [0, [], 0], [0, [], 0]]);
    expect(endingArgs(c, hostView(initialState('ABCD', KEY, 0, c), 0, c)).columns.map((col) => col.count)).toEqual([0, 0, 0]);
  });

  it('names only the votes of the last question', () => {
    let t = 1000;
    const st = play([
      join('p1', 'Ann', 1), join('p2', 'Ben', 2),
      cmd({ k: 'start' }, (t += 10)), cmd({ k: 'openVote' }, (t += 10)),
      { type: 'vote', clientId: 'p1', round: 0, option: 'A', now: (t += 10) },
      { type: 'vote', clientId: 'p2', round: 0, option: 'A', now: (t += 10) },
      cmd({ k: 'reveal' }, (t += 10)),
      cmd({ k: 'goto', stage: LAST }, (t += 10)), cmd({ k: 'openVote' }, (t += 10)),
      { type: 'vote', clientId: 'p1', round: LAST, option: 'B', now: (t += 10) },
      cmd({ k: 'closeVote' }, (t += 10)), cmd({ k: 'reveal' }, (t += 10)), cmd({ k: 'next' }, (t += 10)),
    ]);
    expect(st.phase).toBe('ending');
    expect(endingArgs(c, hostView(st, t, c)).columns.map((col) => [col.count, col.names])).toEqual([[0, []], [1, ['Ann']], [0, []]]);
  });

  it('puts no word a person reads about points, scores, damage or the old classes', () => {
    const view = endingView([['p1', 'Ann', 1]], [['p1', 'A']], { B: 1 });
    expect(JSON.stringify(endingArgs(c, view))).not.toMatch(/points|score|damage|leaderboard|Rogue|Knight|Bard|Wizard/i);
  });
});
