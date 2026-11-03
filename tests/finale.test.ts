// tests/finale.test.ts
// The ending and leaderboard screens from views the real reducer builds: the brief's three offline plays (Task 10,
// Step 2), a round nobody voted in, a final round nobody voted in, and the leaderboard's order, names and awards.
import { describe, expect, it } from 'vitest';
import raw from '../content/case.json';
import { endingArgs, leaderboardArgs, outcomeOf } from '../host/finale';
import { loadContent } from '../shared/content';
import { hostView, initialState, reduce } from '../shared/room-logic';
import type { HostCmd, HostView, OptionId, Player, Role, RoomState, Tally, Vote } from '../shared/types';

const c = loadContent(raw);
const KEY = 'host';
const T0 = 1_000_000;
const T = (A: number, B: number, C: number, D: number): Tally => ({ A, B, C, D });

const send = (s: RoomState, cmd: HostCmd): RoomState => {
  const { state, effects } = reduce(s, { type: 'cmd', key: KEY, cmd, now: T0 }, c);
  expect(effects.filter((e) => e.type === 'error')).toEqual([]);   // a refusal would leave the play somewhere else
  return state;
};

/**
 * The room after four rounds in which the facilitator only keyed votes in, as offline with 1 to 4 (no phones, no
 * exhibits, no call-outs): one tally per round, empty for a round nobody voted in. Left in `ending`, or on the
 * leaderboard.
 */
function play(rounds: Partial<Tally>[], phase: 'ending' | 'leaderboard' = 'ending'): HostView {
  let s = send(initialState('ABCD', KEY, T0, c), { k: 'start' });
  for (const counts of rounds) {
    for (const cmd of [{ k: 'openVote' }, { k: 'injectVotes', counts }, { k: 'closeVote' }, { k: 'reveal' }, { k: 'next' }] as HostCmd[]) {
      s = send(s, cmd);
    }
  }
  if (phase === 'leaderboard') s = send(s, { k: 'next' });
  expect(s.phase).toBe(phase);
  return hostView(s, T0, c);
}

const damage = (view: HostView): number[] => view.damageLog.map((d) => d.total);

describe('endingArgs: the brief\'s three offline plays', () => {
  it('B ten times a round strikes 95, 60, 95, 95: 345 is decisive, The Seed Plant with its bullets and no rows', () => {
    const view = play([{ B: 10 }, { B: 10 }, { B: 10 }, { B: 10 }]);
    expect(damage(view)).toEqual([95, 60, 95, 95]);
    expect(endingArgs(c, view)).toEqual({
      title: 'The Seed Plant', tier: 'decisive', split: T(0, 10, 0, 0),
      mustBeTrue: ['KenGen or a commercial anchor signs a smaller commitment', '24 to 60 MW fills within a few years', 'the expansion option stays open'],
      risk: ['weak early returns', 'competitors build larger first'],
      holds: null,
    });
    expect(endingArgs(c, view).text).toBeUndefined();
  });

  it('C, A, A, B twice each strikes 30, 25, 85, 80: 220 is fragile, still The Seed Plant', () => {
    const view = play([{ C: 2 }, { A: 2 }, { A: 2 }, { B: 2 }]);
    expect(damage(view)).toEqual([30, 25, 85, 80]);
    expect(endingArgs(c, view)).toMatchObject({ title: 'The Seed Plant', tier: 'fragile', split: T(0, 2, 0, 0), holds: null });
  });

  it('C, A, D, B twice each strikes 30, 25, 50, 65: 170 and the Deadlock holds, each round beside what B needed', () => {
    const view = play([{ C: 2 }, { A: 2 }, { D: 2 }, { B: 2 }]);
    expect(damage(view)).toEqual([30, 25, 50, 65]);
    expect(endingArgs(c, view)).toEqual({
      title: 'The Deadlock holds', tier: 'holds', text: 'Your board sends the party back to Nairobi.',
      split: T(0, 2, 0, 0), mustBeTrue: [], risk: [],
      holds: [
        { round: 'Round 1', chose: 'Rogues chose C: Full 1 GW for the hub', needed: 'B or D' },
        { round: 'Round 2', chose: 'Knights chose A: Sign the guarantee', needed: 'C or D' },
        { round: 'Round 3', chose: 'Bards chose D: Skills lab before contracts', needed: 'A or B' },
      ],
    });
  });
});

describe('endingArgs: whose majority, and the rounds with no votes', () => {
  it('follows the blended majority: two Wizards for D outweigh the party\'s three for B, and the split stays the raw count', () => {
    const view: HostView = {
      ...play([{ B: 10 }, { B: 10 }, { B: 10 }, { B: 10 }]),
      leadTally: T(0, 0, 0, 2), supportTally: T(1, 3, 0, 0), tally: T(1, 3, 0, 2),
    };
    expect(endingArgs(c, view)).toEqual({
      title: 'The Tenant', tier: 'decisive', split: T(1, 3, 0, 2),
      mustBeTrue: ['local partners such as EcoCloud are willing and able to own the asset risk', 'Kenya still delivers power and land', 'Azure demand fills the rented capacity'],
      risk: ['the demand risk is moved, not solved', 'the partners\' goals diverge from Microsoft\'s'],
      holds: null,
    });
  });

  it('says the lead class of a round nobody voted in chose nothing, and needs what the final majority (D) needed', () => {
    const view = play([{ C: 2 }, {}, { C: 2 }, { D: 2 }]);
    expect(damage(view)).toEqual([30, 0, 55, 80]);   // 165: the Deadlock holds
    expect(view.majorities).toEqual(['C', null, 'C', 'D']);
    expect(endingArgs(c, view).holds).toEqual([
      { round: 'Round 1', chose: 'Rogues chose C: Full 1 GW for the hub', needed: 'B or C' },
      { round: 'Round 2', chose: 'Knights chose nothing', needed: 'C or D' },
      { round: 'Round 3', chose: 'Bards chose C: Wait, compare providers', needed: 'B' },
    ]);
    expect(endingArgs(c, { ...view, majorities: ['C'] }).holds?.map((row) => row.chose)).toEqual([
      'Rogues chose C: Full 1 GW for the hub', 'Knights chose nothing', 'Bards chose nothing',
    ]);
  });

  it('holds with no rows when no one voted in the final round, though 250 damage would be a fragile A', () => {
    const view = play([{ B: 10 }, { B: 10 }, { B: 10 }, {}]);
    expect(damage(view)).toEqual([95, 60, 95, 0]);
    expect(endingArgs(c, view)).toEqual({
      title: 'The Deadlock holds', tier: 'holds', text: 'No one voted in the final round.',
      split: T(0, 0, 0, 0), mustBeTrue: [], risk: [], holds: [],
    });
  });
});

describe('outcomeOf: whether the core cracks', () => {
  it('is the option at its tier, the Deadlock holding below the fragile tier, and holding with no majority on no final votes', () => {
    expect(outcomeOf(c, play([{ B: 10 }, { B: 10 }, { B: 10 }, { B: 10 }]))).toEqual({ ending: 'B', tier: 'decisive', majority: 'B' });
    expect(outcomeOf(c, play([{ C: 2 }, { A: 2 }, { D: 2 }, { B: 2 }]))).toEqual({ ending: 'holds', tier: 'holds', majority: 'B' });
    expect(outcomeOf(c, play([{ B: 10 }, { B: 10 }, { B: 10 }, {}]))).toEqual({ ending: 'holds', tier: 'holds', majority: null });
  });
});

describe('leaderboardArgs', () => {
  const board = play([{ B: 10 }, { B: 10 }, { B: 10 }, { B: 7, D: 3 }], 'leaderboard');
  const player = (id: string, name: string, role: Role, score: number, joinedAt: number, more: Partial<Player> = {}): Player =>
    ({ id, name, role, table: null, joinedAt, score, lastPoints: 0, votes: {}, ...more });
  const seated = (players: Player[], hideNames = false): HostView =>
    ({ ...board, hideNames, players: Object.fromEntries(players.map((p) => [p.id, p])) });
  /** A player's votes in rounds 1 to 4; null for a round they missed. */
  const picks = (...options: (OptionId | null)[]): Record<number, Vote> =>
    Object.fromEntries(options.flatMap((option, i) => (option === null ? [] : [[i, { option, at: T0 }]])));

  it('closes offline on the question over round 4\'s split: no players, so no rows, no strategist and no table', () => {
    expect(leaderboardArgs(c, board)).toEqual({
      rows: [], consistent: 'No one voted in all four rounds', table: null,
      split: T(0, 7, 0, 3), question: 'What should Microsoft do, and why?',
    });
  });

  it('ranks the top five by score, the earlier joiner first on a tie, each with their class', () => {
    const view = seated([
      player('p1', 'Ann', 'government', 180, 1),
      player('p2', 'Bo', 'citizen', 250, 5),
      player('p3', 'Cy', 'business', 250, 2),
      player('p4', 'Dee', 'microsoft', 300, 3),
      player('p5', 'Eve', 'citizen', 120, 4),
      player('p6', 'Fay', 'government', 90, 6),
    ]);
    expect(leaderboardArgs(c, view).rows).toEqual([
      { name: 'Dee', className: 'Wizard', score: 300 },
      { name: 'Cy', className: 'Bard', score: 250 },
      { name: 'Bo', className: 'Rogue', score: 250 },
      { name: 'Ann', className: 'Knight', score: 180 },
      { name: 'Eve', className: 'Rogue', score: 120 },
    ]);
  });

  it('calls everyone Player while names are hidden, classes still shown', () => {
    const view = seated([player('p1', 'Ann', 'government', 180, 1), player('p2', 'Bo', 'citizen', 250, 2)], true);
    expect(leaderboardArgs(c, view).rows).toEqual([
      { name: 'Player', className: 'Rogue', score: 250 },
      { name: 'Player', className: 'Knight', score: 180 },
    ]);
  });

  it('names the most consistent strategist and the top table with its mean rounded, the strategist hidden like the rows', () => {
    // Ann's B, D, B then B hits all three of B's synergies, Cy's A, A, A then B one: Ann wins on the lower score. Dee
    // missed round 2, and sits alone at Table 1, so neither award can be hers.
    const players = [
      player('p1', 'Ann', 'government', 171, 1, { table: 'Table 3', votes: picks('B', 'D', 'B', 'B') }),
      player('p2', 'Cy', 'citizen', 174, 2, { table: 'Table 3', votes: picks('A', 'A', 'A', 'B') }),
      player('p3', 'Dee', 'business', 300, 3, { table: 'Table 1', votes: picks('B', null, 'B', 'B') }),
    ];
    const shown = leaderboardArgs(c, seated(players));
    expect(shown.consistent).toBe('Most consistent strategist: Ann');
    expect(shown.table).toBe('Top table: Table 3 (173 avg)');
    expect(leaderboardArgs(c, seated(players, true)).consistent).toBe('Most consistent strategist: Player');
  });

  it('says no one voted in all four rounds, and names no table when none has two members', () => {
    const view = seated([
      player('p1', 'Ann', 'government', 171, 1, { table: 'Table 3', votes: picks('B', 'D', null, 'B') }),
      player('p2', 'Cy', 'citizen', 174, 2, { table: 'Table 4', votes: picks('A', 'A', 'A') }),
    ]);
    const shown = leaderboardArgs(c, view);
    expect(shown.consistent).toBe('No one voted in all four rounds');
    expect(shown.table).toBeNull();
  });
});
