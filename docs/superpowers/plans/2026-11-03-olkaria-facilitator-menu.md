# Facilitator Menu, Automatic Travel and Phone Figures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the host a modal menu that restarts a round, returns to the lobby, reloads, or jumps to any stage or the ending; make the travel walk itself; show each player's class figure on their phone and beside the lobby's counts; drop the room code; cut the onboarding copy to name, role and table.

**Architecture:** One new host command, `goto`, in the pure reducer, with points written per vote at the reveal so a jump can give them back, and a `trips` counter the router compares so a jump to the round already showing restarts its road. The menu is a `host/menu.ts` module (pure item model plus a modal key handler on the window's capture phase) drawn by the HUD like every other screen. The four class figures move to `shared/figures.ts`, with an SVG markup builder, so the Phaser painter, the phone and the lobby HUD draw the same pixels. Travel starts with auto-run on. The lobby screen is rebuilt around the QR, the address and four class tiles; the phone's join form and waiting card lose every word a student does not need.

**Tech Stack:** TypeScript, Phaser 3.90, Vite 6, Vitest with happy-dom, Zod (worker schema), Cloudflare Worker and Durable Object.

**Spec:** `docs/superpowers/specs/2026-11-03-olkaria-facilitator-menu-design.md`, which amends `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md`.

## Global Constraints

- No em dashes anywhere: code, comments, copy, commit messages, docs. Plain factual voice, sentence case, never uppercase copy.
- Anti-vibecode UI: HUD and phone use only the tokens already in `host/hud/hud.css` and `player/styles.css`; flat buttons with a dim stroke, labels never wrap, no new colour, no shine. The one HUD accent (amber) stays for the Discuss line and the rally flash.
- `shared/` stays free of DOM, Node and Phaser: it is type-checked by both `tsconfig.json` and `worker/tsconfig.json`.
- Nothing from the room or a player goes through `innerHTML`; the phone builds SVG with DOM calls from constant data.
- No text drawn on the canvas; every word on the projector is HUD HTML.
- Every task ends green: `npm test`, `npm run check` (both tsconfig programs), and for tasks that touch the host or phone `npm run build`.
- Commit after each task. End every commit message with these two lines:
  `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_019dLNhhgSFjH9LLECFDt3Q4`
- Content stays in `content/case.json`; boss names and class names are read from it, never typed into code.
- Rooms made before this deploy have no `trips` field and get no migration (spec 4.3).

## Review Focus

- A `goto` to the round the projector already shows (restart) must start its road again; without the trip compare the router mistakes it for the gate's Travel-to-Battle hand-over. Test: Task 2, "starts the road again when the same round sets off on a new trip".
- A `goto` from an open vote must clear the alarm so the room never carries a deadline into the new travel. Test: Task 1, "clears the alarm only when a vote was open".
- A jump forward over unplayed rounds must pad `majorities` and `damageLog`, or the next reveal lands at the wrong index and the debrief reads another round's damage. Test: Task 1, "pads the rounds it skips".
- Restarting a revealed round must give back exactly that round's points and HP, or scores drift every time the menu is used. Test: Task 1, "a restart of the revealed round takes back exactly that round's points".
- While the menu is open no key may reach the room or the scenes (a digit would add a vote, Space would advance), but key releases must pass so a held arrow does not stick. Test: Task 4, "swallows key presses while open and lets releases through".
- The phone's unreachable note must not send a student looking for a code the screen no longer shows. Test: Task 6, "the unreachable note no longer points at a code".

---

### Task 1: Room: `goto`, `trips`, points per vote

**Files:**
- Modify: `shared/types.ts`
- Modify: `shared/room-logic.ts`
- Modify: `worker/room.ts` (the `hostCmd` Zod union)
- Test: `tests/room-logic.test.ts`
- Fix fixtures where `npm run check` shows a `RoomState` or `HostView` literal missing `trips` (tests under `tests/`, `scripts/simulate-class.ts` if it builds one).

**Interfaces:**
- Consumes: the reducer's helpers `update`, `refuse`, `nothing`, `initialState`, `zeroTally`, and `computeDamage` from `shared/scoring.ts`.
- Produces:
  - `HostCmd` gains `{ k: 'goto'; stage: number }`.
  - `RoomState` gains `trips: number` (so `HostView` carries it too).
  - `Vote` becomes `{ option: OptionId; at: number; points?: number }`.
  - Reducer: `goto(state, now, stage, content): Result` with the semantics of spec 4.1; `start`, `next` into travel and `goto` to a road add one to `trips`; `reset` keeps it; `reveal` writes `points` on each voter's vote.

- [ ] **Step 1: Write the failing tests**

Add to `tests/room-logic.test.ts`, using its helpers (`mk`, `cmd`, `run`, `join`, `toVote`, `closeAndReveal`, `nextRound`, `t0`). Where a helper needs a vote cast before it reveals, cast one with `vote(...)` first; the assertions below are what matter.

```ts
describe('goto', () => {
  const twoRounds = () => closeAndReveal(nextRound(closeAndReveal(toVote())));   // round 1 revealed, round 0 before it

  it('restarts the round it goes to, keeps the rounds before it, and gives back the points and HP of the rest', () => {
    const s = twoRounds();
    const r = cmd(s, { k: 'goto', stage: 1 }, t0 + 90000);
    expect(r.state).toMatchObject({ phase: 'travel', round: 1, voteOpenedAt: null, voteDeadline: null, trips: s.trips + 1 });
    for (const p of Object.values(r.state.players)) {
      expect(Object.keys(p.votes)).toEqual(p.votes[0] ? ['0'] : []);
      expect(p.score).toBe(p.votes[0]?.points ?? 0);
      expect(p.lastPoints).toBe(p.votes[0]?.points ?? 0);
    }
    expect(r.state.damageLog).toEqual([s.damageLog[0]]);
    expect(r.state.majorities).toEqual([s.majorities[0]]);
    expect(r.state.bossHp).toBe(400 - s.damageLog[0].total);
    const keys = [...Object.keys(r.state.synthetic), ...Object.keys(r.state.exhibits), ...Object.keys(r.state.callouts)];
    expect(keys.every((k) => Number(k) < 1)).toBe(true);
    expect(r.state.players).toMatchObject(Object.fromEntries(Object.keys(s.players).map((id) => [id, { id }])));   // nobody leaves
    expect(r.effects).toEqual([]);
  });

  it('a restart of the revealed round takes back exactly that round\'s points', () => {
    const before = nextRound(closeAndReveal(toVote()));   // round 1 under way, round 0 paid
    const after = closeAndReveal(before);
    const r = cmd(after, { k: 'goto', stage: 1 }).state;
    for (const id of Object.keys(before.players)) {
      expect(r.players[id].score).toBe(before.players[id].score);
      expect(r.players[id].lastPoints).toBe(before.players[id].lastPoints);
    }
    expect(r.bossHp).toBe(before.bossHp);
  });

  it('pads the rounds it skips, so a later reveal lands at its own index', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    const r = cmd(lobby, { k: 'goto', stage: 2 }).state;
    expect(r).toMatchObject({ phase: 'travel', round: 2, trips: 1, bossHp: 400 });
    expect(r.majorities).toEqual([null, null]);
    expect(r.damageLog.map((d) => d.total)).toEqual([0, 0]);
    const revealed = closeAndReveal(cmd(r, { k: 'openVote' }).state);
    expect(revealed.damageLog).toHaveLength(3);
    expect(revealed.damageLog[2].round).toBe(2);
    expect(revealed.majorities).toHaveLength(3);
  });

  it('clears the alarm only when a vote was open', () => {
    expect(cmd(toVote(), { k: 'goto', stage: 0 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(toVote(), { k: 'goto', stage: 4 }).effects).toEqual([{ type: 'clearAlarm' }]);
    expect(cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'goto', stage: 0 }).effects).toEqual([]);
  });

  it('goes to the ending for what has been played, clearing nothing, and next still shows the leaderboard', () => {
    const s = twoRounds();
    const r = cmd(s, { k: 'goto', stage: 4 }).state;
    expect(r).toMatchObject({ phase: 'ending', round: 3, voteOpenedAt: null, voteDeadline: null, trips: s.trips });
    expect(r.players).toEqual(s.players);
    expect(r.damageLog).toEqual(s.damageLog);
    expect(r.bossHp).toBe(s.bossHp);
    expect(cmd(r, { k: 'next' }).state.phase).toBe('leaderboard');
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    expect(cmd(lobby, { k: 'goto', stage: 4 }).state).toMatchObject({ phase: 'ending', round: 3 });
  });

  it('refuses a stage that is not 0 to 4 and changes nothing', () => {
    const s = twoRounds();
    for (const stage of [-1, 5, 1.5, Number.NaN]) {
      const r = cmd(s, { k: 'goto', stage });
      expect(r.state).toEqual(s);
      expect(r.effects).toEqual([{ type: 'error', msg: 'bad stage' }]);
    }
  });

  it('counts trips: start, each next into a travel and each goto to a road; reset keeps the count', () => {
    const lobby = run(mk(), [join('p1', 'Ann', 'citizen')]).state;
    expect(lobby.trips).toBe(0);
    const started = cmd(lobby, { k: 'start' }).state;
    expect(started.trips).toBe(1);
    const second = nextRound(closeAndReveal(cmd(started, { k: 'openVote' }).state));
    expect(second.trips).toBe(2);
    expect(cmd(second, { k: 'goto', stage: 1 }).state.trips).toBe(3);
    const back = cmd(second, { k: 'reset' }).state;
    expect(back.trips).toBe(2);
    expect(cmd(back, { k: 'start' }).state.trips).toBe(3);
    expect(hostView(second, t0, c).trips).toBe(2);
  });

  it('writes each voter\'s points on their vote at the reveal', () => {
    const s = closeAndReveal(toVote());
    for (const p of Object.values(s.players)) {
      if (p.votes[0]) expect(p.votes[0].points).toBe(p.lastPoints);
      else expect(p.lastPoints).toBe(0);
    }
  });

  it('a round voted on but never revealed does not survive a jump past it, forward or to the ending', () => {
    const voting = run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'C')]).state;   // round 0 open, two votes in, no reveal
    const forward = cmd(voting, { k: 'goto', stage: 2 }).state;
    expect(Object.values(forward.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(forward.majorities).toEqual([null, null]);
    expect(forward.damageLog.map((d) => d.total)).toEqual([0, 0]);
    expect(forward.bossHp).toBe(400);
    const ending = cmd(voting, { k: 'goto', stage: 4 }).state;
    expect(ending.phase).toBe('ending');
    expect(Object.values(ending.players).every((p) => Object.keys(p.votes).length === 0)).toBe(true);
    expect(tallyFor(ending, 0)).toEqual({ A: 0, B: 0, C: 0, D: 0 });
    expect(ending.damageLog).toEqual([]);
  });
});
```

Also extend the existing table in `'allows each phase-gated command in exactly its phases'` (and its refusal twin) so `goto` is allowed in every phase, including `lobby`, `ending` and `leaderboard`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/room-logic.test.ts`
Expected: the `goto` describe fails (type errors on `k: 'goto'` and `trips`, "bad phase" or `nothing` results).

- [ ] **Step 3: Types**

In `shared/types.ts`: `Vote { option: OptionId; at: number; points?: number }`; `RoomState` gains `trips: number` after `hideNames`; `HostCmd` gains `| { k: 'goto'; stage: number }`. Comment `trips` as "roads set off on: start, next into a travel and goto to a road each add one; reset keeps it".

- [ ] **Step 4: Reducer**

In `shared/room-logic.ts`:
- `initialState` sets `trips: 0`.
- `start`: `{ phase: 'travel', round: 0, trips: state.trips + 1 }`. `next` into travel adds one the same way. `reset` keeps `trips: state.trips`.
- `reveal`: for a voter, `votes: { ...p.votes, [round]: { ...vote, points: lastPoints } }`.
- `function goto(state: RoomState, now: number, stage: number, content: CaseContent): Result`: refuse `'bad stage'` unless `Number.isInteger(stage) && stage >= 0 && stage <= content.rounds.length`. Effects `state.phase === 'vote' ? [{ type: 'clearAlarm' }] : []`. Then:
  - `const settled = state.damageLog.length;` (one entry per revealed or padded round, so only the current round can lie beyond it, and only in travel, vote or locked);
  - `const cut = stage === content.rounds.length ? settled : Math.min(stage, settled);`
  - `keep = <T>(entries: Record<number, T>) => entries whose key < cut` for `synthetic`, `exhibits`, `callouts` and each player's `votes`;
  - per player: `score = sum of votes[r].points ?? 0 over the kept votes`, `lastPoints = votes[cut - 1]?.points ?? 0`;
  - stage `rounds.length` (the ending): `update(state, now, { phase: 'ending', round: rounds.length - 1, voteOpenedAt: null, voteDeadline: null, players, synthetic, exhibits, callouts }, effects)`; `damageLog`, `majorities`, `bossHp` and `trips` stay;
  - otherwise `const pad = <T>(list: T[], n: number, fill: (i: number) => T): T[]` appends `fill(i)` until length `n`;
  - `majorities: pad(state.majorities.slice(0, cut), stage, () => null)`;
  - `damageLog: pad(state.damageLog.slice(0, cut), stage, (r) => computeDamage({ content, roundIndex: r, lead: zeroTally(), support: zeroTally(), prior: [], exhibits: 0, rallies: 0 }))`;
  - `bossHp: content.rounds.length * content.scoring.roundHp - sum of the kept damageLog totals`;
  - `update(state, now, { phase: 'travel', round: stage, voteOpenedAt: null, voteDeadline: null, trips: state.trips + 1, players, synthetic, exhibits, callouts, damageLog, majorities, bossHp }, effects)`.
- `runCmd`: `case 'goto': return goto(state, now, cmd.stage, content);`
- Header comment of the file: add one line on `goto` and `trips`.

- [ ] **Step 5: Worker schema**

In `worker/room.ts` add `z.object({ k: z.literal('goto'), stage: z.number() })` to `hostCmd`. The compile-time `Assignable` checks pass again.

- [ ] **Step 6: Fixtures**

Run `npm run check`; add `trips: 0` to every `RoomState`/`HostView` literal it reports (tests, `scripts/`).

- [ ] **Step 7: Run everything**

Run: `npm test && npm run check`
Expected: all green, the new describe included.

- [ ] **Step 8: Commit**

```bash
git add shared/types.ts shared/room-logic.ts worker/room.ts tests scripts
git commit -m "feat: goto command jumps the room to a stage; trips counter; points kept per vote"
```

---

### Task 2: Router and scenes carry the trip

**Files:**
- Modify: `host/router.ts`
- Modify: `host/scenes/Boot.ts` (the lobby's start data)
- Modify: `host/scenes/Travel.ts` (keep `trip`, pass it to Battle at the gate)
- Test: `tests/router.test.ts`

**Interfaces:**
- Consumes: `HostView.trips` from Task 1.
- Produces:
  - `SceneData { round: number; resume: boolean; trip: number }`
  - `ActiveScene { key: string; round: number; trip: number }`
  - `sceneFor(view: { phase: Phase; round: number; trips: number }, active: ActiveScene | null)`: Travel and Battle fit only when key, round and trip match; Lobby, Ending and Leaderboard by key as today. Start data carries `trip: view.trips`.
  - `makeRouter(game)`: reads `data.trip` (a number, else 0) for the running scene and compares it too.

- [ ] **Step 1: Update and add tests**

In `tests/router.test.ts` give every view a `trips` and every active scene a `trip`, and every expected `data` a `trip` (fresh host: `trips: 0` and `trip: 0`; mid-game cases use the same value on both sides unless the test says otherwise). Add:

```ts
it('starts the road again when the same round sets off on a new trip, and leaves it alone on the same trip', () => {
  expect(sceneFor({ phase: 'travel', round: 1, trips: 3 }, { key: 'Battle', round: 1, trip: 2 })).toEqual({ key: 'Travel', data: { round: 1, resume: false, trip: 3 } });
  expect(sceneFor({ phase: 'travel', round: 1, trips: 2 }, { key: 'Battle', round: 1, trip: 2 })).toBeNull();
  expect(sceneFor({ phase: 'travel', round: 1, trips: 3 }, { key: 'Travel', round: 1, trip: 2 })!.data.trip).toBe(3);
  expect(sceneFor({ phase: 'vote', round: 1, trips: 2 }, { key: 'Battle', round: 1, trip: 2 })).toBeNull();
  expect(sceneFor({ phase: 'ending', round: 3, trips: 9 }, { key: 'Ending', round: 3, trip: 4 })).toBeNull();
});
```

In the `makeRouter` block, the fake game's start data and log include the trip (`start Travel round 0 trip 2`), and one test routes `{ phase: 'travel', round: 0, trips: 1 }` then `{ phase: 'travel', round: 0, trips: 2 }` across two microtasks and expects a second `start Travel round 0 trip 2`.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/router.test.ts`
Expected: type errors on `trips`/`trip`, and the new test fails.

- [ ] **Step 3: Router**

Implement the interfaces above in `host/router.ts`. In `Boot.ts` start the lobby with `{ round: -1, resume: false, trip: 0 }`. In `Travel.ts` add `private trip = 0`, set it in `init` from `data.trip ?? 0`, and pass `trip: this.trip` in `enterArena`'s start data. Update the header comments of router.ts and main.ts's registry note where they describe how scenes are told apart.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run check`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add host/router.ts host/scenes/Boot.ts host/scenes/Travel.ts host/main.ts tests/router.test.ts
git commit -m "feat: scenes carry the trip so a goto to the same round restarts its road"
```

---

### Task 3: The walk starts by itself

**Files:**
- Modify: `host/levels/road.ts` (`SETOFF_MS`)
- Modify: `host/scenes/Travel.ts`
- Modify: `host/hud/Hud.ts` (three `KEYS` rows)

**Interfaces:**
- Consumes: `stopAhead`, `START_X`, the scene's `auto`, `nextStop`, `restUntil` fields.
- Produces: `export const SETOFF_MS = 1000` in `road.ts`.

No unit test covers the scene; the walk is verified in the browser (Step 3). The pure path it follows is already covered by `tests/road.test.ts`.

- [ ] **Step 1: Code**

- `road.ts`: `/** The party stands this long after a segment starts before it sets off, so the road and its label register. */ export const SETOFF_MS = 1000;`
- `Travel.ts` `create()`: `this.auto = true; this.nextStop = stopAhead(this.segment.autoPath, START_X); this.restOwed = false; this.restUntil = this.game.getTime() + SETOFF_MS;` (corrected in Task 3: the scene clock `this.time.now` is stale inside `create()`, 0 on the first visit, while `game.getTime()` shares the time domain of `update()`) ``. Rewrite the header comment and the `bindKeys` doc: the party walks by itself; A pauses and resumes; any arrow takes control; N skips. Keep every key's behaviour otherwise.
- `Hud.ts` `KEYS`: `['Arrows', 'Take over the walk: run and jump; Space jumps too']`, `['A', 'Pause or resume the walk']`, `['N', 'Skip to the arena in travel']`.

- [ ] **Step 2: Run the suite and the check**

Run: `npm test && npm run check`
Expected: green (a HUD test that quotes the old A row, if any, is updated to the new text).

- [ ] **Step 3: Verify in the browser**

Run `npm run dev` and open `http://localhost:5173/host/?mode=offline` in Chrome (use the claude-in-chrome tools; real key events via the `computer` tool's key action). Press Space in the lobby. Expected, with no further key: the toast "Travel 1: Grid Wyrm ahead. Rogues lead."; the party standing for about a second, then running right; three exhibit toasts in turn, the party resting at each; then the Grid Wyrm narration panel. Then Shift+R twice, Space, wait 3 s, press A: screenshots a second apart show the lead at the same x; press A again: it moves; press ArrowRight once: the lead moves while the key is down and then stands (auto is off). Record what was seen in the report.

- [ ] **Step 4: Commit**

```bash
git add host/levels/road.ts host/scenes/Travel.ts host/hud/Hud.ts tests
git commit -m "feat: the party walks to the arena by itself; A pauses, arrows take over"
```

---

### Task 4: The facilitator menu

**Files:**
- Create: `host/menu.ts`
- Create: `tests/menu.test.ts`
- Modify: `host/hud/Hud.ts` (`showMenu` replaces `showKeymap`; `MenuArgs`, `MenuButton`; `KEYS` row `['M or Esc', 'This menu']` replaces the Esc row; the lobby hint becomes two keycaps: `ul.lobby-keys` replaces `p.hint.lobby-hint`)
- Modify: `host/hud/hud.css` (`.hud-menu`, `.menu`, `.menu-group`, `.menu-row`, `.menu-btn`, `.menu-label`, `.menu-hint`, `.menu-note`; the key map rules move under the menu; `.lobby-keys`, `.lobby-key` and `.lobby-key .key` replace `.lobby-hint` in the lobby block)
- Modify: `host/hotkeys.ts` (drop the Esc case and `keymap`; export `typing()`)
- Modify: `host/main.ts` (call `installMenu`)
- Test: `tests/hud.test.ts`, `tests/hotkeys.test.ts`

**Interfaces:**
- Consumes: `HostCmd` with `goto` (Task 1), `RoomClient.send` and `.mode`, `game.registry` ('view') and `game.registry.events` ('changedata-view'), `CaseContent.rounds[i].boss`.
- Produces:

```ts
// host/menu.ts
export type MenuAct = { kind: 'cmd'; cmd: HostCmd } | { kind: 'reload' };
export interface MenuItem { id: string; label: string; hint: string; enabled: boolean; confirm: boolean; act: MenuAct }
export interface MenuModel { actions: MenuItem[]; stages: MenuItem[]; stagesHint: string }
/** How long an armed item waits for its second press. */
export const ARM_MS = 3000;
/** `link` is the client's latest ConnectionStatus (host/net.ts), null before the first one. */
export function menuItems(content: CaseContent, view: HostView | null, mode: 'online' | 'offline', link: ConnectionStatus | null): MenuModel;
export function installMenu(game: Phaser.Game, client: RoomClient, hud: Hud, content: CaseContent, reload: () => void = () => location.reload()): () => void;

// host/hud/Hud.ts
export interface MenuButton { id: string; label: string; hint?: string; enabled: boolean; armed: boolean }
export interface MenuArgs { actions: MenuButton[]; stages: MenuButton[]; stagesHint: string; onPick: (id: string) => void; onClose: () => void }
showMenu(a: MenuArgs | null): void;      // null takes the menu down; a redraw keeps the focus on the same item id
moveMenuFocus(step: 1 | -1): void;       // through the enabled buttons in DOM order, wrapping; with none focused, 1 goes to the first and -1 to the last
focusedMenuItem(): string | null;
```

Item ids: `restart`, `lobby`, `reload`, `stage-0` to `stage-3`, `stage-4` (the ending). Labels and hints are the spec's (3.2) verbatim; stage labels are `${i + 1} ${content.rounds[i].boss}` and `Ending`. The reload item: offline, disabled with the hint "Offline mode starts over on a reload. Use Back to the lobby."; online with `link === 'open'`, enabled, no confirm, hint "The same room and screen come back."; online otherwise (`'closed'`, `'gone'` or null), enabled, confirm, hint "Needs the network. Without it the page is lost."

`installMenu` behaviour: it subscribes to `client.onStatus` at install (unsubscribing on dispose) and keeps the latest status as `link`, redrawing if the menu is open. One `keydown` listener on `window` in the capture phase. Chords (`ctrlKey`, `metaKey`, `altKey`) pass. Closed: `m` or `Escape` (not a repeat, not while `typing()`) opens and the event is stopped. Open: every keydown is stopped (`stopPropagation`); `Escape` or `m` closes; the arrows call `hud.moveMenuFocus` (Left/Up `-1`, Right/Down `1`) and prevent default; `Enter` or ` ` prevent default and pick `hud.focusedMenuItem()` if any; other keys do nothing. Keyup is never touched. Opening disarms, builds `menuItems(content, view, client.mode)`, shows it, and subscribes to `changedata-view` to redraw while open; closing unsubscribes, disarms, blurs the active element and calls `hud.showMenu(null)`. `pick(id)`: ignore a disabled or unknown id; if `confirm` and the id is not armed within `ARM_MS`, arm it (redraw, and a timer redraws when it lapses); else fire: `reload()` for the reload act, `client.send(cmd)` otherwise, then close. Returns the uninstall function, and installing again removes the earlier install first (as `installHotkeys` does).

- [ ] **Step 1: Write the failing tests**

`tests/menu.test.ts` (`// @vitest-environment happy-dom`), with a fake game `{ registry: { get, events: { on, off } } }`, a fake client `{ send: vi.fn(), mode: 'online', onStatus: vi.fn((cb) => { status = cb; return () => {}; }) }` (the tests call `status('open')` after install unless they say otherwise), a real `Hud` on a root in `document.body`, and a `reload = vi.fn()`; `view` is a lobby `HostView` fixture unless a test sets another. Key presses: `window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))`.

```ts
it('lists the actions and the stages for the lobby online', () => {
  const m = menuItems(c, lobbyView, 'online', 'open');
  expect(m.actions.map((a) => [a.id, a.label, a.enabled, a.confirm])).toEqual([
    ['restart', 'Restart the round', false, true], ['lobby', 'Back to the lobby', false, true], ['reload', 'Reload the page', true, false]]);
  expect(m.actions[2].hint).toBe('The same room and screen come back.');
  expect(m.stages.map((s) => s.label)).toEqual(['1 Grid Wyrm', '2 Debt Golem', '3 Fog of Demand', '4 The core', 'Ending']);
  expect(m.stages.map((s) => s.act)).toEqual([0, 1, 2, 3, 4].map((stage) => ({ kind: 'cmd', cmd: { k: 'goto', stage } })));
  expect(m.stages.every((s) => s.enabled && s.confirm)).toBe(true);
});
it('names the round to restart and sends goto for it; offline the reload is disabled and says why', () => {
  const m = menuItems(c, { ...lobbyView, phase: 'reveal', round: 2 }, 'offline', 'open');
  expect(m.actions[0]).toMatchObject({ label: 'Restart round 3', enabled: true, act: { kind: 'cmd', cmd: { k: 'goto', stage: 2 } } });
  expect(m.actions[1]).toMatchObject({ enabled: true, act: { kind: 'cmd', cmd: { k: 'reset' } } });
  expect(m.actions[2]).toMatchObject({ enabled: false, hint: 'Offline mode starts over on a reload. Use Back to the lobby.', act: { kind: 'reload' } });
});
it('online with the link down, the reload asks twice and says it needs the network', () => {
  for (const link of ['closed', 'gone', null] as const) {
    expect(menuItems(c, lobbyView, 'online', link).actions[2]).toMatchObject({ enabled: true, confirm: true, hint: 'Needs the network. Without it the page is lost.' });
  }
});
it('with no view yet only the reload is enabled', () => {
  const m = menuItems(c, null, 'online', 'open');
  expect([...m.actions, ...m.stages].filter((i) => i.enabled).map((i) => i.id)).toEqual(['reload']);
});
it('M opens with nothing focused, Esc closes, and M typed into a field does nothing', () => {
  press('m');
  expect(root.querySelector('[role=dialog][aria-label=Menu]')).not.toBeNull();
  expect(document.activeElement?.hasAttribute('data-menu-item') ?? false).toBe(false);
  press('Escape');
  expect(root.querySelector('[role=dialog][aria-label=Menu]')).toBeNull();
  const field = document.createElement('input'); document.body.append(field); field.focus();
  press('m');
  expect(root.querySelector('[role=dialog]')).toBeNull();
  field.remove();
});
it('swallows key presses while open and lets releases and browser chords through', () => {
  const seen = vi.fn();
  window.addEventListener('keydown', seen); window.addEventListener('keyup', seen);
  press('m');
  press('2'); press(' '); press('n');
  expect(seen).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  press('r', { metaKey: true });
  expect(seen).toHaveBeenCalledTimes(2);
  expect(send).not.toHaveBeenCalled();
});
it('arms a room-changing item on the first press and fires it on the second within 3 s', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  const lobby = root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement;
  lobby.click();
  expect(root.querySelector('[data-menu-item=lobby]')!.textContent).toContain('Sure?');
  expect(send).not.toHaveBeenCalled();
  vi.advanceTimersByTime(ARM_MS + 1);
  expect(root.querySelector('[data-menu-item=lobby]')!.textContent).toContain('Back to the lobby');
  (root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement).click();
  (root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'reset' });
  expect(root.querySelector('[role=dialog]')).toBeNull();
});
it('a press on another item moves the arming', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  (root.querySelector('[data-menu-item=restart]') as HTMLButtonElement).click();
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(root.querySelector('[data-menu-item=restart]')!.hasAttribute('data-armed')).toBe(false);
  expect(root.querySelector('[data-menu-item=stage-2]')!.hasAttribute('data-armed')).toBe(true);
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'goto', stage: 2 });
});
it('the arrows walk the enabled buttons, wrapping, and Enter presses the focused one', () => {
  press('m');   // lobby: restart and lobby are disabled, so the first enabled is reload
  press('ArrowRight');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('reload');
  press('ArrowDown');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-0');
  press('ArrowLeft'); press('ArrowUp');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-4');
  press('Enter'); press('Enter');
  expect(send).toHaveBeenCalledWith({ k: 'goto', stage: 4 });
});
it('reload fires at once while the link is up, asks twice once it drops, and a click on the scrim closes', () => {
  press('m');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(reload).toHaveBeenCalledTimes(1);
  status('closed');
  press('m');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(reload).toHaveBeenCalledTimes(1);
  expect(root.querySelector('[data-menu-item=reload]')!.hasAttribute('data-armed')).toBe(true);
  (root.querySelector('.hud-menu') as HTMLElement).click();
  expect(root.querySelector('[role=dialog]')).toBeNull();
});
```

`tests/hud.test.ts`: `showMenu` draws `button[data-menu-item]` for every id, `disabled` on disabled ones, an armed button with `data-armed` whose text is "Sure?" and `aria-label` "Sure? Back to the lobby", the stages hint, the `.keys` rows, and nothing after `showMenu(null)`; `moveMenuFocus` skips disabled buttons and wraps; a redraw keeps the focused id. Any test quoting the old Esc row gets the new text. The lobby hint (spec 7, amended 3 November evening):

```ts
it('the lobby hint is two keycaps: Space to start, Esc for the hotkeys', () => {
  const { root, hud } = fresh();
  hud.showLobby(lobby());
  expect([...root.querySelectorAll('.lobby-key')].map((li) => [li.querySelector('kbd.key')!.textContent, li.querySelector('span')!.textContent]))
    .toEqual([['Space', 'Start'], ['Esc', 'Shows hotkeys']]);
  expect(root.querySelector('.lobby-hint')).toBeNull();
  expect(root.textContent).not.toContain('every key');
});
```

`tests/hotkeys.test.ts`: remove `showKeymap` from the Hud fake; the Escape test becomes "leaves Escape alone": pressing it sends nothing and calls no HUD method.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/menu.test.ts tests/hud.test.ts tests/hotkeys.test.ts`
Expected: the menu tests fail (module missing), the HUD tests fail on `showMenu`.

- [ ] **Step 3: Hud**

Build `showMenu` in `Hud.ts` from the `MenuArgs` above. Markup: `div.hud-menu[role=dialog][aria-label=Menu]` holding `section.menu` with `h2.title` "Menu"; `section.menu-group` with `p.eyebrow` "Actions" and `div.menu-row` of `button.menu-btn[type=button][data-menu-item]` each with `span.menu-label` and, when a hint is given, `span.menu-hint`; a second group with the eyebrow "Go to", its row, and `p.hint.menu-note` for `stagesHint`; `div.sep`; the `ul.keys` rows from `KEYS`. A disabled button gets `disabled`; an armed one gets `data-armed`, label text "Sure?" and `aria-label` "Sure? <label>". Clicks on a button call `onPick(id)`; a click whose target is the `.hud-menu` scrim itself calls `onClose()`. Replace the node on each call; before replacing, remember the focused `data-menu-item` and focus the same id after. Remove `showKeymap` and `keymap()`. In `showLobby`, replace `p.hint.lobby-hint` with `ul.lobby-keys` holding two `li.lobby-key`, each a `kbd.key` then a `span`: Space "Start", Esc "Shows hotkeys".

- [ ] **Step 4: CSS**

In `hud.css`, replace the key map block with the menu: `.hud-menu` as `.hud-keymap` was plus `pointer-events: auto`; `.menu` as `.keymap` was; `.menu-group { display: flex; flex-direction: column; gap: var(--s2); }`; `.menu-row { display: flex; gap: var(--s2); }`; `.menu-btn { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: var(--s1); padding: var(--s2) var(--s3); border: 0; border-radius: var(--r-md); background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--line); color: var(--ink); font: 600 var(--t-body)/var(--lh-flat) var(--font-body); text-align: left; cursor: pointer; }`; `.menu-btn:disabled { opacity: .4; cursor: default; }`; `.menu-btn:focus-visible { outline: var(--s1) solid var(--ink-2); outline-offset: var(--s1); }`; `.menu-btn[data-armed] { background: var(--ink); color: var(--bg); }`; `.menu-label, .menu-hint { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`; `.menu-hint { font-weight: 500; font-size: calc(var(--zoom) * 3.5px); color: var(--ink-2); }`; `.menu-btn[data-armed] .menu-hint { color: var(--bg); opacity: .7; }`; `.menu-note { margin-top: calc(var(--s1) * -1); }`. Keep `.keys`, `.key-row`, `.key` as they are. In the lobby block, replace `.lobby-hint` with `.lobby-keys { flex: 0 0 auto; list-style: none; display: flex; gap: var(--s4); }`, `.lobby-key { display: flex; align-items: center; gap: var(--s2); white-space: nowrap; color: var(--ink-2); }`, `.lobby-key .key { font: 600 var(--t-body)/var(--lh-flat) var(--font-body); padding: var(--s1) var(--s2); color: var(--ink); box-shadow: inset 0 0 0 1px var(--line), 0 var(--s1) 0 var(--bg); }` (a flat cap with a dim stroke and a hard one-pixel bottom edge; `kbd` would otherwise fall back to the browser's monospace face). Update the file's layer comment.

- [ ] **Step 5: menu.ts, hotkeys.ts, main.ts**

Write `host/menu.ts` to the interface and behaviour above (a header comment in the style of `hotkeys.ts`). In `hotkeys.ts` export `typing`, delete the `escape` case, the `keymap` flag and the `showKeymap` call, and fix its doc comment. In `main.ts` call `installMenu(game, client, hud, content)` after `installHotkeys`, and mention the menu in the header comment.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 7: Look at it**

`npm run dev`, open `http://localhost:5173/host/?mode=offline`, press M: the panel sits low over the scrim with the title, the two rows, the hint and the key rows, no label wrapping at the window's zoom; press Space to start the game, then M, Right arrow to "1 Grid Wyrm", Enter twice: the road starts over. Screenshot the open menu for the report.

- [ ] **Step 8: Commit**

```bash
git add host/menu.ts host/hud/Hud.ts host/hud/hud.css host/hotkeys.ts host/main.ts tests/menu.test.ts tests/hud.test.ts tests/hotkeys.test.ts
git commit -m "feat: facilitator menu on M or Esc: restart, lobby, reload, go to a stage; key map inside it"
```

---

### Task 5: Class figures on the phone

**Files:**
- Create: `shared/palette.ts`, `shared/figures.ts`
- Create: `tests/figures.test.ts`
- Modify: `host/art/placeholders.ts` (import `PALETTE` from shared and re-export it; paint `class-*` from `FIGURES`; drop the four local figure lists)
- Modify: `player/render.ts`, `player/styles.css`
- Test: `tests/player-render.test.ts`

**Interfaces:**
- Produces:

```ts
// shared/palette.ts
export const PALETTE = { /* the object now in host/art/placeholders.ts, verbatim */ } as const;

// shared/figures.ts
export type FigureRect = readonly [x: number, y: number, w: number, h: number, colour: string];
export const FIGURE_W = 12;
export const FIGURE_H = 16;
/** The four class figures by role: citizen the Rogue, government the Knight, business the Bard, microsoft the Wizard. */
export const FIGURES: Readonly<Record<Role, readonly FigureRect[]>>;

/**
 * The markup of one figure as an inline SVG: svg.figure[data-role][width=12*scale][height=16*scale][viewBox="0 0 12 16"]
 * [shape-rendering=crispEdges][aria-hidden=true][focusable=false], one <rect x y width height fill> per FigureRect.
 * Constant data only, so the phone and the HUD may set it through innerHTML on a holder, as they draw the option shapes.
 */
export function figureSvg(role: Role, scale: number): string;

// player/render.ts (module-private): figureSvg through a holder element, as icon() draws the glyphs
function figure(role: Role, scale: number): Element;
```

- Consumes: `PALETTE` keeps its import path for every host file (`host/art/placeholders.ts` re-exports it); `boss-data.ts`'s `import type { PALETTE }` keeps working.

- [ ] **Step 1: Write the failing tests**

`tests/figures.test.ts`:

```ts
import { it, expect } from 'vitest';
import { FIGURES, FIGURE_H, FIGURE_W } from '../shared/figures';
import { PALETTE } from '../shared/palette';
import { ROLES } from '../shared/types';

it('every figure is 12 by 16 of whole pixels in palette colours, one per role, no two alike', () => {
  const colours = new Set<string>(Object.values(PALETTE));
  for (const role of ROLES) {
    const rects = FIGURES[role];
    expect(rects.length).toBeGreaterThan(10);
    for (const [x, y, w, h, colour] of rects) {
      expect([x, y, w, h].every(Number.isInteger)).toBe(true);
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(FIGURE_W);
      expect(y + h).toBeLessThanOrEqual(FIGURE_H);
      expect(colours.has(colour)).toBe(true);
    }
  }
  expect(new Set(ROLES.map((r) => JSON.stringify(FIGURES[r]))).size).toBe(4);
});

it('figureSvg draws every rectangle at the scale asked, crisp, and hidden from assistive tech', () => {
  const svg = figureSvg('government', 3);
  expect(svg.startsWith('<svg ')).toBe(true);
  expect(svg).toContain('class="figure"');
  expect(svg).toContain('data-role="government"');
  expect(svg).toContain('width="36"');
  expect(svg).toContain('height="48"');
  expect(svg).toContain('viewBox="0 0 12 16"');
  expect(svg).toContain('shape-rendering="crispEdges"');
  expect(svg).toContain('aria-hidden="true"');
  expect(svg.match(/<rect /g)).toHaveLength(FIGURES.government.length);
});
```

`tests/player-render.test.ts`:

```ts
it('draws the class figure on the role buttons, the waiting card and the lead note, from the shared figures', () => {
  const el = mount();
  render(el, null, c, { status: 'joining', name: '', role: null, table: '' }, noop);
  const roles = [...el.querySelectorAll('button[data-role]')];
  expect(roles.map((r) => r.querySelector('svg.figure')?.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
  expect(roles[0].querySelector('svg.figure')?.getAttribute('width')).toBe('36');
  expect(roles[0].querySelectorAll('svg.figure rect')).toHaveLength(FIGURES.citizen.length);
  expect(el.querySelector('.ico path[d^="M12 1.5"]')).toBeNull();   // the dagger glyph is gone
  render(el, { ...base, phase: 'lobby' }, c, joined, noop);
  const hero = el.querySelector('[data-screen=waiting] svg.figure')!;
  expect(hero.getAttribute('data-role')).toBe('citizen');
  expect(hero.getAttribute('width')).toBe('60');
  expect(hero.getAttribute('height')).toBe('80');
  render(el, base, c, joined, noop);
  expect(el.querySelector('.note svg.figure')?.getAttribute('width')).toBe('24');
  expect(el.querySelector('svg.figure rect')?.getAttribute('fill')).toMatch(/^#[0-9a-f]{6}$/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/figures.test.ts tests/player-render.test.ts`
Expected: module not found, then the figure assertions fail.

- [ ] **Step 3: Shared data**

Create `shared/palette.ts` with `PALETTE` moved verbatim (its comment too). Create `shared/figures.ts` with `ROGUE`, `KNIGHT`, `BARD`, `WIZARD` moved verbatim from `placeholders.ts` (their comments too), typed `readonly FigureRect[]`, `FIGURES`, and `figureSvg` (plain string building, no DOM). In `placeholders.ts`: `import { PALETTE } from '../../shared/palette'; export { PALETTE };` `import { FIGURES } from '../../shared/figures';` and paint `class-citizen` from `FIGURES.citizen`, and so on for the other three. Keep its local `Rect` type for the tiles, props and gate (or alias it to `FigureRect`).

- [ ] **Step 4: Phone**

In `player/render.ts` add `figure(role, scale)`, which sets `figureSvg(role, scale)` on a holder's `innerHTML` and returns its first element, as `icon()` does; use it at scale 3 in the join form's role buttons in place of `icon(ROLE_GLYPH[r.id])`, at scale 5 inside the waiting card's `span.glyph`, and at scale 2 in the lead note. Delete `ROLE_GLYPH` and the `dagger`, `shield`, `lute` and `staff` entries from `GLYPHS`, and fix the icon comment. In `player/styles.css` add `.figure { display: block; flex: none; }` and replace `.role .ico { ... }` with `.role .figure { margin-top: var(--s1); }`; drop any rule that only the removed glyphs used.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green. `tests/bosses.test.ts` and the host still import `PALETTE` from `host/art/placeholders`.

- [ ] **Step 6: Look at it**

`npm run dev`, open `http://localhost:5173/j/ABCD` in Chrome at a phone width (about 390 px): the four role buttons show the four figures crisp at 36 by 48 above their names; pick a role and name, join (the room is unreachable in dev, the form stays up; that is fine, the figure check is the point). Screenshot for the report.

- [ ] **Step 7: Commit**

```bash
git add shared/palette.ts shared/figures.ts host/art/placeholders.ts player/render.ts player/styles.css tests/figures.test.ts tests/player-render.test.ts
git commit -m "feat: class figures drawn on the phone from the shared pixel data"
```

---

### Task 6: Lean phone onboarding

**Files:**
- Modify: `player/render.ts`
- Modify: `player/styles.css` (only to drop rules the removed copy alone used)
- Test: `tests/player-render.test.ts`

**Interfaces:**
- Consumes: `figure()` from Task 5.
- Produces: the copy of spec section 8, verbatim. Join form: heading "Join the game"; labels "Name", "Role", "Table"; the table field's placeholder "Optional"; no placeholder on the name field; no eyebrow, cap or hint on the form. Waiting card: `h1.title` the player's name, `p.cap` "<class>, <stakeholder>" ("Rogue, Citizen"), and `p.cap` "Table: <table>" only when a table was given. Unreachable note: two `span.line`s reading "Can't reach this room." and "Scan the QR on the screen again."

- [ ] **Step 1: Write the failing tests**

In `tests/player-render.test.ts`:

```ts
it('onboards with the fewest words: name, role, table, join, nothing else', () => {
  const el = mount();
  render(el, null, c, { status: 'joining', name: '', role: null, table: '' }, noop);
  const form = el.querySelector('form[data-screen=join]')!;
  expect(form.querySelector('h1')!.textContent).toBe('Join the game');
  expect(form.querySelector('label[for=nickname]')!.textContent).toBe('Name');
  expect(form.querySelector('#role-label')!.textContent).toBe('Role');
  expect(form.querySelector('label[for=table]')!.textContent).toBe('Table');
  expect((form.querySelector('input[name=nickname]') as HTMLInputElement).placeholder).toBe('');
  expect((form.querySelector('input[name=table]') as HTMLInputElement).placeholder).toBe('Optional');
  expect(form.textContent).not.toContain(c.title);
  expect(form.textContent).not.toContain('Try for one of each role');
  expect(form.textContent).not.toContain('Add a name and pick a role');
  expect(form.querySelector('p.hint, p.cap, header .eyebrow')).toBeNull();
  expect((form.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBe(true);
});
it('the waiting card is the figure, the name, the class and stakeholder, and the table', () => {
  const el = mount();
  render(el, { ...base, phase: 'lobby', table: '3' }, c, joined, noop);
  const card = el.querySelector('[data-screen=waiting] .card')!;
  expect(card.querySelector('svg.figure')?.getAttribute('width')).toBe('60');
  expect(card.querySelector('h1')!.textContent).toBe('Ann');
  expect([...card.querySelectorAll('p.cap')].map((p) => p.textContent)).toEqual(['Rogue, Citizen', 'Table: 3']);
  expect(card.textContent).not.toContain("You're in as");
  expect(card.textContent).not.toContain('Watch the screen');
  expect(el.querySelector('[data-change]')).not.toBeNull();
  render(el, { ...base, phase: 'travel', table: null }, c, joined, noop);
  expect([...el.querySelectorAll('[data-screen=waiting] .card p.cap')].map((p) => p.textContent)).toEqual(['Rogue, Citizen']);
  expect(el.querySelector('[data-change]')).toBeNull();
});
it('the unreachable note no longer points at a code', () => {
  const el = mount();
  render(el, null, c, { status: 'joining', name: '', role: null, table: '', unreachable: 'ABCD' }, noop);
  expect(el.querySelector('[data-unreachable]')!.textContent).toBe("Can't reach this room. Scan the QR on the screen again.");
  render(el, null, c, { status: 'offline', name: 'Ann', role: 'citizen', table: '', unreachable: 'ABCD' }, noop);
  expect(el.textContent).toContain("Can't reach this room.");
  expect(el.textContent).not.toContain('ABCD');
});
```

Existing tests that quote "You're in as", "Watch the screen", "Your name", "Check the code on the screen" or the old placeholders are updated to the new copy.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/player-render.test.ts`
Expected: the three new tests fail on the old copy.

- [ ] **Step 3: Copy**

In `player/render.ts`: `joinForm` loses the header's eyebrow (the `h1` stays alone in the header), the `cap` under the roles and the `why` hint (the submit button still disables until a name and a role are given); labels become "Name", "Role", "Table"; the name input gets no placeholder and the table input "Optional". `waiting` builds the card as the interface says. `unreachableNote(code)` keeps its signature and the `data-unreachable` attribute (the dedupe in `syncUnreachable` uses it) but its lines read as specified. Fix the doc comments that quote the old lines. In `player/styles.css` drop any rule nothing uses any more.

- [ ] **Step 4: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add player/render.ts player/styles.css tests/player-render.test.ts
git commit -m "feat: lean onboarding copy on the phone; the unreachable note points at the QR"
```

---

### Task 7: The lobby screen

**Files:**
- Modify: `host/hud/Hud.ts` (`LobbyArgs` drops `code`, `smith` and `tanui`; `showLobby` rebuilt; `quote()` and the `SPEAKERS` import go)
- Modify: `host/hud/hud.css` (the lobby block)
- Modify: `host/scenes/Lobby.ts` (no `code`, `smith` or `tanui` in the args)
- Test: `tests/hud.test.ts`

**Interfaces:**
- Consumes: `figureSvg` from Task 5, `ROLES`, `LobbyArgs.classNames` and `roleCounts`.
- Produces: `LobbyArgs` without `code`, `smith` and `tanui`; "connecting" is now `!offline && joinUrl === ''`. Markup of `showLobby`: `section.panel.lobby` holding `header.lobby-head` (`h1.title.lobby-title` with `aria-label` TITLE, holding `span.lobby-name` "Olkaria" and `span.lobby-sub` "the Deadlock"; then the `ul.lobby-keys` of Task 4 and the how-to plan, three keycaps, unchanged), `div.lobby-body` (the square: `img.qr`, or `div.join` with the offline notice or "Connecting to the room" as today; `div.stack.lobby-info`: when `joinUrl` is given, `p.eyebrow` "Scan, or go to" and `p.join-url` with `span.join-host` (the host, scheme stripped) and `span.join-path` (the path, "/j/ABCD"); always `p.joined` with `b.joined-n` the count and `span.joined-word` " joined", then `ul.counts` of four `li.count` in `ROLES` order, each the figure through a holder (`figureSvg(role, 1)`), `span.count-name` (the plural class name) and `b` (the count); then the `div.stack` of recent names as today). No quote anywhere in the lobby.

- [ ] **Step 1: Write the failing tests**

In `tests/hud.test.ts`, drop `code`, `smith` and `tanui` from the `lobby()` fixture and from every `showLobby` call, delete the test "frames the lobby quotes with the speakers and citations from host/quotes.ts" (and the `SPEAKERS` import, if nothing else in the file uses it), then add:

```ts
it('the lobby shows the address in two lines, the count as a hero and the four class tiles, and no room code', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  hud.showLobby(lobby({ joinUrl: 'https://olkaria.example.dev/j/ABCD', count: 12, roleCounts: { citizen: 3, government: 4, business: 2, microsoft: 3 } }));
  expect(root.querySelector('.join-host')!.textContent).toBe('olkaria.example.dev');
  expect(root.querySelector('.join-path')!.textContent).toBe('/j/ABCD');
  expect(root.querySelector('.joined-n')!.textContent).toBe('12');
  expect([...root.querySelectorAll('.count svg.figure')].map((f) => f.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
  expect([...root.querySelectorAll('.count')].map((li) => [li.querySelector('.count-name')!.textContent, li.querySelector('b')!.textContent]))
    .toEqual([['Rogues', '3'], ['Knights', '4'], ['Bards', '2'], ['Wizards', '3']]);
  expect(root.textContent).not.toContain('Room');
  expect(root.querySelector('.code')).toBeNull();
  expect(root.querySelector('.lobby-title .lobby-name')!.textContent).toBe('Olkaria');
  expect(root.querySelector('.lobby-title .lobby-sub')!.textContent).toBe('the Deadlock');
  expect(root.querySelector('.quote')).toBeNull();
  expect(root.querySelectorAll('.lobby-key')).toHaveLength(3);   // Space, Esc and ? (the how-to plan)
});
it('offline and connecting lobbies keep the tiles but show no address', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  hud.showLobby(lobby({ offline: true }));
  expect(root.querySelector('.join-url')).toBeNull();
  expect(root.querySelectorAll('.count')).toHaveLength(4);
  expect(root.textContent).toContain('Offline mode');
  hud.showLobby(lobby({ joinUrl: '' }));
  expect(root.textContent).toContain('Connecting to the room');
  expect(root.querySelector('.join-url')).toBeNull();
  expect(root.querySelectorAll('.count')).toHaveLength(4);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/hud.test.ts`
Expected: type errors on `code`, then the new tests fail.

- [ ] **Step 3: Hud and Lobby**

Rebuild `showLobby` to the markup above and remove `code`, `smith` and `tanui` from `LobbyArgs`; `Lobby.ts` stops passing them. Remove the `quote()` helper and the `SPEAKERS` import from `Hud.ts` (the narration's quote arrives already framed; the `.quote` rule stays for it). Draw the tile figure as the option shapes are drawn (a holder's `innerHTML` set to `figureSvg(role, 1)`, first element appended).

- [ ] **Step 4: CSS**

In the lobby block of `hud.css`: add, after `.title`'s rule, `.lobby-title { display: flex; flex-direction: column; }`, `.lobby-name { font-size: calc(var(--zoom) * 16px); line-height: var(--lh-title); text-shadow: var(--s2) var(--s2) 0 var(--bg); }`, `.lobby-sub { font-size: var(--t-title); line-height: var(--lh-title); color: var(--ink-2); text-shadow: var(--s1) var(--s1) 0 var(--bg); }`; replace `.join-url` and `.code` with `.join-url { display: flex; flex-direction: column; line-height: var(--lh-title); }`, `.join-host { color: var(--ink-2); font-weight: 600; overflow-wrap: anywhere; }`, `.join-path { font-size: var(--t-narr); font-weight: 700; }`; replace `.joined` with `.joined { display: flex; align-items: baseline; gap: var(--s2); }`, `.joined-n { font: 600 var(--t-code)/var(--lh-title) var(--font-title); font-variant-numeric: tabular-nums; }`, `.joined-word { color: var(--ink-2); }`; replace `.counts` and `.counts b` with `.counts { list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--s2) var(--s4); }`, `.count { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; column-gap: var(--s2); }`, `.count .figure { display: block; width: calc(var(--zoom) * 12px); height: calc(var(--zoom) * 16px); }`, `.count-name { color: var(--ink-2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`, `.count b { font-weight: 600; font-variant-numeric: tabular-nums; }`. Update the block's comment.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 6: Look at it**

`npm run dev`, open `http://localhost:5173/host/?mode=offline` and, in a second tab, the online dev host `http://localhost:5173/host/` (the room server is not running locally, so it shows the connecting lobby). Check at the window's zoom: the title reads on two lines at its new size with its hard shadow, the two keycaps sit top right, no quote anywhere, nothing in the panel wraps badly, the four tiles show their figures beside the names and counts, the panel's bottom edge stays above the road at the foot of the canvas, no room code anywhere. Screenshot both for the report.

- [ ] **Step 7: Commit**

```bash
git add host/hud/Hud.ts host/hud/hud.css host/scenes/Lobby.ts tests/hud.test.ts
git commit -m "feat: lobby screen with a two-line title, keycaps, the address, a hero count and class tiles; the code and quotes go"
```

---

### Task 8: Docs and spec amendments

**Files:**
- Modify: `RUNBOOK.md`, `README.md`
- Modify: `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md` (sections 4.1, 4.5, 6.2, 6.5)
- Modify: `host/main.ts` (header comment only, if Task 4 left it short)

- [ ] **Step 1: RUNBOOK**

- Before class: the line that names a four-letter room code becomes `A QR code and the join address appear within a few seconds.` Under "The projector says ...", the reload line becomes `Reload the tab (Cmd+R). It opens a new room, and the class scans the new QR.` Any other sentence that tells anyone to type or check a room code goes or is reworded to the QR or the address (`grep -n -i "code" RUNBOOK.md` finds them; "QR code" stays).
- Run of show, Lobby row, the projector column: `QR, address, counts per class with their figures, avatars dropping in`.
- Run of show, Travel 1 row: `| 1:30 to 2:00 | Travel 1 | The party walks to the arena by itself past three exhibit pickups | Read each fact as it pops. N skips to the arena. |`
- The line after the table: `Travels 2 to 4: press N straight away unless you are running early. The party walks by itself either way.`
- Before class, the fullscreen check line: `F, then Space shows the party setting off, then N shows the Grid Wyrm and its HP bar.`
- Keys table: `| Arrows | Take over the walk in travel: run and jump |`; `| A | Pause or resume the walk in travel |`; replace the Esc row with `| M or Esc | Open or close the menu: restart the round, back to the lobby, reload, go to any stage or the ending, and every key. In fullscreen, Chrome takes Esc to leave fullscreen, so use M. |`
- "If something breaks" gains, before the Wi-Fi entry:

```
**You need to redo a round, or get to one.**
1. Press M. The menu opens over the screen. While it is open no other key does anything.
2. Click what you want, or arrow to it: Restart round N, Back to the lobby, Reload the page, or a stage under Go to.
3. The button turns pale and says Sure? Press it again within 3 s. Anything else calls it off.
4. The menu closes and the screen moves: a road starts walking, the lobby comes back, or the ending shows. Phones follow by themselves.
Rounds before the one you went to keep their votes, scores and damage. That round and the ones after it start over.
Going to a stage from the lobby starts the game there.
```

- Rehearsal checklist gains: `- [ ] The menu: M, Restart round 1 twice, play on. M, Go to 3 Fog of Demand twice. M, Back to the lobby twice.` and `- [ ] Each phone shows its class figure on the join form and on the waiting screen.`

- [ ] **Step 2: README**

Under "## More" add: `- M on the host opens the menu: restart the round, back to the lobby, reload, go to a stage or the ending, and the key map. Every item that changes the room asks twice.`

- [ ] **Step 3: Original spec**

In `2026-11-02-olkaria-deadlock-design.md`: 3.2 drops the room code and both quotes from what the lobby shows, names the two-line title and the Space and Esc keycaps, and adds the class tiles beside the counts; 5.6 says Tanui's quote opens round 2 only and Smith's is shown nowhere (it stays in the content); 4.1 adds one sentence that the phone shows the player's class figure on the role buttons, the waiting card and the lead note (3 November amendment, section 6); 4.5 says the party walks by itself from one second after the segment starts, A pauses and resumes, arrows take over, N skips; 6.2 adds `trips` to the state, `points` to a vote, and the transition "Any phase to `travel` (round s) or `ending` on host `goto` with stage 0 to 4"; 6.5 replaces "A: auto-run." with "A: pause or resume the walk." and "Esc: key map." with "M or Esc: the menu (actions and the key map)."

- [ ] **Step 4: Check the copy**

Run: `grep -n $'\xe2\x80\x94' RUNBOOK.md README.md docs/superpowers/specs/*.md host/main.ts host/menu.ts host/hud/Hud.ts shared/figures.ts shared/room-logic.ts player/render.ts; grep -n -i "room code\|four-letter" RUNBOOK.md README.md; npm test && npm run check && npm run build` (the first pattern is the em dash as UTF-8 bytes)
Expected: both greps print nothing; everything green.

- [ ] **Step 5: Commit**

```bash
git add RUNBOOK.md README.md docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md host/main.ts
git commit -m "docs: menu, automatic walk and phone figures in the runbook, readme and spec"
```
