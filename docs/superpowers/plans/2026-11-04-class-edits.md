# Olkaria Class Edits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Olkaria into five boss fights with one three-option question each, no points anywhere, new role sprites, a team dropdown, and no walking levels, live before the 5 November 9:30 class.

**Architecture:** The room stays a pure reducer in `shared/room-logic.ts` run by the Durable Object and the offline client. Scoring, damage, exhibits, lead classes and the leaderboard are deleted from the model outward: shared types and content first, then art, the phone, the host's pure helpers, the host's HUD and scenes. The phase names stay (`travel` now means "the boss has arrived, the vote is not open"), so the router, the alarm and the reconnect paths keep their shape.

**Tech Stack:** TypeScript, Vite, Phaser 3.90 (host canvas), plain DOM (phone, HUD), Zod (content schema), Vitest + happy-dom, Cloudflare Worker + Durable Object (wrangler 4), Python (`docs/character-sheet/build.py`).

**Spec:** `docs/superpowers/specs/2026-11-04-class-edits-design.md`. Read it before any task. Its question tables are the source of every question and option string.

## Global Constraints

- Question and option text is copied character for character from the spec's tables into `content/case.json`. Never retyped from memory, never paraphrased, never clamped with an ellipsis on a vote screen.
- No visible "points", "score", "rank", "damage", "HP", "leaderboard", "Rogue", "Knight", "Bard" or "Wizard" on any screen, how-to slide, toast or menu label.
- No em dashes in any copy, comment or doc. No red in toasts.
- All copy that changes with the case lives in `content/case.json`, not in code.
- Icons are inline SVG only. UI follows the styles already in `player/styles.css` and `host/hud/hud.css`: flat fills, one accent, labels never wrap on buttons that are single words.
- `shared/` uses no DOM or Node globals (it is type-checked by both programs).
- Every scene key handler is registered through `oncePerEvent` (`host/hotkeys.ts`).
- Internal names that stay: `table` (holds the team), the `travel` phase, `host/strikers.ts`.
- Tasks 1 to 4 leave `npm run check` and the full suite red in files a later task owns. Each of those tasks is gated on its own listed test files and on `npm run check` reporting no error inside the files it owns. Task 5 ends with `npm run check && npm test && npm run build` all green.
- Commit at the end of every task and push to `main`. End each commit message with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- The controller sends Caleb one Telegram line per finished task: `cd "/Users/caleb/Telegram Bot (Lebbot)" && env -u CLAUDECODE poetry run lebbot-reply "<text>"`.
- Nothing is deployed to the `olkaria` Worker before Task 7's staging smoke passes.

## Review Focus

1. A room stored by the old build (phase `leaderboard`, a `D` vote, `damageLog`, no team) is loaded by the new Durable Object: it must load and broadcast without throwing. Test in Task 1.
2. A round locked with no votes at all: the boss still dies and the split shows 0 for every option, never `NaN`. Tests in Task 1 (`shares`) and Task 5 (HUD).
3. A phone still running the old page sends a join with a free-text table or none: the room refuses with `bad team` and the phone shows its join form with the message, not a spinner. Tests in Task 1 and Task 3.
4. The longest option (Q2 C, 150 characters) on a 390 px phone and on a projector card: the whole text shows, no horizontal scroll, no clamp. Test in Task 3 (no clamp class, wraps), checked by eye in Task 7.
5. The host reloads during `reveal`, or Space is pressed twice fast: the boss is shown dead with the split, the kill is not replayed, and one press sends one `next`. Tests in Task 4 (`spaceAction`, `sceneFor`).

---

### Task 1: The model: types, content, room logic

**Files:**
- Modify: `shared/types.ts`, `shared/content.ts`, `shared/room-logic.ts`, `shared/names.ts`, `shared/shapes.ts`, `content/case.json`, `worker/room.ts` (only if a removed field is referenced)
- Create: `shared/tally.ts`
- Delete: `shared/scoring.ts`, `tests/scoring.test.ts`, `tests/scoring-float.test.ts`
- Test: `tests/content.test.ts`, `tests/room-logic.test.ts`, `tests/names.test.ts`, `tests/worker-room.test.ts`, new `tests/tally.test.ts`

**Interfaces (produces):**

```ts
// shared/types.ts
export type OptionId = 'A' | 'B' | 'C';
export const OPTION_IDS: readonly OptionId[] = ['A', 'B', 'C'];
export type Phase = 'lobby' | 'travel' | 'vote' | 'locked' | 'reveal' | 'ending';
export interface Vote { option: OptionId; at: number }
export interface Player { id: string; name: string; role: Role; table: string; joinedAt: number; votes: Record<number, Vote> }
/** The student a call-out landed on; null for a hand call-out. The round's last entry is the one on screen. */
export interface Callout { playerId: string | null; option: OptionId | null }
export interface RoomState {
  code: string; hostKey: string; createdAt: number; updatedAt: number;
  phase: Phase; round: number; voteOpenedAt: number | null; voteDeadline: number | null; voteWindowMs: number;
  players: Record<string, Player>; banned: string[]; synthetic: Record<number, Tally>;
  callouts: Record<number, Callout[]>; majorities: (OptionId | null)[]; hideNames: boolean; trips: number;
}
// HostCmd loses 'exhibit' and 'judge'. Everything else stays.
export type HostView = Omit<RoomState, 'hostKey'> & { serverNow: number; tally: Tally };
export interface PlayerView {
  phase: Phase; round: number; serverNow: number; voteDeadline: number | null; voteWindowMs: number;
  name: string; role: Role; table: string; myVote: OptionId | null; playerCount: number;
  picks: (OptionId | null)[];
  callout: { name: string | null; option: OptionId | null; isMe: boolean } | null;
}

// shared/names.ts
export const TEAMS: readonly string[];              // 'Team 1' ... 'Team 8'
export function sanitizeTeam(raw: unknown): string | null;   // the team when raw is exactly one of TEAMS, else null. Replaces sanitizeTable.

// shared/tally.ts
export function shares(t: Tally): Record<OptionId, number>;   // each option's part of the whole, 0 for all when the tally is empty
export function majorityOf(t: Tally): { majority: OptionId | null; tiedWith: OptionId[] };   // null when empty; a tie goes to the earlier letter

// shared/content.ts (CaseContent)
// { title, roles: [{ id: Role, name, blurb }] x4,
//   rounds: [{ id: 'power'|'demand'|'competition'|'risk'|'core', boss, problem, question,
//              options: [{ id: OptionId, text, phone (max 28) }] x3 }] x5,
//   endings: { A, B, C: { title, mustBeTrue: string[], risk: string[] } },
//   settings: { voteSeconds: number > 0, maxCallouts: integer >= 0 } }
```

`shared/shapes.ts` drops `square` and `D`. `content/case.json`: `roles[].name` is "Citizen", "Government", "Local Businessman", "Satya Nadella" (ids `citizen`, `government`, `business`, `microsoft`, blurbs kept); `rounds[].boss` is "Grid Wyrm", "Fog of Demand", the two new boss names Task 2 chose (start with "Rival Hydra" and "Risk Wraith"; Task 2 may rename), "The Deadlock"; `problem` is "Power", "Demand", "Competition", "Risk", "The Deadlock"; endings A, B, C keep today's titles and bullets; `settings` is `{ "voteSeconds": 120, "maxCallouts": 4 }`. `synergy`, `exhibits`, `quotes`, `scoring`, `endings.D` and `endings.holds` go.

Reducer rules that change:
- `join`: refuses with `bad team` when `sanitizeTeam(ev.table)` is null. Otherwise as now.
- `reveal`: `locked` to `reveal`, appends `majorityOf(tallyFor(state, round)).majority` to `majorities`. Nothing else.
- `next`: `reveal` to `travel` on the next round (trips + 1), or to `ending` after the last. In `ending` it is `bad phase`.
- `callOut`: only in `locked`, at most `settings.maxCallouts` a round, appends `{ playerId, option }`. No pending check. `chooseVoter` keeps its rule (an unheard option first, then anyone not yet called).
- `goto(stage)`: 0 to 5. Keeps votes, synthetic votes and call-outs of rounds below the cut, `majorities` sliced then padded with null. Stage 5 is the ending on round 4.
- `playerView.callout`: the round's last call-out while the phase is `locked`, otherwise null.
- `sanitizeState`: phase `leaderboard` becomes `ending`, any other unknown phase `lobby`; `round` clamped to -1..4; votes whose option is not in `OPTION_IDS` are dropped; a player with no valid team gets `'Team 1'`; `callouts` entries reduced to `{ playerId, option }` with a non-option becoming null; `majorities` entries not in `OPTION_IDS` become null.

- [ ] **Step 1: Write the failing tests.** Rewrite `tests/content.test.ts`, `tests/names.test.ts`, the affected parts of `tests/room-logic.test.ts` and `tests/worker-room.test.ts`, and add `tests/tally.test.ts`. They must include:

```ts
// content: the real file loads and carries the spec's text
const c = loadContent(raw);
expect(c.rounds.map((r) => r.id)).toEqual(['power', 'demand', 'competition', 'risk', 'core']);
expect(c.rounds.every((r) => r.options.map((o) => o.id).join('') === 'ABC')).toBe(true);
expect(c.rounds[0].question).toBe("What should Kenya do about the data centre's electricity needs?");
expect(c.rounds[4].options[1].text).toBe('Start small. Build a smaller facility (24-60 MW) and grow later. Less money is at risk, but rivals may build bigger first.');
expect(JSON.stringify(raw)).not.toMatch(/data center|score|debrief|—/);
// tally
expect(shares({ A: 0, B: 0, C: 0 })).toEqual({ A: 0, B: 0, C: 0 });
expect(majorityOf({ A: 0, B: 0, C: 0 })).toEqual({ majority: null, tiedWith: [] });
expect(majorityOf({ A: 2, B: 1, C: 2 })).toEqual({ majority: 'A', tiedWith: ['C'] });
// names
expect(TEAMS).toEqual(['Team 1', 'Team 2', 'Team 3', 'Team 4', 'Team 5', 'Team 6', 'Team 7', 'Team 8']);
expect(sanitizeTeam('Team 9')).toBeNull(); expect(sanitizeTeam(undefined)).toBeNull(); expect(sanitizeTeam('Team 3')).toBe('Team 3');
// room-logic
// join with table 'Front row' -> effects [{ type: 'error', clientId, msg: 'bad team' }], no player added
// a vote for 'D' (cast through `as never`) adds no vote
// reveal of a locked round with no votes -> phase 'reveal', majorities [null]
// five rounds of start/openVote/vote/closeVote/reveal/next end in phase 'ending'; next in 'ending' -> 'bad phase'
// four call-outs in a round with voters on A, B, C: the first three cover A, B and C in some order, the fifth is refused 'call-out limit'
// playerView never has the keys score, rank, lastPoints, tally, isLead; hostView never has bossHp, damageLog, leadTally
// sanitizeState({ ...oldRoom, phase: 'leaderboard', round: 3, damageLog: [...], players: { p: { ...old, table: null, score: 90, votes: { 0: { option: 'D', at: 1 } } } } })
//   -> phase 'ending', players.p.votes {} and players.p.table 'Team 1'; reduce(tick) on the result does not throw
```

- [ ] **Step 2:** Run `npx vitest run tests/content.test.ts tests/tally.test.ts tests/names.test.ts tests/room-logic.test.ts tests/worker-room.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the interfaces and rules above. Delete `shared/scoring.ts` and its two test files.
- [ ] **Step 4:** Run the same command. Expected: PASS. Run `npm run check 2>&1 | grep -E "^(shared|worker)/"`. Expected: no output.
- [ ] **Step 5:** Commit: `feat: five three-option questions, no scoring, teams in the room model`.

---

### Task 2: Art: role figures with weapons, two new bosses, a death

**Files:**
- Modify: `shared/figures.ts`, `shared/palette.ts` (new colours), `host/art/boss-data.ts`, `host/art/bosses.ts`, `host/art/placeholders.ts`, `CREDITS.md` if it names a removed boss
- Test: `tests/figures.test.ts`, `tests/bosses.test.ts`

**Interfaces (produces):**

```ts
// shared/figures.ts
export const FIGURE_W = 16; export const FIGURE_H = 20;
export const FIGURES: Readonly<Record<Role, readonly FigureRect[]>>;
export function figureSvg(role: Role, scale: number): string;   // same markup contract, viewBox "0 0 16 20"
// host/art/boss-data.ts
export type BossId = 'power' | 'demand' | 'competition' | 'risk' | 'core';
export const BOSS_NAMES: Readonly<Record<'competition' | 'risk', string>>;   // what the builder named the two new bosses
export const DIE = { ms: 900 } as const;
// host/art/bosses.ts, on Boss
die(onDone?: () => void): this;   // flash, then fall apart or sink and fade within DIE.ms; onDone once
lieDead(): this;                  // the state die() ends in, at once, no tween
// reset() also undoes die() and lieDead()
```

Figures per the spec's Roles table: citizen in everyday clothes with a working tool, government in formal dress with a sash in the Kenyan flag's black, red and green and a large gavel, business in a suit and tie with a briefcase or sword, microsoft as Satya Nadella (short dark hair, glasses, trim beard, dark jacket, a 2 x 2 logo of four squares in `#f25022`, `#7fba00`, `#00a4ef`, `#ffb900` on the chest, a sword). Every figure faces right and holds its weapon on the right, toward the boss. The existing rigs for the wyrm, the fog and the core keep their art under the ids `power`, `demand`, `core`. The Debt Golem's data and rig are deleted. The two new bosses are built like the others (rows in `boss-data.ts`, a rig with an idle loop in `bosses.ts`), fit the same box (`tests/bosses.test.ts` holds each to it), and use no real company logo. Texture keys follow the ids (`boss-power` and so on); class textures stay `class-${role}` at 16 x 20.

- [ ] **Step 1: Write the failing tests.** In `tests/figures.test.ts`: every role's rects lie inside 16 x 20; the microsoft figure contains all four logo colours; each figure's rightmost third contains a rect in a weapon colour (`steel`, `wood` or `leather`); `figureSvg('citizen', 3)` has `width="48" height="60" viewBox="0 0 16 20"`. In `tests/bosses.test.ts`: the id list is exactly the five above, each new boss's parts stay inside the box the file already enforces, no `debt` key remains in `SPRITES`.
- [ ] **Step 2:** Run `npx vitest run tests/figures.test.ts tests/bosses.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Draw the figures and bosses, add `die`, `lieDead`, remove the golem.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5: Look at the figures.** Write a throwaway HTML page in the scratchpad with the four `figureSvg(role, 12)` outputs and each boss's still rows painted as `<rect>`s on `#15141c`, screenshot it with headless Chrome, and read the PNG. Redraw until each role is recognisable at a glance, the logo reads as four squares and each weapon is clearly a weapon. Save the final PNG as `docs/superpowers/plans/assets/2026-11-04-figures.png` for the review.
- [ ] **Step 6:** If the new boss names differ from "Rival Hydra" and "Risk Wraith", update `rounds[2].boss` and `rounds[3].boss` in `content/case.json`. Commit: `feat(art): role figures with weapons, the competition and risk bosses, a boss death`.

---

### Task 3: The phone

**Files:**
- Modify: `player/render.ts`, `player/main.ts`, `player/net.ts`, `player/styles.css`
- Test: `tests/player-render.test.ts`, `tests/player-main.test.ts`, `tests/player-net.test.ts`

**Interfaces:** Consumes `PlayerView`, `TEAMS`, `CaseContent`, `figureSvg` from Tasks 1 and 2. `Actions.join(name, role, team)` keeps its shape.

Screens, with their exact copy (`N` is the round plus 1, `label` the option's `phone`, `text` its `text`):

| When | `data-screen` | Shows |
|---|---|---|
| Join | `join` | "Join the game", Name, Role (figure, `roles[].name`), Team: `select#team` with a disabled first option "Choose your team" then `TEAMS`. Join enabled only with name, role and team |
| `lobby`, `travel` | `waiting` | figure, name, role name, the team. "Change" in the lobby only |
| `vote`, no vote yet | `vote` | eyebrow "Question N of 5", the clock, `h1` the question, three buttons each with letter, shape and the full `text` |
| `vote`, `locked` or `reveal` with a vote, and no call-out | `look` | `h1` "Look at the screen now.", then "You picked B. Start small." |
| `locked` or `reveal` without a vote | `look` | `h1` "Look at the screen now." only |
| `locked`, call-out is me | `called` | "You're up. Defend B: Start small." and the vibration as now |
| `locked`, call-out is someone else | `someone` | "Ann is defending B." |
| `ending` | `ending` | `h1` "Look at the screen now.", `h2` "Your five picks", five rows "Q1", letter, label or "No vote" |

No screen contains a number that is not a question number, a clock or "Team N". The `result` screen, `stat()`, `synergyHits` and the "class leads" note are deleted. An error from the room (`bad team`) puts the phone back on the join form with the message under it.

- [ ] **Step 1: Write the failing tests** in `tests/player-render.test.ts`: one per row of the table asserting `data-screen` and the exact strings; plus

```ts
// vote: the three buttons carry the full option text and the question is on screen
expect(root.querySelector('h1')?.textContent).toBe(content.rounds[1].question);
expect([...root.querySelectorAll('.vote')].map((b) => b.querySelector('.vote-label')?.textContent)).toEqual(content.rounds[1].options.map((o) => o.text));
// nothing about points on any screen of any phase
for (const phase of ['lobby', 'travel', 'vote', 'locked', 'reveal', 'ending'] as const)
  expect(renderText(phase)).not.toMatch(/point|score|rank|\+\d/i);
// join: the button stays disabled until a team is chosen; the select has 9 options
// styles.css: the .vote-label rule has no line-clamp and no nowrap
```

Update `tests/player-main.test.ts` and `tests/player-net.test.ts` for the team and for `bad team` returning the form.
- [ ] **Step 2:** Run `npx vitest run tests/player-render.test.ts tests/player-main.test.ts tests/player-net.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement. The vote buttons become a single column of full-width cards so the text wraps freely at 390 px.
- [ ] **Step 4:** Run the same command. Expected: PASS. `npm run check 2>&1 | grep "^player/"` prints nothing.
- [ ] **Step 5:** Commit: `feat(phone): the question on the vote screen, look at the screen after it, a team dropdown, no points`.

---

### Task 4: The host's pure helpers

**Files:**
- Modify: `host/strikers.ts`, `host/finale.ts`, `host/router.ts`, `host/hotkeys.ts`, `host/menu.ts`, `host/net.ts`, `host/howto.ts`, `host/audio/score.ts` and `host/audio/sound.ts` (only to drop the road's theme and cues), `scripts/simulate-class.ts`
- Delete: `host/quotes.ts`, `host/levels/road.ts`, `host/levels/party.ts`, `tests/road.test.ts`, `tests/party.test.ts`
- Test: `tests/strikers.test.ts`, `tests/finale.test.ts`, `tests/router.test.ts`, `tests/hotkeys.test.ts`, `tests/menu.test.ts`, `tests/offline-client.test.ts`, `tests/ws-client.test.ts`, `tests/howto.test.ts`, `tests/score.test.ts`, `tests/sound.test.ts`

**Interfaces (produces, for Task 5):**

```ts
// host/strikers.ts
export interface QuestionArgs { eyebrow: string; boss: string; question: string; footer: string }
export function questionFor(content: CaseContent, round: number): QuestionArgs;
//   eyebrow "Question 2 of 5: Demand", footer "Space opens the vote"
export function optionsFooter(content: CaseContent, view: Pick<HostView, 'phase' | 'round' | 'callouts'>): string;
//   vote: "Space locks the vote"
//   locked, call-outs left: "C calls a student out, Space strikes"; none left: "Space strikes"
//   reveal: "Space: next question", on the last round "Space: the ending"
export function calledNotes(content: CaseContent, callouts: readonly Callout[], players: Record<string, Player>, hideNames: boolean): string[];
//   one per call-out before the last: "Ann defended B"
export function bannerFor(...): BannerArgs | null;   // the round's last call-out while locked, as now, without a judging footer
export const KILL_MS = 2400;   // the party's strike and the boss's death together; Space skips it
export interface SpaceState { phase: Phase; busy: boolean; killing: boolean; lockedUntil: number; time: number }
export type SpaceAction = { kind: 'send'; cmd: HostCmd } | { kind: 'skip' } | { kind: 'none' };
export function spaceAction(s: SpaceState): SpaceAction;
//   travel -> openVote, vote -> closeVote, locked -> reveal, reveal while killing -> skip, reveal -> next; none while busy or before lockedUntil
// kept as they are: labelFor (reads roles[].name), votedText, timerText, clockCues, phaseCues, lockNoteFor and its notes, lockoutAfterLock, the lock constants
// deleted: classFor, strikePlan, beatsFor, debriefFor, alignmentText, narrationFor, judgeFlash, judgedNotes, lungeReach

// host/finale.ts
export interface Outcome { ending: OptionId | null; tiedWith: OptionId[] }
export function outcomeOf(view: HostView): Outcome;            // majorityOf(view.tally)
export function endingArgs(content: CaseContent, view: HostView): EndingArgs;
//   { title, note, split, mustBeTrue, risk }: note "" or "Tied with C"; with no votes title "No one voted in the final round." and empty lists

// host/router.ts
// sceneFor: lobby -> Lobby; travel, vote, locked, reveal -> Battle, fitting by key, round and trip, started with resume = (phase !== 'travel'); ending -> Ending.
// host/net.ts
export function botTally(n: number, rng: () => number): Tally;   // n even draws over A, B, C
```

Other rules: digits 1 to 3 add hand votes, Y and N do nothing, the hotkey comment and the menu's key map list only keys that still exist. Menu stages read "Q1 Power" to "Q5 The Deadlock" then "Ending"; "Restart round N" becomes "Restart question N". `howto.ts` produces these five slides and nothing else, each a title and one or two lines, with the vote time read from `settings.voteSeconds`:
1. "Join": "Scan the code. Pick your name, your role and your team."
2. "Five bosses": "Power, Demand, Competition, Risk, and the Deadlock. Each one guards a question."
3. "Vote": "Read the question on your phone and pick A, B or C. You have 2:00."
4. "Defend": "Then look at the screen. You may be called to defend your pick."
5. "The ending": "The last vote decides how it ends."

`scripts/simulate-class.ts`: teams from `TEAMS`, weights over A, B, C, exits 0 when every phone sees `ending`.

- [ ] **Step 1: Write the failing tests.** Rewrite the listed test files to the interfaces above. They must include:

```ts
expect(questionFor(content, 1)).toEqual({ eyebrow: 'Question 2 of 5: Demand', boss: 'Fog of Demand', question: content.rounds[1].question, footer: 'Space opens the vote' });
expect(spaceAction({ phase: 'reveal', busy: false, killing: true, lockedUntil: 0, time: 5 })).toEqual({ kind: 'skip' });
expect(spaceAction({ phase: 'reveal', busy: false, killing: false, lockedUntil: 10, time: 5 })).toEqual({ kind: 'none' });
expect(sceneFor({ phase: 'travel', round: 0, trips: 1 }, { key: 'Lobby', round: -1, trip: 0 })).toEqual({ key: 'Battle', data: { round: 0, resume: false, trip: 1 } });
expect(sceneFor({ phase: 'reveal', round: 2, trips: 3 }, null)).toEqual({ key: 'Battle', data: { round: 2, resume: true, trip: 3 } });
expect(sceneFor({ phase: 'vote', round: 2, trips: 3 }, { key: 'Battle', round: 2, trip: 3 })).toBeNull();
expect(endingArgs(content, viewWithTally({ A: 2, B: 5, C: 5 }))).toMatchObject({ title: content.endings.B.title, note: 'Tied with C' });
expect(endingArgs(content, viewWithTally({ A: 0, B: 0, C: 0 }))).toMatchObject({ title: 'No one voted in the final round.', mustBeTrue: [], risk: [] });
const t = botTally(300, seeded); expect(t.A + t.B + t.C).toBe(300); expect(Math.min(t.A, t.B, t.C)).toBeGreaterThan(60);
// the offline client plays start to ending over five rounds with keys 1 to 3; Digit4 sends nothing
// every string in the how-to slides and the menu model: not.toMatch(/point|score|damage|leaderboard|Rogue|Knight|Bard|Wizard/i)
```

- [ ] **Step 2:** Run `npx vitest run tests/strikers.test.ts tests/finale.test.ts tests/router.test.ts tests/hotkeys.test.ts tests/menu.test.ts tests/offline-client.test.ts tests/ws-client.test.ts tests/howto.test.ts tests/score.test.ts tests/sound.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement and delete as listed.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(host): question, split and ending helpers without scoring; no roads, no leaderboard`.

---

### Task 5: The host's HUD and scenes

**Files:**
- Modify: `host/hud/Hud.ts`, `host/hud/hud.css`, `host/hud/HowTo.ts`, `host/scenes/Battle.ts`, `host/scenes/Ending.ts`, `host/scenes/Lobby.ts`, `host/scenes/Boot.ts`, `host/main.ts`
- Delete: `host/scenes/Travel.ts`, `host/scenes/Leaderboard.ts`, `host/ui/HpBar.ts`
- Test: `tests/hud.test.ts`, `tests/lobby.test.ts`, `tests/credits.test.ts` if it lists removed art

**Interfaces:** Consumes everything Tasks 1, 2 and 4 produce. HUD surface after this task:

```ts
export const OPTION_COLORS: Record<OptionId, string>;   // A, B, C keep today's colours
export interface LobbyArgs { /* as now, with roleNames: Record<Role, string> in place of classNames */ }
export interface OptionsArgs {
  eyebrow: string; question: string;
  options: { letter: OptionId; text: string }[];
  timerText: string; votedText: string;
  /** Null while the vote is open. Once locked: each option's share and count, one bar per card. */
  split: { shares: Record<OptionId, number>; counts: Tally } | null;
  footer: string; called?: string[];
}
export interface EndingArgs { title: string; note: string; split: Tally; mustBeTrue: string[]; risk: string[] }
showQuestion(a: QuestionArgs): void;   // replaces showNarration
showOptions(a: OptionsArgs): void;     // the question over three cards in one row
showEnding(a: EndingArgs): void;       // the split's heading reads "Question 5 split"
// removed: showNarration, showDebrief, showLeaderboard, flashRally
```

Battle, by phase: `travel` shows the boss's entrance and `showQuestion`; `vote` shows `showOptions` with `split: null`; `locked` adds the split, the call-out banner and `calledNotes`; on the view turning to `reveal` the four figures lunge together, the boss takes its hits and `die()`s within `KILL_MS`, and Space during it skips to the end state; `reveal` after the kill, or a Battle started with `resume` in `reveal`, shows `lieDead()` and `showOptions` with the split and the reveal footer. No HP bar, no rising numbers, no lead position: the party stands in `ROLES` order at x 26, 48, 70 and 92, feet on the floor, facing the boss. The boss for round `i` is `['power', 'demand', 'competition', 'risk', 'core'][i]`. Ending: the core cracks as now for an ending with votes, stands still with none; Space does nothing. `main.ts` registers `[Boot, Lobby, Battle, Ending]`. The lobby's keycaps and role tiles use `roles[].name`.

- [ ] **Step 1: Write the failing tests** in `tests/hud.test.ts` and `tests/lobby.test.ts`:

```ts
hud.showOptions({ eyebrow: 'Question 2 of 5: Demand', question: q, options, timerText: '1:59', votedText: '3 still to vote', split: null, footer: 'Space locks the vote' });
expect(root.querySelector('.options-question')?.textContent).toBe(q);
expect(root.querySelectorAll('[data-card]').length).toBe(3);
expect(root.querySelector('[data-card="C"] .card-text')?.textContent).toBe(options[2].text);
expect(root.querySelector('.bar')).toBeNull();
hud.showOptions({ ...args, split: { shares: { A: 0, B: 0, C: 0 }, counts: { A: 0, B: 0, C: 0 } } });
expect(root.textContent).not.toContain('NaN'); expect(root.querySelectorAll('.bar').length).toBe(3);
// with counts { A: 2, B: 5, C: 1 } card B reads "5" and "63%"
// showEnding: the heading "Question 5 split", the note shown only when not empty
// hud.css: .card-text has no line-clamp
// Hud.prototype has no showDebrief, showLeaderboard, showNarration
```

- [ ] **Step 2:** Run `npx vitest run tests/hud.test.ts tests/lobby.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement the HUD, then the scenes.
- [ ] **Step 4:** Run `npm run check && npm test && npm run build`. Expected: all green, no test file skipped.
- [ ] **Step 5:** Run `grep -rniE "points?\b|score|leaderboard|damage|\bHP\b|rogue|knight|bard|wizard" dist --include=*.js --include=*.html --include=*.css -o | sort | uniq -c`. Every hit must be library code or an identifier, none a string a person sees. Fix what is.
- [ ] **Step 6: Play it offline.** `npm run dev`, open the host with `?mode=offline`, play five questions with keys 1 to 3 and Space, and screenshot each boss alive, one kill mid-way, one reveal split and the ending at 1920 x 1080. Read the screenshots: the question and all three options are fully readable on Q2, nothing overlaps the boss, each figure and weapon reads. Fix what does not.
- [ ] **Step 7:** Commit: `feat(host): five boss fights with the question on screen, the boss always dies, no roads or leaderboard`.

---

### Task 6: The character sheet

Independent of Tasks 3 to 5. Needs Task 2's figures.

**Files:**
- Modify: `docs/character-sheet/build.py`, `docs/character-sheet/sheet.json`
- Output: the artifact at https://claude.ai/artifact/XvnuWqZreg91KxBx9ZsoH1 and `~/Desktop/BUSI611/Olkaria character sheet.pdf`

- [ ] **Step 1:** Read Caleb's saved edits: Artifact `read` with that URL and `path: data/sheet.json`. Save it over `docs/character-sheet/sheet.json`. If the Artifact tool is not available to you, stop and hand this step and Step 5 back to the controller.
- [ ] **Step 2:** Edit `sheet.json`: `rounds` becomes five entries, each `question` "Q1. ..." to "Q5. ..." and three options whose text is the spec's full option text; remove every `narration`, `facts` and option `phone` key; `planLines` 5; each role's `className` becomes "Citizen", "Government", "Local Businessman", "Satya Nadella"; each role's `strike` line is removed; `stakeholder`, stats and specials stay as saved. In the preamble, remove only a sentence that describes points, damage, rounds led by a class or collecting facts.
- [ ] **Step 3:** Edit `build.py`: the template no longer renders narration, facts, phone lines or a role's strike line; the figures it draws are Task 2's 16 x 20 ones (read them from `shared/figures.ts` the way the script already does, or port them if it holds its own copy); the path that generates a sheet from `content/case.json` works with the new schema or is deleted; nothing reads `scoring`.
- [ ] **Step 4:** Build both: `python3 docs/character-sheet/build.py --data docs/character-sheet/sheet.json --out "$HOME/Desktop/BUSI611/Olkaria character sheet.pdf"` and `--artifact <scratchpad dir>`. Read the PDF's pages: five questions, three options each, text identical to `content/case.json` (check with a script that extracts the PDF text and looks for each `text`), four new figures, no "Round", "Rogue", "Knight", "Bard", "Wizard", "On your phone" or "The Facts".
- [ ] **Step 5:** Publish the artifact directory to the same URL.
- [ ] **Step 6:** Commit: `feat(sheet): the five questions with three options, the new roles, no facts or phone lines`.

---

### Task 7: Runbook, staging, smoke, go live

**Files:**
- Modify: `RUNBOOK.md`, `README.md`, `wrangler.jsonc`, `package.json`
- Create: `scripts/live-smoke.mjs`

- [ ] **Step 1:** Rewrite `RUNBOOK.md` and `README.md` to the new flow: the run of show as five questions and the ending, the key table (Space, C, R, H, F, S, M, ?, 1 to 3 and B offline, Shift+R twice), the five questions with their bosses, the offline fallback, the rehearsal checklist. No discussion prompts. No mention of points, damage, exhibits, roads, judging or the leaderboard.
- [ ] **Step 2:** Add a `next` environment to `wrangler.jsonc` (`"env": { "next": { "name": "olkaria-next", "durable_objects": { ... same binding ... } } }`, repeating whatever wrangler reports as not inherited) and `"deploy:next": "vite build && wrangler deploy --env next"` to `package.json`. Run `npx wrangler deploy --env next --dry-run`. Expected: it names `olkaria-next` and the `ROOM` binding, with no warning about a missing migration.
- [ ] **Step 3:** Write `scripts/live-smoke.mjs`: `node scripts/live-smoke.mjs <out dir> [base url]`. Two headless Chromes over CDP, the host at 1920 x 1080 on port 9333 and a phone at 390 x 844 on port 9335. It creates a room with `?new=1`, joins the phone (name, role, Team 3), and for each of the five questions: screenshots the host's boss screen, opens the vote, screenshots both vote screens, asserts the phone's `h1` equals the question, votes, asserts the phone shows "Look at the screen now.", presses C on the first question and asserts the phone shows "You're up.", strikes, waits for the split, screenshots it, moves on. It ends on the ending with both screens shot, and asserts `document.documentElement.scrollWidth <= innerWidth` on every phone screen. Keys go in as DOM events, and it asserts the host tab is drawing (a `requestAnimationFrame` fires) before each strike. Exit code 0 only if every assertion held.
- [ ] **Step 4:** `npx wrangler whoami` (expect caleblimster@gmail.com's account), `npm run deploy:next`, then `node scripts/live-smoke.mjs <scratchpad>/smoke-next https://olkaria-next.sparkbot-worker.workers.dev`. Expected: exit 0. Read every screenshot. Fix and repeat until it passes and the screens look right.
- [ ] **Step 5:** `npm run deploy`, then the smoke script against `https://olkaria.sparkbot-worker.workers.dev`. Expected: exit 0. If it fails and the fix is not immediate, `npx wrangler rollback` and report.
- [ ] **Step 6:** Commit and push: `docs: the runbook for five questions; a staging worker and a smoke script`.
- [ ] **Step 7 (controller):** Send Caleb the screenshots on Telegram (the four figures, each boss, both vote screens, a split, the ending) with the live URL and the sheet's path, and update the memory file `project_olkaria.md` to the new game.

## Order

1, then 2, then 3, 4, 5 in order, then 7. Task 6 can run any time after 2 and touches no file the others touch.
