# Two-minute votes, early lock, one voice per option: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A vote runs two minutes or until everyone has voted, the screen says who is still to vote, and up to four call-outs a round each take a voter from an option the round has not heard yet.

**Architecture:** Two constants change in `content/case.json`. The reducer gains one rule in `castVote` (lock when the last player votes) and a new chooser for `callout`. The host's status text gains a phase, the clock formats as m:ss on both screens, and one more lock note tells an early lock from the clock's. The runbook and the game spec follow.

**Tech Stack:** TypeScript, Vitest, Zod content schema; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-olkaria-vote-window-and-callouts-design.md`

## Global Constraints

- No em dash or en dash anywhere: code, comments, tests, docs, commit messages.
- Copy verbatim from the spec's section 3.
- Content changes go in `content/case.json`, never in code.
- The reducer stays pure: randomness arrives in the command (`pick`), time in the event (`now`).
- Every commit ends with the two trailer lines the dispatch gives.
- Existing tests that encode the old constants (30 s window, two call-outs) are updated to the new values while keeping the behaviour each test checks; a test in which every player votes and then expects the vote still open gets a player who does not vote.

## Review Focus

- The last vote in the room locks the vote in the same event; a vote a moment later is refused "not accepting votes" and the phone hears it (Task 1 test).
- A room where a phone joined and went dark never locks early; the clock still locks it at 2:00 (the existing tick test, now at 120 s).
- R after an early lock reopens with the full window and nobody votes twice (Task 1 test).
- Four call-outs with only two voted options: the third and fourth fall back to uncalled voters, then to a hand call-out, then "call-out limit" (Task 1 test).
- The status line never reads a negative number when synthetic votes outnumber the players; "still to vote" counts players only (Task 2 test).

---

### Task 1: Room: two-minute window, early lock, one voice per option

**Files:**
- Modify: `content/case.json` (`voteSeconds` 120, `maxCallouts` 4)
- Modify: `shared/room-logic.ts` (`castVote`, `chooseVoter`, `callOut`, and their doc comments)
- Test: `tests/room-logic.test.ts`, `tests/content.test.ts` (the scoring constants line), `tests/scoring.test.ts` if a rally-cap assertion encodes 2

**Interfaces:**
- Produces: `castVote` returns `phase: 'locked'` with a `clearAlarm` effect when the vote it records is the last player's. `chooseVoter(state, called, cmd)` loses its `lead` parameter and picks per spec 2.6. `callOut` allows `maxCallouts` (now 4) a round.
- Consumes: nothing new.

- [ ] **Step 1: Write the failing tests**

In `tests/room-logic.test.ts` (fixtures: `mk`, `cmd`, `run`, `join`, `vote`, `toVote` with p1 Ann citizen, p2 government, p3 Cy microsoft and the vote open at `t0`; `locked()` at line 128 is p1 B, p2 A, p3 no vote, then `closeVote`):

```ts
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
    expect(all.state.players.p3.votes[0]).toMatchObject({ option: 'C', at: t0 + 7000 });
    expect(tallyFor(all.state, 0)).toEqual({ A: 1, B: 1, C: 1, D: 0 });
    expect(reduce(all.state, vote('p3', 0, 'D'), c).effects).toContainEqual({ type: 'error', clientId: 'p3', msg: 'not accepting votes' });
  });
  it('synthetic votes never lock it, a joiner during the vote holds it open, and an empty room never locks on a key vote', () => {
    expect(cmd(toVote(), { k: 'injectVotes', counts: { A: 30 } }).state.phase).toBe('vote');
    const three = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p3', 0, 'C', t0 + 7000)]).state;
    expect(three.phase).toBe('vote');
    expect(reduce(three, vote('p4', 0, 'D', t0 + 8000), c).state.phase).toBe('locked');
    const empty = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state;
    expect(cmd(empty, { k: 'injectVotes', counts: { B: 5 } }).state.phase).toBe('vote');
  });
  it('a reopen after an early lock runs the full window again and the standing votes stand', () => {
    const all = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), vote('p3', 0, 'C')]).state;
    const again = cmd(all, { k: 'reopen' }, t0 + 9000);
    expect(again.state.phase).toBe('vote');
    expect(again.state.voteDeadline).toBe(t0 + 9000 + 120_000);
    expect(tallyFor(again.state, 0)).toEqual({ A: 1, B: 1, C: 1, D: 0 });
    expect(reduce(again.state, vote('p1', 0, 'D', t0 + 9500), c).effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'already voted' });
  });
});

describe('call-outs: one voice per option, four a round', () => {
  it('picks across every voter, with no preference for the lead class, and only once locked', () => {
    expect(cmd(toVote(), { k: 'callout', pick: 0.1 }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
    expect(cmd(locked(), { k: 'callout', pick: 0.1 }).state.callouts[0][0]).toMatchObject({ playerId: 'p1', option: 'B', status: 'pending' });
    expect(cmd(locked(), { k: 'callout', pick: 0.9 }).state.callouts[0][0]).toMatchObject({ playerId: 'p2', option: 'A', status: 'pending' });
  });
  it('each call-out goes to an option the round has not heard; then any uncalled voter; then a hand call-out; then the limit', () => {
    const open = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A'), join('p4', 'Dee', 'business', t0 + 6500), vote('p4', 0, 'B', t0 + 7000)]).state;
    const s = cmd(open, { k: 'closeVote' }).state;   // p1 B, p2 A, p4 B; p3 did not vote
    const first = cmd(s, { k: 'callout', pick: 0.1 }).state;   // pool by join: p1, p2, p4; 0.1 is p1
    expect(first.callouts[0][0]).toMatchObject({ playerId: 'p1', option: 'B' });
    const second = cmd(cmd(first, { k: 'judge', awarded: true }).state, { k: 'callout', pick: 0.9 }).state;   // B is heard: p2 alone is preferred, whatever the pick
    expect(second.callouts[0][1]).toMatchObject({ playerId: 'p2', option: 'A' });
    const third = cmd(cmd(second, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // every voted option heard: any uncalled voter
    expect(third.callouts[0][2]).toMatchObject({ playerId: 'p4', option: 'B' });
    const fourth = cmd(cmd(third, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 }).state;   // nobody left: by hand
    expect(fourth.callouts[0][3]).toMatchObject({ playerId: null, option: null, status: 'pending' });
    const fifth = cmd(cmd(fourth, { k: 'judge', awarded: false }).state, { k: 'callout', pick: 0.5 });
    expect(fifth.effects).toContainEqual({ type: 'error', msg: 'call-out limit' });
    expect(fifth.state.callouts[0]).toHaveLength(4);
  });
});
```

Update the existing tests: the first lobby test's `voteWindowMs` becomes `120000`; "prefers voters of the lead class, only in locked" and "falls back to other voters once the lead class is used up" are replaced by the two tests above; "allows an explicit pick, refuses a second pending call-out and a third call-out" keeps the explicit pick and the pending refusal and drops the third-call-out refusal (the limit is covered above); `tests/content.test.ts` line 36 reads `maxCallouts: 4` and `voteSeconds: 120`. Any other test that now locks early because every player voted gets a player who does not vote.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/room-logic.test.ts tests/content.test.ts`
Expected: the window and limit assertions fail; the early-lock tests fail on `phase`.

- [ ] **Step 3: Content and reducer**

`content/case.json`: `"voteSeconds": 120`, `"maxCallouts": 4`.

`shared/room-logic.ts`:
- `castVote`: after building `voted`, build `players`; when `players` is non-empty and every player has `votes[ev.round]`, return `update(state, ev.now, { players, phase: 'locked' }, [{ type: 'clearAlarm' }])`; otherwise `update(state, ev.now, { players })` as today. Say in its doc comment that the last player's vote locks the round (spec 2.2) and that synthetic votes never do.
- `chooseVoter(state, called, cmd)`: `heard` is the set of options of the round's call-outs that name one (`co.option !== null`); `eligible` is the round's voters not yet called, sorted `byJoinThenId`; an explicit `cmd.playerId` in `eligible` wins; `fresh` is `eligible` minus the players whose option is in `heard`; the pool is `fresh` when it has anyone, else `eligible`; the pick is `floor(pick * pool.length)` clamped, as today. Drop the `lead` parameter and the lead-class preference; `callOut` stops passing `leadOf(...)` (keep `leadOf` if anything else uses it).
- Update the doc comments on `callOut` and `chooseVoter` to spec 2.6, and the module's phase comments if they say "two per round" or "30 s".

- [ ] **Step 4: Run everything**

Run: `npm test && npm run check`
Expected: green. If `tests/scoring.test.ts` asserts a rally cap of 20, update it to the constants (`min(rallies, 4) * 10`) and keep its intent.

- [ ] **Step 5: Commit**

```bash
git add content/case.json shared/room-logic.ts tests/room-logic.test.ts tests/content.test.ts tests/scoring.test.ts
git commit -m "feat: two-minute votes that lock when everyone has voted; call-outs take one voice per option, four a round"
```

---

### Task 2: Host: the clock, the count, the lock note, the docs

**Files:**
- Modify: `host/strikers.ts` (`clockText`, `timerText`, `votedText`, `EVERYONE_LOCK_NOTE`, `lockedEarly`)
- Modify: `host/scenes/Battle.ts` (`voted()` passes the phase; the lock note)
- Modify: `player/render.ts` (`formatCountdown` reads m:ss)
- Test: `tests/strikers.test.ts`, `tests/player-render.test.ts`
- Modify: `RUNBOOK.md`, `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md`

**Interfaces:**
- Produces:

```ts
// host/strikers.ts
/** Whole seconds as "m:ss": 120 is "2:00", 9 is "0:09", 0 and below "0:00", 600 "10:00". */
export function clockText(seconds: number): string;
/** The time left to `deadline` at `now`, rounded up, through clockText; empty with no deadline. */
export function timerText(deadline: number | null, now: number): string;
/** Open: "N still to vote" (players without a vote), "Everyone has voted", "No players yet". Locked: "N of M voted". Offline: "N voted". */
export function votedText(tally: Tally, playerCount: number, synthetic: Tally | undefined, offline: boolean, open: boolean): string;
export const EVERYONE_LOCK_NOTE = 'Everyone has voted. C calls a student out, Space strikes';
/** The vote went from open to locked before its deadline with every player holding a vote this round, and at least one player. */
export function lockedEarly(prev: Phase | null, view: Pick<HostView, 'phase' | 'updatedAt' | 'voteDeadline' | 'players' | 'round'>): boolean;
```

- Consumes: Task 1's early lock (the note fires on it). The how-to-play plan consumes `clockText`.

- [ ] **Step 1: Write the failing tests**

In `tests/strikers.test.ts` (the file's `T(a, b, c, d)` builds a tally, `Z` is the zero tally, and a `players` fixture with p1 Sarah exists near the banner tests):

```ts
it('the clock reads minutes and seconds, rounded up', () => {
  expect(clockText(120)).toBe('2:00');
  expect(clockText(9)).toBe('0:09');
  expect(clockText(0)).toBe('0:00');
  expect(clockText(-3)).toBe('0:00');
  expect(clockText(600)).toBe('10:00');
  expect(timerText(121_000, 1_000)).toBe('2:00');
  expect(timerText(121_000, 1_001)).toBe('2:00');
  expect(timerText(121_000, 61_500)).toBe('1:00');
  expect(timerText(121_000, 112_000)).toBe('0:09');
  expect(timerText(121_000, 121_000)).toBe('0:00');
  expect(timerText(121_000, 150_000)).toBe('0:00');
  expect(timerText(null, 0)).toBe('');
});
it('the count says who is still to vote while the vote is open, and who voted once it is locked', () => {
  expect(votedText(T(1, 2, 0, 0), 5, undefined, false, true)).toBe('2 still to vote');
  expect(votedText(T(1, 4, 0, 0), 3, T(0, 3, 0, 0), false, true)).toBe('1 still to vote');
  expect(votedText(T(1, 2, 0, 0), 3, undefined, false, true)).toBe('Everyone has voted');
  expect(votedText(T(5, 0, 0, 0), 2, T(5, 0, 0, 0), false, true)).toBe('2 still to vote');
  expect(votedText(Z, 0, undefined, false, true)).toBe('No players yet');
  expect(votedText(T(1, 2, 0, 0), 5, undefined, false, false)).toBe('3 of 5 voted');
  expect(votedText(T(1, 4, 0, 0), 3, T(0, 3, 0, 0), false, false)).toBe('5 of 6 voted');
  expect(votedText(T(2, 10, 0, 0), 0, T(2, 10, 0, 0), true, true)).toBe('12 voted');
  expect(votedText(T(2, 10, 0, 0), 0, T(2, 10, 0, 0), true, false)).toBe('12 voted');
});
it('tells an early lock from the clock lock and from a Space lock', () => {
  const voted = (id: string, option: OptionId) => ({ ...players.p1, id, name: id, votes: { 0: { option, at: 1 } } });
  const everyone = { p1: voted('p1', 'B'), p2: voted('p2', 'A') };
  const early = { phase: 'locked' as const, updatedAt: 50_000, voteDeadline: 121_000, players: everyone, round: 0 };
  expect(lockedEarly('vote', early)).toBe(true);
  expect(lockedByClock('vote', early)).toBe(false);
  expect(lockedEarly('vote', { ...early, players: { ...everyone, p3: { ...players.p1, id: 'p3', votes: {} } } })).toBe(false);
  expect(lockedEarly('vote', { ...early, players: {} })).toBe(false);
  expect(lockedEarly('vote', { ...early, updatedAt: 121_000 })).toBe(false);
  expect(lockedEarly('locked', early)).toBe(false);
  expect(lockedEarly('vote', { ...early, phase: 'vote' as const })).toBe(false);
});
```

The existing `timerText` assertions ("30 s", "1 s", "0 s") become "0:30", "0:01", "0:00"; the existing `votedText` assertions gain the `open` argument (`false` keeps their strings). In `tests/player-render.test.ts` lines 65 and 66, `formatCountdown` reads `'0:26'` and `'0:00'`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/strikers.test.ts tests/player-render.test.ts`
Expected: `clockText`, `lockedEarly` and `EVERYONE_LOCK_NOTE` are not exported; the format assertions fail.

- [ ] **Step 3: Host and phone**

`host/strikers.ts`: add `clockText`; `timerText` becomes `clockText(Math.ceil((deadline - now) / 1000))` with the null guard; `votedText` takes `open` and reads per the interface (players still to vote are `playerCount - (count(tally) - count(synthetic))`, never below 0); add `EVERYONE_LOCK_NOTE` beside `CLOCK_LOCK_NOTE` and `lockedEarly` beside `lockedByClock`. `host/scenes/Battle.ts`: `voted(view)` passes `view.phase === 'vote'`; where `lockedByClock` shows its note, an `else if (lockedEarly(was, view))` shows `EVERYONE_LOCK_NOTE` for `CLOCK_LOCK_NOTE_MS`. `player/render.ts`: `formatCountdown` formats m:ss the same way (write the small formatter once in `shared/` only if both sides can import it without pulling host code into the phone; otherwise a three-line local copy with a comment naming the other). Update the comments that quote "23 s".

- [ ] **Step 4: Docs**

`RUNBOOK.md`: the run-of-show rows for rounds 1 to 3 read "Up to 2 min vote, locks when everyone has voted, up to four call-outs, strike, 45 s debrief" (then the total shifts; say so in the row for the leaderboard or under the table); the R row reads "a fresh 2:00"; "Every round" step 2 reads "The vote runs 2:00 and locks itself at 0:00, or as soon as everyone has voted. Space locks it early. The status line counts who is still to vote."; step 3 reads "C calls out a voter whose option the round has not heard yet, at random among them (anyone uncalled once every voted option has been heard). The student defends their choice. Y if convincing: +10 damage and 30 points to them. N if not: no bonus and 10 points. C again for the next voice. Four per round at most."; the troubleshooting lines "C again calls someone else, two per round at most" and "R reopens it with a fresh 30 s" follow; the rehearsal checklist item reads "Up to four call-outs per round, one voice per option, judged with Y or N."

`docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md`: 4.3 step 2 reads "Two-minute timer; the vote locks itself as soon as every player has voted; Space locks early; the timer locks at 0:00." Step 3's call-out sentence reads "Call-out: C picks a random voter whose option the round has not heard yet (any uncalled voter once every voted option has been heard), shows their name and choice; they defend it; Y awards a rally strike, N does not. Up to four per round." The rally bonus line reads "maximum 4". The `openVote` line reads "(default 120)" and adds "A vote that leaves no player without a vote locks at once." The `callout` line reads the rule above and "at most 4 per round". The summary line on call-outs reads "random among voters of an option not yet heard this round, then anyone uncalled, at most four per round, +10 damage when convincing, 30 points to the student when awarded and 10 for speaking." Add one line under the amendments (or a dated note at the end) saying these came from Caleb on 3 Nov 2026.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add host/strikers.ts host/scenes/Battle.ts player/render.ts tests/strikers.test.ts tests/player-render.test.ts RUNBOOK.md docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md
git commit -m "feat: the clock reads m:ss, the count says who is still to vote, an early lock says why; runbook and spec follow"
```
