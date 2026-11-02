# Olkaria: the Deadlock. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A projector-side pixel-art boss fight plus a phone voting page, where a class playing as Microsoft's deal team votes through four decision rounds of the Kenya data-centre case and the votes become attacks on the Deadlock.

**Architecture:** Pure TypeScript core in `shared/` (content schema, scoring, room reducer) used by both an authoritative Cloudflare Durable Object and an in-browser offline mode. Phaser 3 host game and a plain TypeScript phone page are built by Vite and served as static assets by the same Worker that hosts the rooms over WebSockets. All case content lives in one JSON file.

**Tech Stack:** TypeScript 5.7, Vite 6, Phaser 3.90, Zod 3.24, Vitest 3 (+ happy-dom for the player page), Wrangler 4 with Durable Objects (SQLite), `qrcode` 1.5, `ws` 8 (simulation script only), `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md` (read it first; section numbers below are its sections).

## Global Constraints

- Node 24 (installed: v24.15.0) and npm; no pnpm or bun in scripts.
- World canvas 320 × 180 at a whole-number zoom (`Phaser.Scale.NONE` plus `setZoom`, recomputed on resize), `pixelArt: true`, no smoothing. Everything textual (narration, cards, banner, debrief, QR, toasts, key map) lives in the HTML layer over the canvas, sized with a `--zoom` CSS variable; only damage numbers and the HP label are drawn on the canvas (spec 7).
- Option ids are exactly `'A' | 'B' | 'C' | 'D'`; shapes triangle, diamond, circle, square; colours muted red `#b5473d`, blue `#3f6fa3`, yellow `#c9a227`, green `#4f8a5b` in that order, bound to the letter everywhere (phone, cards, bars, banner, striker flash). Party sprites carry no colour. The striker for an option is its proposing member, or, when `member` is null, the member whose default button is that letter (spec 4.1).
- Travel controls: arrow keys and Space only; A toggles auto-run; N skips to the arena (spec 6.5).
- Scoring constants live in `content/case.json` under `scoring`: focus threshold 0.6, focus bonus 15, exhibit bonus 5, max exhibits 3, call-out bonus 10, max call-outs 2, call-out points 10 spoke and 30 awarded, decision base 50, synergy bonus 15, speed bonus max 20, tiers decisive 260 and fragile 180, vote window 30 s (spec 4.4). Code never hard-codes these numbers.
- Boss HP 100 per round, 400 total (spec 4.2).
- Names: required on the phone, trimmed, control characters removed, 16 characters max, generated fallback only on the server (spec 6.2).
- Call-outs happen only in the `locked` phase, random among this round's voters not yet called, at most two per round; the random number travels in the command so the reducer stays pure (spec 6.2).
- Room codes: 4 letters from A to Z without I and O (spec 6.3).
- Phone labels 28 characters or fewer; projector lines 130 or fewer; round ids `grid`, `debt`, `fog`, `core` (spec 6.6).
- `reopen` works from `locked` (back to `vote`, fresh deadline, `voteOpenedAt` unchanged) and from `vote` (deadline extended); everywhere else it is `'bad phase'`. A reveal is final (spec 6.2).
- Copy rules: sentence case, no em dashes, no all-caps eyebrows (anti-vibecode). All UI copy comes from `content/case.json` or the fixed strings named in tasks.
- The player page and host HUD follow the anti-vibecode skill; invoke it before writing `player/styles.css` or host HUD code.
- Every non-skippable animation is 8 seconds or shorter; Space skips (spec 2).
- Commit after each task; push to `main` on `origin` (GitHub `C-lb/olkaria`, private).

## Review Focus

1. A phone that reloads mid-vote reconnects with the same client id and must not be able to vote twice in that round; its first vote still counts. Test in Task 3.
2. A vote that arrives after the deadline tick but before the host presses anything must be rejected, not counted into the reveal. Test in Task 3.
3. A round in which nobody voted must reveal cleanly: damage 0, no NaN, majority A flagged tied, boss HP unchanged. Test in Task 2 and Task 3.
4. A host page reload must come back to the same room and the same state, not create a new room with a new QR. Test in Task 6 (persistence helpers) and manual check in Task 12.
5. Space pressed twice quickly during a reveal animation must advance once, not skip the debrief. Guard in Task 8 with a manual check.
6. A call-out when nobody voted (or in offline mode with only synthetic votes) must still work as a hand cold-call with no name, and a call-out left pending at reveal must count as declined. Test in Task 3.

---

## File structure

```
olkaria/
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  wrangler.jsonc  .gitignore
  README.md  RUNBOOK.md  CREDITS.md
  content/case.json                 all case content, scoring constants, endings, exhibits
  shared/types.ts                   OptionId, Phase, RoomState, events, views, messages
  shared/content.ts                 Zod schema, loadContent()
  shared/scoring.ts                 shares, majorityOf, synergyHits, effectiveScores, computeDamage, speedBonus, pointsFor, endingFor, consistencyAward
  shared/names.ts                   generateName, sanitizeName
  shared/room-logic.ts              initialState, reduce, tallyFor, hostView, playerView
  shared/codes.ts                   makeRoomCode, isValidCode
  worker/index.ts                   routes: /api/rooms, /ws/:code, /j/:code, /, assets fallthrough
  worker/room.ts                    Durable Object Room (hibernating WebSockets, alarm, storage)
  host/index.html  host/main.ts     Phaser bootstrap, registry wiring, HUD and router wiring
  host/net.ts                       RoomClient interface, WsRoomClient, OfflineRoomClient, createRoomClient
  host/session.ts                   rememberRoom, recallRoom (sessionStorage)
  host/scale.ts                     integerZoom(), applyZoom(): whole-number canvas zoom and HUD --zoom
  host/router.ts                    sceneFor(): which scene a phase and round belong to (reload and reconnect)
  host/hotkeys.ts                   global host keys (spec 6.5)
  host/hud/Hud.ts  host/hud/hud.css HTML text layer over the canvas: lobby, narration, cards, banner, debrief, toast, key map
  host/scenes/{Boot,Lobby,Travel,Battle,Ending,Leaderboard}.ts
  host/ui/HpBar.ts                  canvas HP bar (the one piece of UI drawn in the world layer)
  host/levels/road.ts               four travel segments: platforms, exhibit spots, gate x
  host/art/placeholders.ts          generated textures (rects, shapes) so scenes run before the art pass
  player/index.html  player/main.ts player/render.ts  player/styles.css  player/net.ts
  scripts/simulate-class.ts         N fake phones against a room
  tests/{content,scoring,names,room-logic,codes,session,player-render,offline-client,scale,router,hud}.test.ts
```

---

### Task 1: Repository, toolchain, content file, content schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore`, `README.md`
- Create: `content/case.json`
- Create: `shared/types.ts`, `shared/content.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces `shared/types.ts`: `OptionId`, `OPTION_IDS`, `Phase`, `Tally`, `Vote`, `Player`, `DamageResult`, `RoomState`, `HostCmd`, `RoomEvent`, `Effect`, `ClientMsg`, `ServerMsg`, `HostView`, `PlayerView` exactly as listed in the code block below.
- Produces `shared/content.ts`: `ContentSchema` (Zod), `type CaseContent`, `type RoundContent = CaseContent['rounds'][number]`, `type SynergyTable = Record<OptionId, OptionId[][]>`, `loadContent(raw: unknown): CaseContent` (throws `ZodError` on invalid input).

- [ ] **Step 1: Scaffold the repo**

`git init`, `npm init -y`, then set `package.json` to `"type": "module"` with scripts: `dev` = `vite`, `build` = `vite build`, `test` = `vitest run`, `check` = `tsc --noEmit`, `dev:worker` = `wrangler dev`, `deploy` = `vite build && wrangler deploy`, `simulate` = `tsx scripts/simulate-class.ts`. Dependencies: `phaser@^3.90`, `zod@^3.24`, `qrcode@^1.5.4`. Dev dependencies: `vite@^6`, `typescript@^5.7`, `vitest@^3`, `happy-dom@^17`, `wrangler@^4`, `@cloudflare/workers-types@^4`, `ws@^8`, `@types/ws`, `@types/qrcode`, `tsx@^4`. `tsconfig.json`: `strict`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `types: ["@cloudflare/workers-types", "vite/client"]`, `include: ["shared", "host", "player", "worker", "scripts", "tests"]`. `vite.config.ts`: `appType: 'mpa'`, `build.rollupOptions.input = { host: 'host/index.html', player: 'player/index.html' }`. `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, default environment `node`. `.gitignore`: `node_modules`, `dist`, `.wrangler`, `.DS_Store`.

- [ ] **Step 2: Write `shared/types.ts`**

```ts
export type OptionId = 'A' | 'B' | 'C' | 'D';
export const OPTION_IDS: readonly OptionId[] = ['A', 'B', 'C', 'D'];
export type Phase = 'lobby' | 'travel' | 'vote' | 'locked' | 'reveal' | 'ending' | 'leaderboard';
export type Tally = Record<OptionId, number>;
export interface Vote { option: OptionId; at: number }
export interface Player { id: string; name: string; joinedAt: number; score: number; lastPoints: number; votes: Record<number, Vote> }
export interface DamageResult {
  round: number; total: number; base: number; focus: number; exhibit: number; rally: number;
  shares: Record<OptionId, number>; effective: Record<OptionId, number>; perOption: Record<OptionId, number>;
  majority: OptionId; tied: boolean;
}
export interface Callout { playerId: string | null; option: OptionId | null; status: 'pending' | 'awarded' | 'declined'; points: number }
export interface RoomState {
  code: string; hostKey: string; createdAt: number; updatedAt: number;
  phase: Phase; round: number; voteOpenedAt: number | null; voteDeadline: number | null; voteWindowMs: number;
  players: Record<string, Player>; synthetic: Record<number, Tally>; exhibits: Record<number, string[]>;
  callouts: Record<number, Callout[]>;
  bossHp: number; damageLog: DamageResult[]; majorities: (OptionId | null)[]; hideNames: boolean;
}
export type HostCmd =
  | { k: 'start' } | { k: 'openVote'; seconds?: number } | { k: 'closeVote' } | { k: 'reveal' } | { k: 'next' }
  | { k: 'reopen' } | { k: 'reset' } | { k: 'kick'; playerId: string } | { k: 'exhibit'; exhibitId: string }
  | { k: 'injectVotes'; counts: Partial<Tally> } | { k: 'hideNames'; hide: boolean }
  | { k: 'callout'; pick?: number; playerId?: string } | { k: 'judge'; awarded: boolean };
export type RoomEvent =
  | { type: 'init'; code: string; hostKey: string; now: number }
  | { type: 'join'; clientId: string; name?: string; now: number }
  | { type: 'vote'; clientId: string; round: number; option: OptionId; now: number }
  | { type: 'cmd'; key: string; cmd: HostCmd; now: number }
  | { type: 'tick'; now: number };
export type Effect = { type: 'setAlarm'; at: number } | { type: 'clearAlarm' } | { type: 'error'; clientId?: string; msg: string };
export type ClientMsg =
  | { t: 'join'; clientId: string; name?: string } | { t: 'vote'; round: number; option: OptionId } | { t: 'cmd'; key: string; cmd: HostCmd };
export type HostView = Omit<RoomState, 'hostKey'> & { serverNow: number; tally: Tally };
export interface PlayerView {
  phase: Phase; round: number; serverNow: number; voteDeadline: number | null; voteWindowMs: number;
  name: string; myVote: OptionId | null; lastPoints: number; score: number; rank: number; playerCount: number;
  tally: Tally | null; majorities: (OptionId | null)[];
  picks: (OptionId | null)[];        // this player's option per round started so far (null = did not vote)
  callout: { name: string | null; option: OptionId | null; isMe: boolean } | null;   // the pending call-out, if any
}
export type ServerMsg = { t: 'host'; state: HostView } | { t: 'you'; view: PlayerView } | { t: 'error'; msg: string };
```

- [ ] **Step 3: Write the failing content test**

```ts
// tests/content.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';

describe('content/case.json', () => {
  const c = loadContent(raw);
  it('has four rounds of four options', () => {
    expect(c.rounds).toHaveLength(4);
    for (const r of c.rounds) expect(r.options.map(o => o.id)).toEqual(['A', 'B', 'C', 'D']);
  });
  it('scores evidence rounds only', () => {
    for (const r of c.rounds.slice(0, 3)) for (const o of r.options) expect(typeof o.score).toBe('number');
    for (const o of c.rounds[3].options) expect(o.score).toBeNull();
  });
  it('pins the spec scores', () => {
    const s = (ri: number) => c.rounds[ri].options.map(o => o.score);
    expect(s(0)).toEqual([60, 85, 20, 35]);
    expect(s(1)).toEqual([10, 60, 55, 70]);
    expect(s(2)).toEqual([50, 80, 40, 25]);
  });
  it('keeps phone labels and projector lines short, with debriefs on evidence rounds', () => {
    expect(c.rounds.map(r => r.id)).toEqual(['grid', 'debt', 'fog', 'core']);
    for (const r of c.rounds) for (const o of r.options) {
      expect(o.phone.length).toBeLessThanOrEqual(28);
      expect(o.projector.length).toBeLessThanOrEqual(130);
      if (o.score !== null) { expect(o.debrief.length).toBeGreaterThan(20); expect(o.projector.length).toBeGreaterThan(20); }
    }
  });
  it('has a complete synergy table', () => {
    for (const id of ['A', 'B', 'C', 'D'] as const) expect(c.synergy[id]).toHaveLength(3);
    expect(c.synergy.B).toEqual([['B'], ['B', 'D'], ['B']]);
  });
  it('has scoring constants, endings and exhibits', () => {
    expect(c.scoring).toMatchObject({ focusThreshold: 0.6, focusBonus: 15, exhibitBonus: 5, maxExhibits: 3, calloutBonus: 10, maxCallouts: 2, calloutPointsSpoke: 10, calloutPointsAwarded: 30, decisionBase: 50, synergyBonus: 15, speedBonusMax: 20, voteSeconds: 30, roundHp: 100 });
    expect(c.scoring.tiers).toEqual({ decisive: 260, fragile: 180 });
    expect(Object.keys(c.endings).sort()).toEqual(['A', 'B', 'C', 'D', 'holds']);
    expect(c.exhibits).toHaveLength(4);
    for (const set of c.exhibits) expect(set).toHaveLength(3);
  });
  it('rejects a broken file', () => {
    expect(() => loadContent({ ...raw, rounds: [] })).toThrow();
  });
});
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run tests/content.test.ts`
Expected: FAIL (module `../content/case.json` or `../shared/content` not found).

- [ ] **Step 5: Write `content/case.json`**

Encode spec section 5 verbatim. Shape:

```jsonc
{
  "title": "Olkaria: the Deadlock",
  "party": [ { "id": "engineer", "name": "The Engineer", "class": "Artificer", "lens": "power, latency, the site", "button": "A", "shape": "triangle", "color": "#b5473d" }, /* treasurer B diamond #3f6fa3, envoy C circle #c9a227, scout D square #4f8a5b */ ],
  "rounds": [
    { "id": "grid", "boss": "Grid Wyrm", "title": "How does Microsoft get its power?", "narration": "…spec 5.1…", "discuss": "Why did holding the 1 GW plan do so little damage?",
      "options": [ { "id": "A", "member": "engineer", "screen": "…", "phone": "Build our own geothermal", "score": 60, "debrief": "…full text from spec 5.1…", "projector": "…one line from spec 5.7…" }, /* B, C, D */ ] },
    /* debt (Debt Golem), fog (Fog of Demand), core (The core; member null, score null, debrief "", projector "") */
  ],
  "synergy": { "A": [["A","C"],["A","C"],["A","D"]], "B": [["B"],["B","D"],["B"]], "C": [["D"],["A"],["B"]], "D": [["A","B"],["C"],["A","B"]] },
  "endings": { "A": { "title": "Olkaria Colossus", "mustBeTrue": ["…"], "risk": ["…"] }, /* B, C, D */ "holds": { "title": "The Deadlock holds", "text": "Your board sends the team back to Nairobi." } },
  "exhibits": [ [ { "id": "t1a", "text": "Olkaria generates about 950 MW", "source": "James, 2026" }, /* … */ ], /* 4 sets of 3 (spec 5.5) */ ],
  "quotes": { "tanui": "…", "ruto": "…", "smith": "…" },
  "scoring": { "roundHp": 100, "focusThreshold": 0.6, "focusBonus": 15, "exhibitBonus": 5, "maxExhibits": 3, "calloutBonus": 10, "maxCallouts": 2, "calloutPointsSpoke": 10, "calloutPointsAwarded": 30, "decisionBase": 50, "synergyBonus": 15, "speedBonusMax": 20, "voteSeconds": 30, "tiers": { "decisive": 260, "fragile": 180 } }
}
```

Discuss lines: round 2 "Three live options and one dead one. Which of the live ones do you trust, and why?", round 3 "What would have to be true about demand for the early option to be right?", round 4 "What should Microsoft do, and why?".

- [ ] **Step 6: Write `shared/content.ts`**

`ContentSchema = z.object({...})` mirroring Step 5 with `z.enum(['A','B','C','D'])` for ids, `score: z.number().min(0).max(100).nullable()`, `phone: z.string().max(28)`, `projector: z.string().max(130)`, `rounds: z.array(round).length(4)`, each `options: z.array(option).length(4)`, `synergy: z.record(optionId, z.array(z.array(optionId)).length(3))`, `exhibits: z.array(z.array(exhibit).length(3)).length(4)`. `loadContent(raw) { return ContentSchema.parse(raw); }`. Export the two type aliases.

- [ ] **Step 7: Run the test, then type-check**

Run: `npx vitest run tests/content.test.ts && npx tsc --noEmit`
Expected: 7 tests PASS, tsc clean.

- [ ] **Step 8: Commit and push**

```bash
gh repo create C-lb/olkaria --private --source=. --remote=origin
git add -A && git commit -m "feat: scaffold repo, case content and schema" && git push -u origin main
```

---

### Task 2: Scoring

**Files:**
- Create: `shared/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes `CaseContent`, `RoundContent`, `SynergyTable` (Task 1), `Tally`, `OptionId`, `DamageResult`, `Player` (Task 1).
- Produces:
  - `shares(t: Tally): Record<OptionId, number>` (all 0 when total is 0)
  - `majorityOf(t: Tally): { majority: OptionId; tied: boolean }` (earliest letter on tie; all-zero is `A`, tied)
  - `synergyHits(final: OptionId, prior: (OptionId | null)[], table: SynergyTable): number`
  - `effectiveScores(content: CaseContent, roundIndex: number, prior: (OptionId | null)[]): Record<OptionId, number>`
  - `computeDamage(args: { content: CaseContent; roundIndex: number; tally: Tally; prior: (OptionId | null)[]; exhibits: number; rallies: number }): DamageResult` (`rallies` = call-outs judged convincing this round)
  - `speedBonus(responseMs: number, windowMs: number, max: number): number`
  - `pointsFor(args: { content: CaseContent; roundIndex: number; option: OptionId; responseMs: number; windowMs: number; prior: (OptionId | null)[] }): number`
  - `endingFor(args: { content: CaseContent; finalTally: Tally; totalDamage: number }): { ending: OptionId | 'holds'; tier: 'decisive' | 'fragile' | 'holds'; majority: OptionId }`
  - `consistencyAward(players: Player[], content: CaseContent): string | null`

- [ ] **Step 1: Write the failing tests**

```ts
// tests/scoring.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { shares, majorityOf, synergyHits, effectiveScores, computeDamage, speedBonus, pointsFor, endingFor, consistencyAward } from '../shared/scoring';
import type { Player } from '../shared/types';
const c = loadContent(raw);
const T = (A: number, B: number, C: number, D: number) => ({ A, B, C, D });

describe('shares and majority', () => {
  it('splits by total and handles zero', () => {
    expect(shares(T(4, 24, 4, 8))).toEqual({ A: 0.1, B: 0.6, C: 0.1, D: 0.2 });
    expect(shares(T(0, 0, 0, 0))).toEqual(T(0, 0, 0, 0));
  });
  it('picks the top option, earliest letter on tie', () => {
    expect(majorityOf(T(4, 24, 4, 8))).toEqual({ majority: 'B', tied: false });
    expect(majorityOf(T(5, 5, 1, 0))).toEqual({ majority: 'A', tied: true });
    expect(majorityOf(T(0, 0, 0, 0))).toEqual({ majority: 'A', tied: true });
  });
});

describe('synergy and effective scores', () => {
  it('counts coherent earlier majorities', () => {
    expect(synergyHits('B', ['B', 'D', 'B'], c.synergy)).toBe(3);
    expect(synergyHits('A', ['B', 'D', 'B'], c.synergy)).toBe(0);
    expect(synergyHits('C', ['B', 'D', 'B'], c.synergy)).toBe(1);
    expect(synergyHits('D', ['B', 'D', 'B'], c.synergy)).toBe(2);
    expect(synergyHits('B', [null, null, null], c.synergy)).toBe(0);
  });
  it('uses evidence scores for rounds 1 to 3 and 50 + 15 per hit for round 4', () => {
    expect(effectiveScores(c, 0, [])).toEqual(T(60, 85, 20, 35));
    expect(effectiveScores(c, 3, ['B', 'D', 'B'])).toEqual(T(50, 95, 65, 80));
  });
});

describe('computeDamage', () => {
  const dmg = (over: Partial<Parameters<typeof computeDamage>[0]>) =>
    computeDamage({ content: c, roundIndex: 0, tally: T(4, 24, 4, 8), prior: [], exhibits: 0, rallies: 0, ...over });
  it('matches the spec worked example for round 1', () => {
    const d = dmg({ exhibits: 2 });
    expect(d.base).toBeCloseTo(66, 5);
    expect(d.focus).toBe(15);
    expect(d.exhibit).toBe(10);
    expect(d.rally).toBe(0);
    expect(d.total).toBe(91);
    expect(d.majority).toBe('B');
    expect(d.perOption.B).toBeCloseTo(51, 5);
  });
  it('adds 10 per convincing call-out, capped at two', () => {
    expect(dmg({ rallies: 1 }).total).toBe(91);
    expect(dmg({ rallies: 1 }).rally).toBe(10);
    expect(dmg({ rallies: 5 }).rally).toBe(20);
    expect(dmg({ tally: T(10, 10, 10, 10), rallies: 1 }).total).toBe(60);
  });
  it('gives an even split 50 and no focus bonus', () => {
    const d = dmg({ tally: T(10, 10, 10, 10) });
    expect(d.total).toBe(50); expect(d.focus).toBe(0); expect(d.tied).toBe(true);
  });
  it('matches the spec worked example for round 4', () => {
    const d = dmg({ roundIndex: 3, tally: T(5, 25, 5, 5), prior: ['B', 'D', 'B'] });
    expect(d.base).toBeCloseTo(83.75, 5);
    expect(d.total).toBe(99);
  });
  it('caps exhibits at 3 and total at 100', () => {
    const d = dmg({ tally: T(0, 40, 0, 0), exhibits: 7 });
    expect(d.exhibit).toBe(15); expect(d.total).toBe(100);
  });
  it('handles an empty tally without NaN', () => {
    const d = dmg({ roundIndex: 1, tally: T(0, 0, 0, 0), prior: ['B'] });
    expect(d.total).toBe(0); expect(d.majority).toBe('A'); expect(d.tied).toBe(true);
    expect(Object.values(d.perOption).every(Number.isFinite)).toBe(true);
  });
});

describe('points and endings', () => {
  it('speed bonus is linear and clamped', () => {
    expect(speedBonus(6000, 30000, 20)).toBe(16);
    expect(speedBonus(0, 30000, 20)).toBe(20);
    expect(speedBonus(45000, 30000, 20)).toBe(0);
  });
  it('points are effective score plus speed', () => {
    expect(pointsFor({ content: c, roundIndex: 0, option: 'B', responseMs: 6000, windowMs: 30000, prior: [] })).toBe(101);
    expect(pointsFor({ content: c, roundIndex: 3, option: 'B', responseMs: 30000, windowMs: 30000, prior: ['B', 'D', 'B'] })).toBe(95);
  });
  it('picks the ending by final majority and total damage tier', () => {
    expect(endingFor({ content: c, finalTally: T(5, 25, 5, 5), totalDamage: 300 })).toEqual({ ending: 'B', tier: 'decisive', majority: 'B' });
    expect(endingFor({ content: c, finalTally: T(5, 25, 5, 5), totalDamage: 200 })).toEqual({ ending: 'B', tier: 'fragile', majority: 'B' });
    expect(endingFor({ content: c, finalTally: T(5, 25, 5, 5), totalDamage: 179 })).toEqual({ ending: 'holds', tier: 'holds', majority: 'B' });
  });
  it('awards consistency to the player with most own-synergy hits, ties by score', () => {
    const p = (id: string, picks: string, score: number): Player => ({
      id, name: id, joinedAt: 0, score, lastPoints: 0,
      votes: Object.fromEntries([...picks].map((o, i) => [i, { option: o, at: 0 }])) as Player['votes'],
    });
    expect(consistencyAward([p('x', 'BDBB', 10), p('y', 'ACAB', 500), p('z', 'BDB', 999)], c)).toBe('x');
    expect(consistencyAward([p('x', 'BDBB', 10), p('y', 'BDBB', 11)], c)).toBe('y');
    expect(consistencyAward([p('z', 'BDB', 999)], c)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL, `../shared/scoring` not found.

- [ ] **Step 3: Implement `shared/scoring.ts`**

Formulas from spec 4.4. `computeDamage`: `effective = effectiveScores(...)`, `sh = shares(tally)`, `perOption[o] = sh[o] * effective[o]`, `base = Σ perOption`, `{majority, tied} = majorityOf(tally)`, `focus = !tied && sh[majority] >= focusThreshold ? focusBonus : 0`, `exhibit = min(exhibits, maxExhibits) * exhibitBonus`, `rally = min(rallies, maxCallouts) * calloutBonus`, `total = clamp(round(base + focus + exhibit + rally), 0, 100)`. `speedBonus = clamp(round(max * (1 - responseMs / windowMs)), 0, max)`. `endingFor`: tiers from `content.scoring.tiers`; below fragile returns `ending: 'holds'`. `consistencyAward`: only players with votes for rounds 0 to 3; hits via `synergyHits(votes[3].option, [votes[0..2]])`; max hits, then max score; `null` if none qualify.

- [ ] **Step 4: Run tests and type-check**

Run: `npx vitest run tests/scoring.test.ts && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add shared/scoring.ts tests/scoring.test.ts && git commit -m "feat: scoring (damage, points, endings, consistency)" && git push
```

---

### Task 3: Names, room codes and the room reducer

**Files:**
- Create: `shared/names.ts`, `shared/codes.ts`, `shared/room-logic.ts`
- Test: `tests/names.test.ts`, `tests/codes.test.ts`, `tests/room-logic.test.ts`

**Interfaces:**
- Consumes everything from Tasks 1 and 2.
- Produces:
  - `generateName(seed: string): string` (two capitalised words from fixed lists, deterministic for a seed, for example "Steam Gecko")
  - `sanitizeName(raw: string | undefined, seed: string): string`
  - `makeRoomCode(rng: () => number): string`, `isValidCode(s: string): boolean`
  - `initialState(code: string, hostKey: string, now: number, content: CaseContent): RoomState`
  - `reduce(state: RoomState, ev: RoomEvent, content: CaseContent): { state: RoomState; effects: Effect[] }` (pure; never mutates the input)
  - `tallyFor(state: RoomState, round: number): Tally`
  - `hostView(state: RoomState, now: number): HostView`
  - `playerView(state: RoomState, clientId: string, now: number): PlayerView | null`

- [ ] **Step 1: Write the failing name and code tests**

```ts
// tests/names.test.ts
import { it, expect } from 'vitest';
import { generateName, sanitizeName } from '../shared/names';
it('generates a stable two-word name per seed', () => {
  expect(generateName('abc')).toBe(generateName('abc'));
  expect(generateName('abc').split(' ')).toHaveLength(2);
  expect(generateName('abc')).not.toBe(generateName('abd'));
});
it('sanitises names', () => {
  expect(sanitizeName('  Sarah\u0007  ', 's')).toBe('Sarah');
  expect(sanitizeName('AVeryLongNameIndeed', 's')).toBe('AVeryLongNameInd');
  expect(sanitizeName('', 's')).toBe(generateName('s'));
  expect(sanitizeName(undefined, 's')).toBe(generateName('s'));
});
```

```ts
// tests/codes.test.ts
import { it, expect } from 'vitest';
import { makeRoomCode, isValidCode } from '../shared/codes';
it('makes 4-letter codes without I or O', () => {
  for (let i = 0; i < 200; i++) {
    const code = makeRoomCode(Math.random);
    expect(code).toMatch(/^[A-HJ-NP-Z]{4}$/);
    expect(isValidCode(code)).toBe(true);
  }
  expect(isValidCode('ABIO')).toBe(false);
  expect(isValidCode('abcd')).toBe(false);
  expect(isValidCode('ABCDE')).toBe(false);
});
```

- [ ] **Step 2: Write the failing reducer tests**

```ts
// tests/room-logic.test.ts
import { describe, it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { initialState, reduce, tallyFor, hostView, playerView } from '../shared/room-logic';
import type { RoomState, RoomEvent, HostCmd } from '../shared/types';
const c = loadContent(raw);
const KEY = 'host-secret';
const t0 = 1_000_000;
const mk = () => initialState('ABCD', KEY, t0, c);
const cmd = (s: RoomState, k: HostCmd, now = t0, key = KEY) => reduce(s, { type: 'cmd', key, cmd: k, now }, c);
const run = (s: RoomState, evs: RoomEvent[]) => evs.reduce((acc, ev) => reduce(acc.state, ev, c), { state: s, effects: [] as any[] });
const join = (id: string, name?: string, now = t0): RoomEvent => ({ type: 'join', clientId: id, name, now });
const vote = (id: string, round: number, option: any, now = t0 + 6000): RoomEvent => ({ type: 'vote', clientId: id, round, option, now });
const toVote = () => run(mk(), [join('p1', 'Ann'), join('p2'), join('p3', 'Cy'), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, { type: 'cmd', key: KEY, cmd: { k: 'openVote' }, now: t0 }]).state;

describe('lobby and joins', () => {
  it('starts in lobby with full boss hp and round -1', () => {
    const s = mk();
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400); expect(s.voteWindowMs).toBe(30000);
  });
  it('joins keep identity on rejoin and generate names', () => {
    const s = run(mk(), [join('p1', 'Ann'), join('p2'), join('p1', 'Other')]).state;
    expect(Object.keys(s.players)).toHaveLength(2);
    expect(s.players.p1.name).toBe('Ann');
    expect(s.players.p2.name.split(' ')).toHaveLength(2);
  });
  it('rejects host commands with a bad key', () => {
    const r = cmd(mk(), { k: 'start' }, t0, 'wrong');
    expect(r.state.phase).toBe('lobby');
    expect(r.effects).toContainEqual({ type: 'error', msg: 'bad host key' });
  });
});

describe('vote window', () => {
  it('openVote sets a deadline and an alarm', () => {
    const r = cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' });
    expect(r.state.phase).toBe('vote'); expect(r.state.round).toBe(0);
    expect(r.state.voteDeadline).toBe(t0 + 30000);
    expect(r.effects).toContainEqual({ type: 'setAlarm', at: t0 + 30000 });
  });
  it('counts one vote per player, first vote locks, rejoin cannot revote', () => {
    const s = run(toVote(), [vote('p1', 0, 'B'), vote('p1', 0, 'A'), join('p1', 'Ann'), vote('p1', 0, 'C'), vote('p2', 0, 'B')]).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0, D: 0 });
  });
  it('rejects votes for the wrong round, unknown players, and outside the vote phase', () => {
    const s = toVote();
    expect(reduce(s, vote('p1', 1, 'B'), c).effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'wrong round' });
    expect(reduce(s, vote('ghost', 0, 'B'), c).effects).toContainEqual({ type: 'error', clientId: 'ghost', msg: 'unknown player' });
    const locked = cmd(s, { k: 'closeVote' }).state;
    expect(tallyFor(reduce(locked, vote('p1', 0, 'B'), c).state, 0).B).toBe(0);
  });
  it('tick at the deadline locks the vote and later votes are rejected', () => {
    const s = toVote();
    const ticked = reduce(s, { type: 'tick', now: t0 + 30000 }, c);
    expect(ticked.state.phase).toBe('locked');
    expect(ticked.effects).toContainEqual({ type: 'clearAlarm' });
    const late = reduce(ticked.state, vote('p2', 0, 'B', t0 + 30500), c);
    expect(tallyFor(late.state, 0).B).toBe(0);
  });
  it('tick before the deadline does nothing', () => {
    const s = toVote();
    expect(reduce(s, { type: 'tick', now: t0 + 1000 }, c).state.phase).toBe('vote');
  });
  it('injectVotes adds synthetic votes that never appear as players', () => {
    const s = cmd(toVote(), { k: 'injectVotes', counts: { B: 10, D: 2 } }).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 10, C: 0, D: 2 });
    expect(Object.keys(s.players)).toHaveLength(3);
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' });
    expect(cmd(r.state, { k: 'injectVotes', counts: { A: 5 } }).effects).toContainEqual({ type: 'error', msg: 'not accepting votes' });
  });
  it('reopen returns a locked round to vote with a fresh deadline, extends an open one, and is refused elsewhere', () => {
    const locked = cmd(toVote(), { k: 'closeVote' }).state;
    const r = cmd(locked, { k: 'reopen' }, t0 + 40000);
    expect(r.state.phase).toBe('vote'); expect(r.state.voteDeadline).toBe(t0 + 70000); expect(r.state.voteOpenedAt).toBe(t0);
    const e = cmd(toVote(), { k: 'reopen' }, t0 + 10000);
    expect(e.state.voteDeadline).toBe(t0 + 40000); expect(e.effects).toContainEqual({ type: 'setAlarm', at: t0 + 40000 });
    expect(cmd(mk(), { k: 'reopen' }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
  });
});

describe('call-outs', () => {
  const locked = () => cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'closeVote' }).state;
  it('picks a random voter deterministically from the pick number, only in locked', () => {
    const s = locked();
    expect(cmd(toVote(), { k: 'callout', pick: 0.1 }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
    const a = cmd(s, { k: 'callout', pick: 0.1 }).state.callouts[0][0];
    const b = cmd(s, { k: 'callout', pick: 0.9 }).state.callouts[0][0];
    expect(new Set([a.playerId, b.playerId])).toEqual(new Set(['p1', 'p2']));
    expect(a.status).toBe('pending'); expect(a.option).toBe(s.players[a.playerId!].votes[0].option);
  });
  it('never picks a non-voter or the same player twice, and allows an explicit pick', () => {
    const s = cmd(locked(), { k: 'callout', playerId: 'p1' }).state;
    expect(s.callouts[0][0].playerId).toBe('p1');
    const judged = cmd(s, { k: 'judge', awarded: true }).state;
    const second = cmd(judged, { k: 'callout', pick: 0.5 }).state;
    expect(second.callouts[0][1].playerId).toBe('p2');  // p3 did not vote, p1 already called
  });
  it('refuses a call-out while one is pending and after two in a round', () => {
    const s = cmd(locked(), { k: 'callout', pick: 0.2 }).state;
    expect(cmd(s, { k: 'callout', pick: 0.2 }).effects).toContainEqual({ type: 'error', msg: 'call-out pending' });
    let t = cmd(s, { k: 'judge', awarded: false }).state;
    t = cmd(cmd(t, { k: 'callout', pick: 0.2 }).state, { k: 'judge', awarded: true }).state;
    expect(cmd(t, { k: 'callout', pick: 0.2 }).effects).toContainEqual({ type: 'error', msg: 'call-out limit' });
    expect(cmd(t, { k: 'judge', awarded: true }).effects).toContainEqual({ type: 'error', msg: 'no pending call-out' });
  });
  it('falls back to a nameless hand call-out when nobody is eligible', () => {
    const s = cmd(cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state, { k: 'closeVote' }).state;
    const co = cmd(s, { k: 'callout', pick: 0.3 }).state.callouts[0][0];
    expect(co.playerId).toBeNull(); expect(co.option).toBeNull(); expect(co.status).toBe('pending');
  });
  it('judging sets call-out points; reveal adds rally damage and the points, pending counts as declined', () => {
    const s = cmd(cmd(locked(), { k: 'callout', playerId: 'p1' }).state, { k: 'judge', awarded: true }).state;
    expect(s.callouts[0][0]).toMatchObject({ status: 'awarded', points: 30 });
    const t = cmd(s, { k: 'callout', playerId: 'p2' }).state;           // left pending on purpose
    const r = cmd(t, { k: 'reveal' }).state;
    // shares A 1/2, B 1/2: base = 30 + 42.5 = 72.5, no focus, rally 10 -> 83 (82.5 rounds to 83)
    expect(r.damageLog[0].rally).toBe(10); expect(r.damageLog[0].total).toBe(83);
    expect(r.callouts[0][1]).toMatchObject({ status: 'declined', points: 10 });
    expect(r.players.p1.lastPoints).toBe(85 + 16 + 30);
    expect(r.players.p2.lastPoints).toBe(60 + 16 + 10);
  });
});

describe('reveal and scoring', () => {
  const revealed = () => {
    const s = run(toVote(), [vote('p1', 0, 'B', t0 + 6000), vote('p2', 0, 'B', t0 + 6000), vote('p3', 0, 'A', t0 + 15000)]).state;
    const withExhibit = { ...s, exhibits: { 0: ['t1a', 't1b'] } };
    return cmd(cmd(withExhibit, { k: 'closeVote' }).state, { k: 'reveal' }).state;
  };
  it('applies damage, records the majority, awards points', () => {
    const s = revealed();
    const d = s.damageLog[0];
    // shares A 1/3, B 2/3: base = 20 + 56.667 = 76.667, focus 15 (B at 66%), exhibit 10 -> 102 -> capped 100
    expect(d.total).toBe(100);
    expect(s.bossHp).toBe(300);
    expect(s.majorities[0]).toBe('B');
    expect(s.players.p1.lastPoints).toBe(85 + 16); expect(s.players.p1.score).toBe(101);
    expect(s.players.p3.lastPoints).toBe(60 + 10);
  });
  it('reveals an empty round without NaN and without damage', () => {
    const s = cmd(cmd(toVote(), { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(s.damageLog[0].total).toBe(0); expect(s.bossHp).toBe(400);
    expect(s.players.p1.lastPoints).toBe(0);
  });
  it('next advances through travel to the next round, then ending, then leaderboard', () => {
    let s = cmd(revealed(), { k: 'next' }).state;
    expect(s.phase).toBe('travel'); expect(s.round).toBe(1);
    for (let r = 1; r <= 3; r++) s = cmd(cmd(cmd(cmd(s, { k: 'openVote' }).state, { k: 'closeVote' }).state, { k: 'reveal' }).state, { k: 'next' }).state;
    expect(s.phase).toBe('ending');
    expect(cmd(s, { k: 'next' }).state.phase).toBe('leaderboard');
  });
  it('exhibit collects at most three per round and only in travel', () => {
    let s = cmd(mk(), { k: 'start' }).state;
    for (const id of ['a', 'b', 'c', 'd']) s = cmd(s, { k: 'exhibit', exhibitId: id }).state;
    expect(s.exhibits[0]).toEqual(['a', 'b', 'c']);
    expect(cmd(cmd(s, { k: 'openVote' }).state, { k: 'exhibit', exhibitId: 'e' }).effects).toContainEqual({ type: 'error', msg: 'not in travel' });
  });
  it('kick removes a player and their votes from the tally', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const k = cmd(s, { k: 'kick', playerId: 'p1' }).state;
    expect(k.players.p1).toBeUndefined(); expect(tallyFor(k, 0).B).toBe(0);
  });
  it('reset returns to lobby keeping players but clearing scores and damage', () => {
    const s = cmd(revealed(), { k: 'reset' }).state;
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400);
    expect(Object.keys(s.players)).toHaveLength(3); expect(s.players.p1.score).toBe(0); expect(s.damageLog).toEqual([]);
  });
});

describe('views', () => {
  it('host view hides the key and carries the current tally', () => {
    const v = hostView(toVote(), t0 + 1);
    expect((v as any).hostKey).toBeUndefined(); expect(v.tally).toEqual({ A: 0, B: 0, C: 0, D: 0 }); expect(v.serverNow).toBe(t0 + 1);
  });
  it('player view hides the tally until reveal and ranks players', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const v = playerView(s, 'p1', t0 + 1)!;
    expect(v.tally).toBeNull(); expect(v.myVote).toBe('B'); expect(v.playerCount).toBe(3); expect(v.rank).toBe(1); expect(v.callout).toBeNull();
    expect(v.picks).toEqual(['B']);
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(playerView(r, 'p1', t0)!.tally).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(playerView(r, 'p2', t0)!.rank).toBe(2);
    expect(playerView(r, 'p2', t0)!.picks).toEqual([null]);
    expect(playerView(mk(), 'p1', t0)).toBeNull();
    expect(playerView(r, 'nobody', t0)).toBeNull();
  });
  it('player view carries the pending call-out and flags the called player', () => {
    const s = cmd(cmd(run(toVote(), [vote('p1', 0, 'B')]).state, { k: 'closeVote' }).state, { k: 'callout', playerId: 'p1' }).state;
    expect(playerView(s, 'p1', t0)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: true });
    expect(playerView(s, 'p3', t0)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: false });
    expect(hostView(s, t0).callouts[0][0].playerId).toBe('p1');
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run tests/names.test.ts tests/codes.test.ts tests/room-logic.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `shared/names.ts` and `shared/codes.ts`**

`names.ts`: two word lists of 24 each (first: Steam, Rift, Olkaria, Savanna, Geothermal, Baseload, Acacia, Silicon, Nairobi, Azure, Pylon, Ochre…; second: Gecko, Giraffe, Heron, Weaver, Mongoose, Hornbill, Ibis, Zebra, Dikdik, Crane, Serval, Oryx…), a small string hash (FNV-1a 32-bit) over the seed to index both. `sanitizeName`: strip `[\u0000-\u001f\u007f]`, trim, slice 16, fallback to `generateName(seed)` when empty. `codes.ts`: alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ`, `isValidCode = /^[A-HJ-NP-Z]{4}$/`.

- [ ] **Step 5: Implement `shared/room-logic.ts`**

Transitions exactly as spec 6.2. Errors as effects with these messages: `'bad host key'`, `'wrong round'`, `'unknown player'`, `'already voted'`, `'not accepting votes'`, `'not in travel'`, `'bad phase'`, `'call-out pending'`, `'call-out limit'`, `'no pending call-out'`. `tallyFor` sums real votes for that round plus `synthetic[round]`. Call-out: eligible = players with a vote for the current round whose id is not in `callouts[round]`; explicit `playerId` wins if eligible; otherwise index `floor(pick * eligible.length)` over eligible ids sorted by `joinedAt` then id; no eligible players → `{ playerId: null, option: null }`. Judge: sets the pending call-out's `status` and `points` (`calloutPointsAwarded` or `calloutPointsSpoke`). Reveal: any pending call-out becomes `declined` with `calloutPointsSpoke`; `rallies = count(status === 'awarded')`; `prior = state.majorities.slice(0, round)`; `exhibits = (state.exhibits[round] ?? []).length`; `computeDamage`; `bossHp = max(0, bossHp - total)`; per player `lastPoints = pointsFor(...) + Σ callout points for that player this round` with `responseMs = vote.at - voteOpenedAt`, `windowMs = voteWindowMs`; players without a vote get `lastPoints = 0` (plus any call-out points, which cannot occur since only voters are called). `openVote` uses `seconds ?? content.scoring.voteSeconds`. `reopen`: from `locked` set `phase = 'vote'`, `voteDeadline = now + voteWindowMs`, keep `voteOpenedAt`, effect `setAlarm`; from `vote` only move the deadline and re-arm the alarm; otherwise `'bad phase'`. `playerView.rank = 1 + count(players with score strictly greater)`; `playerView.picks` has one entry per round from 0 to `state.round` (empty in the lobby), each the player's option or `null`; `playerView.callout` is the pending call-out of the current round or `null`, with `name` from the player (or `null` for a hand call-out). Always return new objects; a test `expect(reduce(s, ev, c).state).not.toBe(s)` is implied.

- [ ] **Step 6: Run tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 7: Commit and push**

```bash
git add shared tests && git commit -m "feat: room reducer, names, room codes" && git push
```

---

### Task 4: Cloudflare Worker and Durable Object

**Files:**
- Create: `wrangler.jsonc`, `worker/index.ts`, `worker/room.ts`
- Create: `scripts/simulate-class.ts`
- Modify: `package.json` (nothing new; `dev:worker`, `deploy`, `simulate` already defined)

**Interfaces:**
- Consumes `reduce`, `initialState`, `hostView`, `playerView` (Task 3), `makeRoomCode` (Task 3), `loadContent` (Task 1), message types (Task 1).
- Produces HTTP: `POST /api/rooms → 201 { code, hostKey, joinUrl }`; `GET /ws/:code?role=host&key=…` and `GET /ws/:code?role=player&clientId=…` → WebSocket; `GET /j/:code` → player page HTML; `GET /` → 302 `/host/`. Produces WebSocket protocol: client sends `ClientMsg` JSON, server sends `ServerMsg` JSON; the host receives `{ t: 'host', state }` after every change, each player receives `{ t: 'you', view }`.
- Produces `scripts/simulate-class.ts`: `npm run simulate -- --base http://localhost:8787 --code ABCD --n 60`.

- [ ] **Step 1: Write `wrangler.jsonc`**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "olkaria",
  "main": "worker/index.ts",
  "compatibility_date": "2025-09-01",
  "assets": { "directory": "./dist", "binding": "ASSETS", "run_worker_first": ["/", "/api/*", "/ws/*", "/j/*"] },
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }],
  "observability": { "enabled": true }
}
```

- [ ] **Step 2: Implement `worker/room.ts`**

`export class Room extends DurableObject<Env>` with:
- `fetch(req)`: `POST /init` body `{ code, hostKey }` → store `initialState(...)` (content imported from `../content/case.json` through `loadContent`); `GET` with `Upgrade: websocket` → `new WebSocketPair()`, `ws.serializeAttachment({ role, clientId, key })`, `this.ctx.acceptWebSocket(server, [role === 'host' ? 'host' : 'player'])`, reply 101. Reject a host upgrade whose key does not match with 403.
- `webSocketMessage(ws, raw)`: parse `ClientMsg`; map `join` → `{type:'join'}`, `vote` → `{type:'vote', clientId: attachment.clientId}`, `cmd` → `{type:'cmd', key: msg.key}` (for `callout` without `pick`, set `pick: Math.random()` here); `apply(event)`.
- `apply(event)`: `reduce`, `storage.put('state', state)`, run effects (`setAlarm` → `storage.setAlarm(at)`, `clearAlarm` → `storage.deleteAlarm()`, `error` → send `{t:'error'}` to the socket whose attachment `clientId` matches, or to the host for host errors), then `broadcast()`.
- `broadcast()`: `now = Date.now()`; host sockets get `{ t: 'host', state: hostView(state, now) }`; each player socket gets `{ t: 'you', view: playerView(state, clientId, now) }` (skip when `null`).
- `alarm()`: `apply({ type: 'tick', now: Date.now() })`; if the state has not changed in 6 hours, `storage.deleteAll()`.
- `webSocketClose`: nothing to do (identity is the client id, presence is not tracked).

- [ ] **Step 3: Implement `worker/index.ts`**

Routes as in the Interfaces block. Room creation: `code = makeRoomCode(Math.random)`, `hostKey = crypto.randomUUID()`, `stub = env.ROOM.get(env.ROOM.idFromName(code))`, `await stub.fetch('https://room/init', { method: 'POST', body })`, `joinUrl = new URL('/j/' + code, req.url).toString()`. `/ws/:code`: validate with `isValidCode`, forward the request to the stub. `/j/:code`: `env.ASSETS.fetch(new Request(new URL('/player/index.html', req.url), req))`. `/`: 302 to `/host/`. Anything else: `env.ASSETS.fetch(req)`.

- [ ] **Step 4: Write `scripts/simulate-class.ts`**

Parse `--base`, `--code`, `--n` (default 60). For each i: `new WebSocket(base.replace('http', 'ws') + '/ws/' + code + '?role=player&clientId=sim-' + i)`, send `join` with name `Sim ${i}`. On `{t:'you'}` with `phase === 'vote'` and `myVote === null`, schedule a vote after `Math.random() * 20000` ms for a random option weighted 1:3:1:2 (A:B:C:D). Log `joined N`, and per round `round r: votes sent`. Exit on `phase === 'leaderboard'`.

- [ ] **Step 5: Smoke test locally**

Build placeholder pages so assets exist: create minimal `host/index.html` and `player/index.html` containing only `<!doctype html><title>Olkaria</title><p>placeholder</p>` (Tasks 5 and 7 replace them), run `npm run build`, then `npm run dev:worker`.
In a second terminal: `curl -s -X POST http://localhost:8787/api/rooms` → expect `{"code":"XXXX","hostKey":"…","joinUrl":"http://localhost:8787/j/XXXX"}`.
Then `npm run simulate -- --base http://localhost:8787 --code XXXX --n 60` → expect `joined 60`.
Then with a host socket (use `npx wscat -c "ws://localhost:8787/ws/XXXX?role=host&key=HOSTKEY"`): send `{"t":"cmd","key":"HOSTKEY","cmd":{"k":"start"}}`, then `openVote`, wait 30 s, then `reveal`. Expected: the host receives state messages; after 30 s the phase is `locked` without a `closeVote` (alarm fired); after `reveal`, `damageLog[0].total` is between 50 and 100 and `players` has 60 entries.

- [ ] **Step 6: Type-check and commit**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean.

```bash
git add wrangler.jsonc worker scripts host/index.html player/index.html && git commit -m "feat: worker, durable object room, class simulator" && git push
```

---

### Task 5: Player page (phone)

**Files:**
- Create: `player/index.html`, `player/main.ts`, `player/net.ts`, `player/render.ts`, `player/styles.css`
- Test: `tests/player-render.test.ts` (`// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes `PlayerView`, `ClientMsg`, `ServerMsg` (Task 1), `CaseContent` (Task 1), WebSocket protocol (Task 4).
- Produces `player/render.ts`: `render(root: HTMLElement, view: PlayerView | null, content: CaseContent, ui: UiState, actions: Actions): void` where `UiState = { status: 'connecting' | 'joining' | 'joined' | 'kicked' | 'offline'; name: string }` and `Actions = { join(name: string): void; vote(option: OptionId): void }`. The join button stays disabled until the trimmed name has at least one character; the input has `maxlength="16"`. Also `formatCountdown(deadline: number, serverNow: number, localNow: number, localAtServerNow: number): string` (returns `"23 s"`, never negative).
- Produces `player/net.ts`: `class PlayerSocket { constructor(code: string, clientId: string); onView(cb: (v: PlayerView) => void): void; onStatus(cb: (s: 'open' | 'closed') => void): void; send(msg: ClientMsg): void }` with exponential reconnect (1 s, 2 s, 4 s, max 10 s) and a re-sent `join` on every open.

- [ ] **Step 1: Invoke the anti-vibecode skill and read `references/components.md` and `references/states.md`**

- [ ] **Step 2: Write the failing render tests**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { render, formatCountdown } from '../player/render';
import type { PlayerView } from '../shared/types';
const c = loadContent(raw);
const base: PlayerView = { phase: 'vote', round: 0, serverNow: 1000, voteDeadline: 31000, voteWindowMs: 30000, name: 'Ann', myVote: null, lastPoints: 0, score: 0, rank: 1, playerCount: 12, tally: null, majorities: [], picks: [], callout: null };
const noop = { join: vi.fn(), vote: vi.fn() };
const mount = () => { const el = document.createElement('div'); document.body.appendChild(el); return el; };

describe('player render', () => {
  it('shows the join form before joining and requires a name', () => {
    const el = mount(); render(el, null, c, { status: 'joining', name: '' }, noop);
    const input = el.querySelector('input[name=nickname]') as HTMLInputElement;
    const button = el.querySelector('button') as HTMLButtonElement;
    expect(input.maxLength).toBe(16);
    expect(button.textContent).toMatch(/join/i);
    expect(button.disabled).toBe(true);
    input.value = 'Sarah'; input.dispatchEvent(new Event('input'));
    expect(button.disabled).toBe(false);
  });
  it('shows the call-out to the called player and to everyone else', () => {
    const el = mount();
    render(el, { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } }, c, { status: 'joined', name: 'Ann' }, noop);
    expect(el.textContent).toMatch(/You're up/);
    expect(el.textContent).toContain('Start small, 24 to 60 MW');
    render(el, { ...base, phase: 'locked', myVote: 'A', callout: { name: 'Ann', option: 'B', isMe: false } }, c, { status: 'joined', name: 'Cy' }, noop);
    expect(el.textContent).toContain('Ann is defending B');
  });
  it('renders four vote buttons with phone labels and sends a vote', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn() };
    render(el, base, c, { status: 'joined', name: 'Ann' }, actions);
    const buttons = [...el.querySelectorAll('button[data-option]')];
    expect(buttons.map(b => b.getAttribute('data-option'))).toEqual(['A', 'B', 'C', 'D']);
    expect(buttons[1].textContent).toContain('Start small, 24 to 60 MW');
    (buttons[1] as HTMLButtonElement).click();
    expect(actions.vote).toHaveBeenCalledWith('B');
  });
  it('shows the locked state after voting and the result after reveal', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, { status: 'joined', name: 'Ann' }, noop);
    expect(el.textContent).toContain('Locked');
    expect(el.querySelectorAll('button[data-option]')).toHaveLength(0);
    render(el, { ...base, phase: 'reveal', myVote: 'B', picks: ['B'], lastPoints: 101, score: 101, rank: 3, tally: { A: 1, B: 9, C: 1, D: 1 } }, c, { status: 'joined', name: 'Ann' }, noop);
    expect(el.textContent).toContain('101');
    expect(el.textContent).toMatch(/3(rd)? of 12/);
    expect(el.textContent).toContain(c.rounds[0].options[1].debrief.slice(0, 40));
  });
  it('summarises the four picks at the end', () => {
    const el = mount();
    render(el, { ...base, phase: 'ending', round: 3, picks: ['B', 'D', 'B', 'B'], majorities: ['B', 'D', 'B', 'B'], score: 400, rank: 2 }, c, { status: 'joined', name: 'Ann' }, noop);
    expect(el.textContent).toMatch(/B.*D.*B.*B/s);
    expect(el.textContent).toMatch(/3 of 3/);   // synergy hits of the player's own picks
  });
  it('tells a kicked or offline player plainly', () => {
    const el = mount(); render(el, null, c, { status: 'kicked', name: 'Ann' }, noop);
    expect(el.textContent).toMatch(/removed/i);
  });
});
it('formats the countdown from server time, never negative', () => {
  expect(formatCountdown(31000, 1000, 5000, 1000)).toBe('26 s');
  expect(formatCountdown(31000, 1000, 99000, 1000)).toBe('0 s');
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run tests/player-render.test.ts`
Expected: FAIL, `../player/render` not found.

- [ ] **Step 4: Implement `player/render.ts`**

One function per state, each returning an element: `joinForm` (input `name="nickname"`, `maxlength=16`, `required`, button disabled until the trimmed value is non-empty), `waiting` ("You're in as {name}. Watch the screen."), `voteButtons` (letter, inline SVG shape, phone label; `data-option`), `locked` ("Locked: {letter}. {phone label}"), `calledOut` ("You're up. Defend {letter}: {phone label}." and `navigator.vibrate?.(200)`), `someoneCalled` ("{name} is defending {letter}." or "Someone is defending their choice." when `name` is null), `result` ("+{lastPoints} this round", "{score} total", "{rank} of {playerCount}"; ordinal suffix helper; then "Why {letter} scored what it did" with the full `debrief` of the player's option from `content.rounds[view.round]`, or "You did not vote this round." when `myVote` is null), `ending` (the four `picks` as letters with phone labels, "Coherence: {hits} of 3" via `synergyHits(picks[3], picks.slice(0, 3), content.synergy)`, rank), `kicked` ("You were removed from the room."), `offline` ("Reconnecting…"). Phase mapping: `lobby|travel` → waiting; `vote` → voteButtons or locked; `locked` → calledOut when `callout?.isMe`, someoneCalled when `callout` is set, else locked (or "You did not vote this round."); `reveal` → result; `ending|leaderboard` → ending. `render` clears `root` and appends the chosen element.

- [ ] **Step 5: Implement `player/net.ts`, `player/main.ts`, `player/index.html`, `player/styles.css`**

`main.ts`: code from `location.pathname.match(/\/j\/([A-Z]{4})/)`, client id from `localStorage['olkaria.clientId']` (create with `crypto.randomUUID()`), name draft from `localStorage['olkaria.name']`; on join submit, store the name and send `join`; re-render on every view; countdown tick every 250 ms while `phase === 'vote'`. `index.html`: viewport meta, `<main id="app">`, DM Sans from Google Fonts or system sans. `styles.css`: anti-vibecode tokens, 17 px base, flat buttons with dim stroke, four option buttons full width, 64 px tall, `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` on labels, muted option fills (`#b5473d`, `#3f6fa3`, `#c9a227`, `#4f8a5b`) with white letter and shape, `:active` darkens 8%, disabled greys out.

- [ ] **Step 6: Run tests, build, check bundle size**

Run: `npx vitest run tests/player-render.test.ts && npm run build && ls -la dist/assets | grep player`
Expected: tests PASS; the player JS bundle under 100 KB (gzip not required).

- [ ] **Step 7: Manual check on a phone**

`npm run dev:worker`, create a room with curl (Task 4 Step 5), open `http://<laptop-lan-ip>:8787/j/CODE` on a phone (or use `wrangler dev --ip 0.0.0.0`), join, then drive the host with `wscat`: open the vote, tap B, confirm the phone shows "Locked: B", reveal, confirm points appear. Reload the phone mid-vote: it must show "Locked: B" again, not fresh buttons.

- [ ] **Step 8: Commit and push**

```bash
git add player tests/player-render.test.ts && git commit -m "feat: phone voting page" && git push
```

---

### Task 6: Host networking: online client, offline client, session memory

**Files:**
- Create: `host/net.ts`, `host/session.ts`
- Test: `tests/offline-client.test.ts`, `tests/session.test.ts` (`// @vitest-environment happy-dom` for session)

**Interfaces:**
- Consumes `reduce`, `initialState`, `hostView`, `tallyFor` (Task 3), `effectiveScores` (Task 2), types (Task 1), HTTP and WS protocol (Task 4).
- Produces:
  ```ts
  export interface RoomClient {
    readonly mode: 'online' | 'offline';
    connect(): Promise<{ code: string; joinUrl: string }>;
    send(cmd: HostCmd): void;
    onState(cb: (view: HostView) => void): () => void;
    onError(cb: (msg: string) => void): () => void;
    addBots(n: number): void;          // online: injectVotes weighted; offline: same
  }
  export class WsRoomClient implements RoomClient { constructor(baseUrl: string) }
  export class OfflineRoomClient implements RoomClient { constructor(content: CaseContent, now?: () => number) }
  export function createRoomClient(loc: Location, content: CaseContent): RoomClient   // ?mode=offline → Offline
  export function botTally(content: CaseContent, roundIndex: number, prior: (OptionId | null)[], n: number, rng: () => number): Tally
  ```
  and `host/session.ts`: `rememberRoom(code: string, hostKey: string): void`, `recallRoom(): { code: string; hostKey: string } | null`, `forgetRoom(): void` over `sessionStorage['olkaria.room']`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/offline-client.test.ts
import { it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { OfflineRoomClient, botTally } from '../host/net';
const c = loadContent(raw);
it('runs the state machine locally and reports views', async () => {
  let t = 0; const client = new OfflineRoomClient(c, () => t);
  const views: any[] = []; client.onState(v => views.push(v));
  const { code } = await client.connect();
  expect(code).toBe('OFFLINE');
  client.send({ k: 'start' }); client.send({ k: 'openVote' });
  client.send({ k: 'injectVotes', counts: { B: 3 } });
  expect(views.at(-1).phase).toBe('vote'); expect(views.at(-1).tally.B).toBe(3);
  t = 31000; client.tick();
  expect(views.at(-1).phase).toBe('locked');
  client.send({ k: 'reveal' });
  expect(views.at(-1).damageLog[0].total).toBe(100); // all on B (85) + focus 15
});
it('bot votes lean toward the strongest option', () => {
  const t = botTally(c, 0, [], 1000, Math.random);
  expect(t.A + t.B + t.C + t.D).toBe(1000);
  expect(t.B).toBeGreaterThan(t.C);
});
```

```ts
// @vitest-environment happy-dom
import { it, expect } from 'vitest';
import { rememberRoom, recallRoom, forgetRoom } from '../host/session';
it('remembers and forgets the room for this tab', () => {
  expect(recallRoom()).toBeNull();
  rememberRoom('ABCD', 'k'); expect(recallRoom()).toEqual({ code: 'ABCD', hostKey: 'k' });
  forgetRoom(); expect(recallRoom()).toBeNull();
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/offline-client.test.ts tests/session.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `host/session.ts` and `host/net.ts`**

`OfflineRoomClient`: holds `state = initialState('OFFLINE', 'offline', now(), content)`; `send(cmd)` → `reduce` with key `'offline'` (a `callout` without `pick` gets `pick: Math.random()`); `tick()` public, also called by a 250 ms `setInterval` started in `connect()`; emits `hostView(state, now())` after every reduce; errors emit via `onError`. `botTally`: weights `effectiveScores(...)[o] + 10`, sample `n` votes with `rng`. `addBots(n)` → `send({ k: 'injectVotes', counts: botTally(...) })` using the current round and `state.majorities`. `WsRoomClient.connect()`: `recallRoom()` or `POST /api/rooms` then `rememberRoom`; open `/ws/:code?role=host&key=…`; reconnect with backoff; `send` wraps as `{ t: 'cmd', key, cmd }`; `{t:'host'}` → `onState`, `{t:'error'}` → `onError`. `createRoomClient`: `new URLSearchParams(loc.search).get('mode') === 'offline'` → offline, else `new WsRoomClient(loc.origin)`.

- [ ] **Step 4: Run tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add host/net.ts host/session.ts tests/offline-client.test.ts tests/session.test.ts && git commit -m "feat: host room clients (online, offline, bots)" && git push
```

---

### Task 7: Phaser bootstrap, HTML HUD, integer zoom, router, Lobby scene, hotkeys

**Files:**
- Create: `host/index.html`, `host/main.ts`, `host/scale.ts`, `host/router.ts`, `host/hotkeys.ts`, `host/hud/Hud.ts`, `host/hud/hud.css`, `host/art/placeholders.ts`, `host/scenes/Boot.ts`, `host/scenes/Lobby.ts`
- Test: `tests/scale.test.ts`, `tests/router.test.ts`, `tests/hud.test.ts` (`// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes `RoomClient` (Task 6), `CaseContent` (Task 1), `HostView` (Task 1).
- Produces registry keys read by every scene: `game.registry.get('client'): RoomClient`, `'content': CaseContent`, `'hud': Hud`, `'view': HostView | null` (updated on every state message; scenes listen to `registry.events` `changedata-view`).
- Produces `host/scale.ts`: `integerZoom(winW: number, winH: number, w = 320, h = 180): number` (`max(1, floor(min(winW / w, winH / h)))`) and `applyZoom(game: Phaser.Game, hudRoot: HTMLElement): void` (sets `game.scale.setZoom`, centres the canvas, positions `hudRoot` over the canvas rect and sets `--zoom` on it; called once and on every `resize`).
- Produces `host/router.ts`: `sceneFor(view: { phase: Phase; round: number }, active: { key: string; round: number } | null): { key: string; data: { round: number; resume: boolean } } | null`. Rules: `lobby` → `Lobby`; `travel` → `Travel` with that round unless the active scene is `Travel` or `Battle` for that round; `vote`, `locked`, `reveal` → `Battle` with that round and `resume: true` unless the active scene is `Battle` for that round; `ending` → `Ending`; `leaderboard` → `Leaderboard`; returns `null` when the active scene already fits. `main.ts` calls it on every view change and starts the returned scene.
- Produces `host/hud/Hud.ts`: `class Hud` with `constructor(root: HTMLElement)` and methods `showLobby(a: { qrDataUrl: string | null; code: string; joinUrl: string; count: number; offline: boolean; smith: string; tanui: string })`, `showNarration(a: { boss: string; title: string; narration: string; quote?: string; footer: string })`, `showOptions(a: { options: { letter: OptionId; screen: string; memberName: string | null }[]; timerText: string; votedText: string; shares: Record<OptionId, number> | null; footer: string })`, `showBanner(a: { name: string | null; letter: OptionId | null; phone: string | null; footer: string } | null)`, `flashRally(text: string, ms?: number)`, `showDebrief(a: { lines: { letter: OptionId; damage: number; text: string }[]; rally: string | null; discuss: string })`, `showEnding(a: { title: string; tier: string; split: Record<OptionId, number>; mustBeTrue: string[]; risk: string[]; holds: { round: string; chose: string; needed: string }[] | null })`, `showLeaderboard(a: { rows: { name: string; score: number }[]; consistent: string; split: Record<OptionId, number>; question: string })`, `showToast(text: string, ms?: number)`, `showKeymap(show: boolean)`, `clear()`. Option colours come from `OPTION_COLORS: Record<OptionId, string>` exported by `Hud.ts` (the four hex values in Global Constraints), keyed by letter.
- Produces `host/hotkeys.ts`: `installHotkeys(game: Phaser.Game, client: RoomClient): void` handling 1 to 4, Shift+1 to Shift+4, B, C, Y, N, H, F, Esc, R per spec 6.5. Y and N send `judge` only when `view.phase === 'locked'` and a call-out is pending; otherwise the global handler ignores them, and the Travel scene's own N handler skips travel. Space, arrows and A are scene-level.
- Produces `host/art/placeholders.ts`: `makePlaceholders(scene: Phaser.Scene): void` creating textures `party-engineer`, `party-treasurer`, `party-envoy`, `party-scout` (12 × 16 neutral figures, no option colour), `tile-ground`, `tile-platform`, `exhibit`, `gate`, `boss-grid`, `boss-debt`, `boss-fog`, `boss-core` (rough 64 × 48 silhouettes).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/scale.test.ts
import { it, expect } from 'vitest';
import { integerZoom } from '../host/scale';
it('picks the largest whole zoom that fits', () => {
  expect(integerZoom(1920, 1080)).toBe(6);
  expect(integerZoom(1366, 768)).toBe(4);
  expect(integerZoom(1280, 720)).toBe(4);
  expect(integerZoom(640, 300)).toBe(1);
  expect(integerZoom(100, 100)).toBe(1);
});
```

```ts
// tests/router.test.ts
import { it, expect } from 'vitest';
import { sceneFor } from '../host/router';
it('routes a fresh host to the saved phase', () => {
  expect(sceneFor({ phase: 'lobby', round: -1 }, null)).toEqual({ key: 'Lobby', data: { round: -1, resume: false } });
  expect(sceneFor({ phase: 'travel', round: 2 }, null)).toEqual({ key: 'Travel', data: { round: 2, resume: false } });
  expect(sceneFor({ phase: 'reveal', round: 1 }, null)).toEqual({ key: 'Battle', data: { round: 1, resume: true } });
  expect(sceneFor({ phase: 'ending', round: 3 }, null)!.key).toBe('Ending');
  expect(sceneFor({ phase: 'leaderboard', round: 3 }, null)!.key).toBe('Leaderboard');
});
it('leaves a fitting scene alone', () => {
  expect(sceneFor({ phase: 'travel', round: 1 }, { key: 'Battle', round: 1 })).toBeNull();   // arrived at the arena, vote not open yet
  expect(sceneFor({ phase: 'vote', round: 1 }, { key: 'Battle', round: 1 })).toBeNull();
  expect(sceneFor({ phase: 'vote', round: 2 }, { key: 'Battle', round: 1 })!.data.round).toBe(2);
  expect(sceneFor({ phase: 'lobby', round: -1 }, { key: 'Lobby', round: -1 })).toBeNull();
});
```

```ts
// @vitest-environment happy-dom
// tests/hud.test.ts
import { it, expect } from 'vitest';
import { Hud, OPTION_COLORS } from '../host/hud/Hud';
it('draws four cards in letter order with letter colours and the member tag', () => {
  const root = document.createElement('div'); document.body.appendChild(root);
  const hud = new Hud(root);
  hud.showOptions({ options: [
    { letter: 'A', screen: 'Kenya guarantees', memberName: 'The Envoy' }, { letter: 'B', screen: 'KenGen', memberName: 'The Engineer' },
    { letter: 'C', screen: 'G42', memberName: 'The Treasurer' }, { letter: 'D', screen: 'We carry it', memberName: null } ],
    timerText: '30 s', votedText: '0 of 3 voted', shares: null, footer: 'Space locks' });
  const cards = [...root.querySelectorAll('[data-card]')];
  expect(cards.map(c => c.getAttribute('data-card'))).toEqual(['A', 'B', 'C', 'D']);
  expect((cards[0] as HTMLElement).style.getPropertyValue('--option')).toBe(OPTION_COLORS.A);
  expect(cards[0].textContent).toContain('The Envoy');
  expect(cards[3].textContent).not.toContain('null');
});
it('shows the banner and the debrief lines', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  hud.showBanner({ name: 'Sarah', letter: 'B', phone: 'Start small, 24 to 60 MW', footer: 'Y convincing, N not' });
  expect(root.textContent).toContain('Sarah, defend B: Start small, 24 to 60 MW');
  hud.showBanner({ name: null, letter: null, phone: null, footer: '' });
  expect(root.textContent).toContain('Hand call-out');
  hud.showDebrief({ lines: [{ letter: 'A', damage: 6, text: 'line a' }, { letter: 'B', damage: 51, text: 'line b' }], rally: 'Rally: Sarah +10', discuss: 'Why?' });
  expect(root.querySelectorAll('[data-debrief-line]')).toHaveLength(2);
  expect(root.textContent).toContain('Rally: Sarah +10');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/scale.test.ts tests/router.test.ts tests/hud.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `host/main.ts`, `host/index.html`, `host/scale.ts`, `host/router.ts`**

Config: `type: Phaser.AUTO`, `width: 320`, `height: 180`, `pixelArt: true`, `scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH }`, `physics: { default: 'arcade', arcade: { gravity: { y: 600 } } }`, `backgroundColor: '#1b1612'`, scenes `[Boot, Lobby, Travel, Battle, Ending, Leaderboard]` (register Travel, Battle, Ending, Leaderboard as empty classes for now; later tasks fill them). Before creating the game: `loadContent(await import('../content/case.json'))`, `client = createRoomClient(location, content)`, `hud = new Hud(document.getElementById('hud')!)`, registry set for `client`, `content`, `hud`; `client.onState(v => { game.registry.set('view', v); const next = sceneFor(v, activeScene(game)); if (next) game.scene.start(next.key, next.data); })` where `activeScene` reads the one running scene's `key` and its `data.round`; `applyZoom(game, hudRoot)` after boot and on `window.resize`; `installHotkeys(game, client)`. `index.html`: black body, `<div id="game">` and a sibling `<div id="hud">` positioned absolute, `pointer-events: none`, Pixelify Sans from Google Fonts.

- [ ] **Step 4: Write `Hud.ts`, `hud.css`, `placeholders.ts`, `hotkeys.ts`, `Boot.ts`**

Invoke the anti-vibecode skill before `hud.css`. Sizes in `calc(var(--zoom) * Npx)`: body 4, narration 5, banner name and titles 7, so at zoom 6 they are 24, 30 and 42 px. Cards in a 2 × 2 grid over the lower 45% of the HUD, each with a letter badge in its colour, the screen text, and the member tag in small grey type; the shares bar fills the card's bottom edge in the option colour when `shares` is given. Panels are flat dark surfaces at 85% opacity with no gradient. The QR is an `<img>` at `height: 45%` of the HUD. `data-card`, `data-debrief-line` attributes as in the tests.

`Boot`: `makePlaceholders(this)`, then `this.scene.start('Lobby')` (the router takes over once the first view arrives). `hotkeys.ts`: `keydown` on `window`; digits → `client.send({k:'injectVotes', counts: {[option]: shift ? 10 : 1}})`; B → `client.addBots(30)`; C → `client.send({k:'callout'})`; Y and N → `client.send({k:'judge', awarded: key === 'y'})` only when `view.phase === 'locked'` and `view.callouts[view.round]` has a pending entry, otherwise ignored here; H → toggle `hideNames` via `client.send({k:'hideNames', hide})`; F → `game.scale.toggleFullscreen()`; Esc → `hud.showKeymap(toggle)`; R → `client.send({k:'reopen'})`.

- [ ] **Step 5: Write `Lobby.ts`**

On create: `client.connect()` → `QRCode.toDataURL(joinUrl, { margin: 1, scale: 8 })` → `hud.showLobby({ qrDataUrl, code, joinUrl, count, offline: client.mode === 'offline', smith: content.quotes.smith, tanui: content.quotes.tanui })`; the canvas draws the Nairobi skyline strip and nothing else. On `changedata-view`: diff `players`, drop a `party-*` sprite (cycling the four members) per new player at a random x with a small tween, label with name unless `hideNames` (canvas bitmap text, 6 px, the one exception to the HTML rule because the labels ride on sprites), and call `hud.showLobby` again with the new count. In offline mode the HUD shows "Offline mode: keys 1 to 4 add votes, B adds bots" instead of the QR. Space → `client.send({ k: 'start' })`; the router moves to Travel when the phase changes.

- [ ] **Step 6: Run tests, then manual check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS.
Run: `npm run dev` and open `http://localhost:5173/host/?mode=offline`.
Expected: the canvas is a whole multiple of 320 × 180 and centred (check `document.querySelector('canvas').width` against the window), the HUD sits exactly over it, the offline notice shows, Esc shows the key map, Space switches to the (empty) Travel scene without console errors. Resize the window: the zoom steps down in whole numbers and the HUD follows.
Then `npm run build && npm run dev:worker`, open `http://localhost:8787/host/`: a QR (about 45% of the height) and code appear; scanning it with a phone and joining drops an avatar with the name. Reload the host tab: the same code and the same joined players reappear (Review Focus 4). Press Space, then reload again: the host comes back in Travel for round 0, not the lobby.

- [ ] **Step 7: Commit and push**

```bash
git add host tests && git commit -m "feat: phaser bootstrap, hud, integer zoom, router, lobby, hotkeys" && git push
```

---

### Task 8: Battle scene (vote, reveal, attack, debrief)

**Files:**
- Create: `host/scenes/Battle.ts`, `host/ui/HpBar.ts`, `host/strikers.ts`
- Test: `tests/strikers.test.ts`

**Interfaces:**
- Consumes registry (`client`, `content`, `hud`, `view`), `Hud` (Task 7), textures (Task 7), `DamageResult` (Task 1).
- Produces `Battle` scene started with `{ round: number; resume: boolean }`; `HpBar`: `class HpBar extends Phaser.GameObjects.Container { constructor(scene, x, y, w, roundHp: number, totalHp: number); set(roundRemaining: number, totalRemaining: number, animateMs?: number): void }`; `host/strikers.ts`: `strikerFor(content: CaseContent, roundIndex: number, letter: OptionId): string` returning the party member id (the option's `member`, else the member whose `button` is that letter).

- [ ] **Step 1: Write the failing striker test**

```ts
import { it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { strikerFor } from '../host/strikers';
const c = loadContent(raw);
it('uses the proposing member, else the default button owner', () => {
  expect(strikerFor(c, 1, 'A')).toBe('envoy');       // round 2 option A is the Envoy
  expect(strikerFor(c, 0, 'B')).toBe('treasurer');
  expect(strikerFor(c, 3, 'C')).toBe('envoy');       // round 4 has no member; C is the Envoy's button
  expect(strikerFor(c, 3, 'D')).toBe('scout');
});
```

- [ ] **Step 2: Write the scene state table**

The scene renders from `view.phase`, drawing the world on the canvas and everything textual through `hud`:
- `travel` (arrived at the arena, vote not open): boss sprite idle, `hud.showNarration` with the round's narration and a quote (round 1 `quotes.ruto` as the Grid Wyrm's taunt, round 2 `quotes.tanui` as the gatekeeper's line, none otherwise), footer "Space opens the vote".
- `vote`: `hud.showOptions` with the four options in letter order, each card carrying the proposing member's name (null in round 4), timer from `voteDeadline - serverNow` corrected by local clock offset, "N of M voted" where N = Σ tally and M = player count (offline: just N). Space → `closeVote`.
- `locked`: `hud.showOptions` with `shares` so the cards show bars (the host sees tallies), footer "C calls a student out. Space: the party strikes". When `view.callouts[round]` has a pending entry, `hud.showBanner` reads "{name}, defend {letter}: {phone label}" (or "Hand call-out. Who defends their choice?" when the name is null), the striker for that option (`strikerFor`) steps forward 8 px on the canvas, and the footer reads "Y convincing, N not". After a judge, `hud.flashRally("+10 rally")` in teal or `"no bonus"` in grey for 1.5 s and the striker steps back. Resolved call-outs are listed small under the cards with the student's name.
- `reveal`: once per round (skipped entirely when the scene was started with `resume: true`, which goes straight to the debrief), run the strike sequence (at most 6 s): strikers lunge in letter order A to D with scale proportional to share, flashing in the option's colour, a damage number per option from `damageLog[round].perOption`; then one rally strike per awarded call-out, delivered by that option's striker with the student's name over it and "+10"; `HpBar.set` animates the drain over 1.5 s, screen shake 200 ms; then `hud.showDebrief` with one line per option "{letter} {damage}: {projector}", "Rally: {names} +{rally}" when `rally > 0`, and the round's `discuss` line. Space during the sequence skips to the debrief; Space on the debrief → `client.send({ k: 'next' })`.
- After `next` the router (Task 7) starts Travel for the next round or Ending.

- [ ] **Step 3: Implement `strikers.ts`, `HpBar.ts`, `Battle.ts`**

Space handling: a `busy` flag is set when the strike sequence starts; Space while `busy` kills the tweens, shows the debrief, clears `busy` and sets `lockedUntil = time + 600`; Space is ignored while `time < lockedUntil`; only a Space after that sends `next` (Review Focus 5). Damage numbers are the only canvas text (6 px bitmap font from the placeholder set).

- [ ] **Step 4: Manual check in offline mode**

Run `npm run dev`, open `http://localhost:5173/host/?mode=offline`, Space through the lobby, N to skip travel (Task 9 provides it; until then the Travel stub starts Battle immediately), Space to open the vote, press `2` ten times and `1` twice, Space to lock: bars show 10 and 2. Press C: the hand call-out banner appears (offline mode has no named players); press Y: "+10 rally" flashes. Space to reveal: the strike plays, a rally strike follows, HP drops by the expected amount (shares 0.833 and 0.167 on B and A: base 80.8, focus 15, rally 10, total 100), the debrief lists four lines with the citations from content plus the rally line. Press Space twice quickly during the strike: it skips to the debrief once and does not advance to the next round. Reload the page while the debrief is up: it comes back on the debrief with no strike replay. Online (Task 12 or `wrangler dev` with two phones joined and voting): C shows a real name and that phone shows "You're up".

- [ ] **Step 5: Run tests, type-check, commit, push**

```bash
npx vitest run && npx tsc --noEmit && git add host tests && git commit -m "feat: battle scene with vote, call-out, reveal, attack and debrief" && git push
```

---

### Task 9: Travel scene (platformer segments and exhibits)

**Files:**
- Create: `host/scenes/Travel.ts`, `host/levels/road.ts`

**Interfaces:**
- Consumes registry (`client`, `content`, `hud`, `view`), textures (Task 7), `Hud.showToast` (Task 7), content exhibits (Task 1).
- Produces `host/levels/road.ts`: `export interface Segment { width: number; platforms: { x: number; y: number; w: number }[]; exhibits: { x: number; y: number }[]; gateX: number; autoPath: { x: number; jump: boolean }[] }` and `export const SEGMENTS: Segment[]` (four, each 640 to 960 px wide, the fourth 320 px, three exhibit spots each).

- [ ] **Step 1: Write `road.ts`**

Four hand-laid segments. Ground at y 160, platforms 16 px tall, exhibits placed on platforms, the gate 32 px before the end, `autoPath` listing x positions where the auto-runner jumps. Gaps no wider than 48 px: jump velocity -260 at gravity 600 gives about 0.87 s in the air, and at the 90 px/s run speed that covers about 78 px horizontally (the jump height is a separate 56 px).

- [ ] **Step 2: Implement `Travel.ts`**

Arcade physics: lead sprite `party-engineer` with `setCollideWorldBounds`, platforms as a static group from `tile-platform`, camera follows the lead, three follower sprites (the other members) lerp toward the lead's position from 200 ms ago. Controls: cursor keys only (left and right move, up or Space jumps when `body.blocked.down`), A toggles auto-run (moves right at 90 px/s, jumps at the next `autoPath` x), N → go to the gate. Overlap with an exhibit: destroy it, `client.send({ k: 'exhibit', exhibitId })`, `hud.showToast(text + ' (' + source + ')')`. Overlap with the gate → `this.scene.start('Battle', { round, resume: false })`. `hud.showNarration` is not used here; the HUD shows a single small label "Travel {round + 1}: {boss name} ahead" via `hud.showToast` with no timeout.

- [ ] **Step 3: Manual check**

Offline mode: from the lobby, Space, walk right with arrows, jump onto a platform, touch an exhibit: the toast shows the fact for 4 s, and after the gate the Battle scene's narration appears. Press A at the start of segment 2: the lead reaches the gate on its own without falling. N skips. In Battle after collecting two exhibits, reveal shows `exhibit 10` in the damage breakdown.

- [ ] **Step 4: Type-check, commit, push**

```bash
npx tsc --noEmit && git add host && git commit -m "feat: travel platformer segments with exhibit pickups" && git push
```

---

### Task 10: Ending and Leaderboard scenes

**Files:**
- Create: `host/scenes/Ending.ts`, `host/scenes/Leaderboard.ts`

**Interfaces:**
- Consumes registry (`client`, `content`, `hud`, `view`), `endingFor`, `consistencyAward` (Task 2); `tallyFor` is not available on the host (use `view.tally` for the current round and `view.damageLog` for totals).
- Produces: `Ending` reads `view.damageLog` (sum of `total`), `view.tally` (round 3's tally while phase is `ending`), picks the ending via `endingFor`, and calls `hud.showEnding` with title, tier, the four-way split, "What must be true" bullets, "The risk you accepted" bullets; for `holds`, the `holds` rows list for rounds 1 to 3 "Class chose {majority letter}: {phone label}" beside "Needed: {synergy letters}" for the final majority. The canvas shows the boss core cracking (or standing, for `holds`). Space → `client.send({ k: 'next' })`; the router starts `Leaderboard`. `Leaderboard` calls `hud.showLeaderboard` with the top 5 by `score` (name, or "Player" when `hideNames`), "Most consistent strategist: {name}" from `consistencyAward(Object.values(view.players), content)` or "No one voted in all four rounds", and the round 4 split under "What should Microsoft do, and why?". Space → `client.send({ k: 'reset' })`; the router returns to Lobby.

- [ ] **Step 1: Implement both scenes**

- [ ] **Step 2: Manual check**

Offline run with N pressed in every travel so no exhibits are collected: four rounds with key `2` pressed ten times in every round: damage 100, 75, 95, 100, total 370, Ending shows "The Seed Plant", tier decisive. Repeat pressing `3` twice in round 1, `1` twice in round 2, `4` twice in round 3 and `2` twice in round 4: damage 35, 25, 40, 65, total 165, the "Deadlock holds" ending lists three rows of class choice versus needed (B needed B, B or D, B). Leaderboard shows "No one voted in all four rounds" in offline mode (no real players).

- [ ] **Step 3: Type-check, commit, push**

```bash
npx tsc --noEmit && git add host && git commit -m "feat: ending and leaderboard scenes" && git push
```

---

### Task 11: Art pass, font, bosses, credits

**Files:**
- Create: `host/art/assets/` (CC0 files), `host/art/bosses.ts`, `CREDITS.md`
- Modify: `host/art/placeholders.ts` (keep as fallback), `host/scenes/Boot.ts` (load real assets), `host/scenes/Battle.ts` (use `bosses.ts`)

**Interfaces:**
- Produces `host/art/bosses.ts`: `buildBoss(scene: Phaser.Scene, id: 'grid' | 'debt' | 'fog' | 'core', x: number, y: number): Phaser.GameObjects.Container` with an `idle` tween and a `hit()` method (flash and recoil, 300 ms).

- [ ] **Step 1: Pick and download assets, record licences**

Kenney Pixel Platformer (tiles, props) and Kenney Tiny Dungeon (party sprites, 16 × 16), both CC0, plus the Kenney Pixel font (CC0). Write `CREDITS.md` with pack name, author, URL, licence, and which files are used. Only CC0 or licences that allow classroom and GitHub use go in.

- [ ] **Step 2: Build the bosses procedurally**

Grid Wyrm: 8 body segments drawn as pylon silhouettes following a sine path, head with two amber lights. Debt Golem: a 3 × 4 stack of 16 px blocks, two carved with "68%" and "48.5%" bitmap text. Fog of Demand: 60 particles drifting, three floating labels "97.5%", "8.7%", "20 MW" that cross each other. Core: a pulsing diamond behind a cracked ring. Palette per spec 7.

- [ ] **Step 3: Replace placeholders in Boot and Battle; keep placeholders as the fallback when an asset fails to load**

- [ ] **Step 4: Manual check**

Full offline run at 1920 × 1080 fullscreen (F): no blurry sprites (whole-number zoom), HUD text at or above the spec 7 minimums (24 px card and debrief copy, 30 px narration, 42 px banner name at zoom 6) and legible from the back of a classroom, the three bosses animate, `hit()` fires on each strike.

- [ ] **Step 5: Commit and push**

```bash
git add host CREDITS.md && git commit -m "feat: art pass, procedural bosses, credits" && git push
```

---

### Task 12: Deploy, load test, runbook

**Files:**
- Create: `RUNBOOK.md`
- Modify: `README.md`

- [ ] **Step 1: Deploy**

Run: `npx wrangler login` (Caleb's personal account unless he says otherwise), then `npm run deploy`.
Expected: a `https://olkaria.<account>.workers.dev` URL; `curl -s -X POST https://olkaria.<account>.workers.dev/api/rooms` returns a code.

- [ ] **Step 2: Load test**

Open the deployed host page, note the code, run `npm run simulate -- --base https://olkaria.<account>.workers.dev --code CODE --n 60`, then play through all four rounds from the host with Space. Expected: lobby shows 60 joined within 5 s; every round's tally sums to 60 by lock; reveal is drawn within 1 s of Space; the leaderboard shows five names.

- [ ] **Step 3: Write `RUNBOOK.md`**

Sections: before class (deploy or confirm the URL, `caffeinate -d` in a terminal, open `/host/` in Chrome, F for fullscreen, create the room, check the QR from the back of the room), during class (the key map, the run of show from spec 3.1 with the discuss lines), if something breaks (Wi-Fi: `?mode=offline` on the host and hand counts with 1 to 4; projector: integer scale handles it; a student cannot join: the URL and code are printed under the QR), after class (`reset`, nothing to clean up).

- [ ] **Step 4: Rehearsal with teammates**

Five phones join, a full 12-minute run, one deliberate switch to offline mode in round 2, reload the host tab once in round 3. Note anything that confused a teammate in `RUNBOOK.md`.

- [ ] **Step 5: Commit and push**

```bash
git add RUNBOOK.md README.md && git commit -m "docs: runbook and deployment notes" && git push
```

---

## Self-review notes

- Spec coverage: 3.1 run of show → RUNBOOK (T12); 3.2/3.3 screens → T5, T7 to T10; 4.1 to 4.6 → T1 content, T2 scoring, T8 to T10 scenes; 5 content → T1; 6.2 → T3; 6.3 → T4; 6.4 and 6.5 → T6, T7; 6.6 → T1; 7 → T5, T11; 8 → T12.
- Type consistency: `RoomClient.addBots` is declared in T6 and used in T7; `HostCmd` keys match between T1, T3 tests and T7 hotkeys; `Hud.showOptions` takes letters and screen text, and `strikerFor` (T8) resolves the member from content, so no scene reads `member` directly.
- Review Focus coverage: 1 and 2 in T3 tests; 3 in T2 and T3; 4 in T6 test plus T7 router test and manual; 5 in T8 manual; 6 in T3 call-out tests.
- Call-out mechanic (Caleb, 2 Nov): types in T1, `rallies` in T2, `callout` and `judge` in T3, random pick filled in T4 and T6, phone states in T5, keys in T7, banner and rally strikes in T8.
- Reviewer pass (2 Nov): text moved off the canvas into the HTML HUD (T7, T8, T9, T10), whole-number zoom helper (T7), reload router (T7), colour bound to the letter with a `strikerFor` rule (T8), `reopen` semantics pinned (T3), host reload resume without strike replay (T8), 600 ms post-skip lockout (T8), two phone labels shortened and name cap fixed at 16 (T1, T3), `picks` added to the player view for the phone's ending summary (T1, T3, T5), round ids `grid`/`debt`/`fog`/`core` (T1, T11), projector lines added as `projector` (T1, T8), Tanui quote shown in the lobby and round 2 (T7, T8), arrow keys only in travel (T9), exhibit assumption stated in the T10 check.
- Proportion: code bodies appear only for the type module, the config file and test files; everything else is signatures and values.
