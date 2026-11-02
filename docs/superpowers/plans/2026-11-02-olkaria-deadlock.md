# Olkaria: the Deadlock. Implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A projector-side dark-fantasy pixel boss fight plus a phone page, where a class split into four stakeholder classes (Rogue, Knight, Bard, Wizard) votes through four decision rounds of the Kenya data-centre case, one class leading each round's special attack, and the votes become attacks on the Deadlock.

**Architecture:** Pure TypeScript core in `shared/` (content schema, scoring, room reducer) used by both an authoritative Cloudflare Durable Object and an in-browser offline mode. Phaser 3 host game with an HTML text layer, and a plain TypeScript phone page, both built by Vite and served as static assets by the same Worker that hosts the rooms over WebSockets. All case content lives in one JSON file.

**Tech Stack:** TypeScript 5.7, Vite 6, Phaser 3.90, Zod 3.24, Vitest 3 (+ happy-dom for DOM tests), Wrangler 4 with Durable Objects (SQLite), `qrcode` 1.5, `ws` 8 (simulation script only), `tsx`.

**Spec:** `docs/superpowers/specs/2026-11-02-olkaria-deadlock-design.md` revision 2 (read it first; section numbers below are its sections).

## Global Constraints

- Node 24 (installed: v24.15.0) and npm; no pnpm or bun in scripts.
- World canvas 320 × 180 at a whole-number zoom (`Phaser.Scale.NONE` plus `setZoom`, recomputed on resize), `pixelArt: true`, no smoothing. Everything textual lives in the HTML layer over the canvas, sized with a `--zoom` CSS variable; only damage numbers and the HP label are drawn on the canvas (spec 7).
- Roles are exactly `'citizen' | 'government' | 'business' | 'microsoft'` with stakeholder names Citizen, Kenyan Government, Local Businesses, Microsoft and class names Rogue, Knight, Bard, Wizard, and lead rounds 1 to 4 in that order (spec 4.1). G42 is not a role; it is folded into Microsoft.
- Option ids are exactly `'A' | 'B' | 'C' | 'D'`; shapes triangle, diamond, circle, square; colours muted red `#b5473d`, blue `#3f6fa3`, yellow `#c9a227`, green `#4f8a5b`, bound to the letter everywhere. Class sprites carry no option colour (spec 4.1).
- Scoring constants live in `content/case.json` under `scoring`: round HP 100, focus threshold 0.6, focus bonus 15, alignment bonus 10, caster bonus 10, exhibit bonus 5, max exhibits 3, call-out bonus 10, max call-outs 2, call-out points 10 spoke and 30 awarded, decision base 50, synergy bonus 15, speed bonus max 20, vote window 30 s, tiers decisive 260 and fragile 180 (spec 4.4). Code never hard-codes these numbers.
- Blended share = 0.5 × lead share + 0.5 × support share when both groups voted; the group that voted alone otherwise; zeros when nobody voted (spec 4.4).
- Names and table names: trimmed, control characters removed, 16 characters max. Name and role are required on the phone; the table name is optional; the generated fallback name exists only on the server (spec 6.2).
- Call-outs happen only in `locked`, random among this round's voters not yet called, lead-role voters first, at most two per round; the random number travels in the command (spec 6.2).
- `reopen` works from `locked` (back to `vote`, fresh deadline, `voteOpenedAt` unchanged) and from `vote` (deadline extended); elsewhere `'bad phase'`. A reveal is final (spec 6.2).
- Phone labels 28 characters or fewer; projector lines 130 or fewer; round ids `grid`, `debt`, `fog`, `core` (spec 6.6).
- Travel controls: arrow keys and Space only; A toggles auto-run; N skips (spec 6.5).
- Space advances (start, open the vote, lock, reveal, next) and does nothing on the leaderboard. Reset is Shift+R pressed twice within 3 seconds, never Space (spec 6.5).
- Kick bans the client id: the phone is told `{ t: 'kicked' }`, stops reconnecting, and a later join from that id is refused with `'removed'` (spec 6.2).
- Everything shown during a strike sums to the damage drained: lead half of base, support half of base, one flourish per bonus, one rally strike per convincing call-out; the debrief carries a breakdown line (spec 3.2).
- Copy rules: sentence case, no em dashes, no all-caps eyebrows (anti-vibecode). Invoke the anti-vibecode skill before `player/styles.css` and `host/hud/hud.css`.
- Every non-skippable animation is 8 seconds or shorter; Space skips (spec 2).
- Assets: GitHub first, author page second, licence recorded in `CREDITS.md` before any file is copied (spec 7).
- Commit after each task; push to `main` on `origin` (GitHub `C-lb/olkaria`, private).

## Review Focus

1. A phone that reloads mid-vote reconnects with the same client id and must not vote twice in that round; its first vote still counts. Test in Task 3.
2. A vote arriving after the deadline tick but before the host presses anything must be rejected. Test in Task 3.
3. A round in which nobody voted, or in which no one of the lead class voted, must reveal cleanly: no NaN, damage from whichever group voted, zero when none, majority A flagged tied when empty. Tests in Tasks 2 and 3.
4. A host reload must come back to the same room and the same phase and round, and a saved `reveal` must not replay the strike. Tests in Tasks 6 and 7, manual check in Task 8.
5. Space pressed twice quickly during a reveal animation must advance once, not skip the debrief. Guard in Task 8 with a manual check.
6. A call-out when nobody voted (or in offline mode with only synthetic votes) must still work as a hand cold-call with no name, and a pending call-out at reveal counts as declined. Test in Task 3.
7. A join with an unknown role, or a name of only spaces, must not create a half-formed player. Test in Task 3.

---

## File structure

```
olkaria/
  package.json  tsconfig.json  vite.config.ts  vitest.config.ts  wrangler.jsonc  .gitignore
  README.md  RUNBOOK.md  CREDITS.md
  content/case.json                 roles, rounds with lead role, scoring constants, endings, exhibits, quotes
  shared/types.ts                   Role, OptionId, Phase, RoomState, events, views, messages
  shared/content.ts                 Zod schema, loadContent()
  shared/scoring.ts                 shares, blendShares, majorityOf, synergyHits, effectiveScores, computeDamage, speedBonus, pointsFor, endingFor, consistencyAward, tableAward
  shared/names.ts                   generateName, sanitizeName
  shared/room-logic.ts              initialState, reduce, tallyFor, leadTallyFor, supportTallyFor, hostView, playerView
  shared/codes.ts                   makeRoomCode, isValidCode
  worker/index.ts                   routes: /api/rooms, /ws/:code, /j/:code, /, assets fallthrough
  worker/room.ts                    Durable Object Room (hibernating WebSockets, alarm, storage)
  host/index.html  host/main.ts     Phaser bootstrap, registry, HUD, router wiring
  host/net.ts                       RoomClient interface, WsRoomClient, OfflineRoomClient, createRoomClient, botTally
  host/session.ts                   rememberRoom, recallRoom, forgetRoom (sessionStorage)
  host/scale.ts                     integerZoom(), applyZoom()
  host/router.ts                    sceneFor()
  host/hotkeys.ts                   global host keys (spec 6.5)
  host/hud/Hud.ts  host/hud/hud.css HTML text layer: lobby, narration, cards with two bars, banner, debrief, ending, leaderboard, toast, key map
  host/strikers.ts                  classFor(), the lead class and the three support classes of a round
  host/scenes/{Boot,Lobby,Travel,Battle,Ending,Leaderboard}.ts
  host/ui/HpBar.ts                  canvas HP bar
  host/levels/road.ts               four travel segments
  host/art/placeholders.ts          generated textures so scenes run before the art pass
  host/art/assets/                  licensed sprites, tiles, font (Task 11)
  host/art/bosses.ts                procedural boss builders (Task 11)
  player/index.html  player/main.ts player/render.ts  player/styles.css  player/net.ts
  scripts/simulate-class.ts         N fake phones with roles against a room
  tests/{content,scoring,names,room-logic,codes,session,player-render,offline-client,scale,router,hud,strikers}.test.ts
```

---

### Task 1: Repository, toolchain, content file, content schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `.gitignore` (the repo and `README.md` already exist)
- Create: `content/case.json`
- Create: `shared/types.ts`, `shared/content.ts`
- Test: `tests/content.test.ts`

**Interfaces:**
- Produces `shared/types.ts` exactly as in Step 2.
- Produces `shared/content.ts`: `ContentSchema` (Zod), `type CaseContent`, `type RoundContent = CaseContent['rounds'][number]`, `type SynergyTable = Record<OptionId, OptionId[][]>`, `loadContent(raw: unknown): CaseContent` (throws `ZodError` on invalid input).

- [ ] **Step 1: Scaffold the toolchain**

`npm init -y`, then set `package.json` to `"type": "module"` with scripts: `dev` = `vite`, `build` = `vite build`, `test` = `vitest run`, `check` = `tsc --noEmit`, `dev:worker` = `wrangler dev`, `deploy` = `vite build && wrangler deploy`, `simulate` = `tsx scripts/simulate-class.ts`. Dependencies: `phaser@^3.90`, `zod@^3.24`, `qrcode@^1.5.4`. Dev dependencies: `vite@^6`, `typescript@^5.7`, `vitest@^3`, `happy-dom@^17`, `wrangler@^4`, `@cloudflare/workers-types@^4`, `ws@^8`, `@types/ws`, `@types/qrcode`, `tsx@^4`. `tsconfig.json`: `strict`, `module: ESNext`, `moduleResolution: Bundler`, `target: ES2022`, `resolveJsonModule: true`, `types: ["@cloudflare/workers-types", "vite/client"]`, `include: ["shared", "host", "player", "worker", "scripts", "tests"]`. `vite.config.ts`: `appType: 'mpa'`, `build.rollupOptions.input = { host: 'host/index.html', player: 'player/index.html' }`. `vitest.config.ts`: `include: ['tests/**/*.test.ts']`, environment `node`. `.gitignore`: `node_modules`, `dist`, `.wrangler`, `.DS_Store`.

- [ ] **Step 2: Write `shared/types.ts`**

```ts
export type OptionId = 'A' | 'B' | 'C' | 'D';
export const OPTION_IDS: readonly OptionId[] = ['A', 'B', 'C', 'D'];
export type Role = 'citizen' | 'government' | 'business' | 'microsoft';
export const ROLES: readonly Role[] = ['citizen', 'government', 'business', 'microsoft'];
export type Phase = 'lobby' | 'travel' | 'vote' | 'locked' | 'reveal' | 'ending' | 'leaderboard';
export type Tally = Record<OptionId, number>;
export interface Vote { option: OptionId; at: number }
export interface Player { id: string; name: string; role: Role; table: string | null; joinedAt: number; score: number; lastPoints: number; votes: Record<number, Vote> }
export interface DamageResult {
  round: number; total: number; base: number; focus: number; alignment: number; exhibit: number; rally: number;
  leadShares: Record<OptionId, number>; supportShares: Record<OptionId, number>; shares: Record<OptionId, number>;
  effective: Record<OptionId, number>; perOption: Record<OptionId, number>;
  majority: OptionId; tied: boolean;
  leadMajority: OptionId | null; supportMajority: OptionId | null; leadTied: boolean; supportTied: boolean;
}
export interface Callout { playerId: string | null; option: OptionId | null; status: 'pending' | 'awarded' | 'declined'; points: number }
export interface RoomState {
  code: string; hostKey: string; createdAt: number; updatedAt: number;
  phase: Phase; round: number; voteOpenedAt: number | null; voteDeadline: number | null; voteWindowMs: number;
  players: Record<string, Player>; banned: string[]; synthetic: Record<number, Tally>; exhibits: Record<number, string[]>;
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
  | { type: 'join'; clientId: string; name?: string; role: string; table?: string; now: number }
  | { type: 'vote'; clientId: string; round: number; option: OptionId; now: number }
  | { type: 'cmd'; key: string; cmd: HostCmd; now: number }
  | { type: 'tick'; now: number };
export type Effect = { type: 'setAlarm'; at: number } | { type: 'clearAlarm' } | { type: 'error'; clientId?: string; msg: string } | { type: 'kicked'; clientId: string };
export type ClientMsg =
  | { t: 'join'; clientId: string; name: string; role: Role; table?: string }
  | { t: 'vote'; round: number; option: OptionId }
  | { t: 'cmd'; key: string; cmd: HostCmd };
export type HostView = Omit<RoomState, 'hostKey'> & { serverNow: number; lead: Role; leadTally: Tally; supportTally: Tally; tally: Tally };
export interface PlayerView {
  phase: Phase; round: number; serverNow: number; voteDeadline: number | null; voteWindowMs: number;
  name: string; role: Role; table: string | null; lead: Role; isLead: boolean;
  myVote: OptionId | null; lastPoints: number; score: number; rank: number; playerCount: number;
  tally: Tally | null; leadTally: Tally | null; supportTally: Tally | null; majorities: (OptionId | null)[];
  picks: (OptionId | null)[];
  callout: { name: string | null; option: OptionId | null; isMe: boolean } | null;
}
export type ServerMsg = { t: 'host'; state: HostView } | { t: 'you'; view: PlayerView } | { t: 'error'; msg: string } | { t: 'kicked' };
```

- [ ] **Step 3: Write the failing content test**

```ts
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
```

- [ ] **Step 4: Run it to see it fail**

Run: `npx vitest run tests/content.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 5: Write `content/case.json`**

Encode spec section 5 verbatim (narrations, screen texts, phone labels, scores, debriefs, projector lines from 5.7, discuss lines, synergy table from 5.4, endings from 4.6, exhibits from 5.5, quotes from 5.6). Shape:

```jsonc
{
  "title": "Olkaria: the Deadlock",
  "roles": [
    { "id": "citizen", "stakeholder": "Citizen", "className": "Rogue", "blurb": "Households, businesses, workers and the Olkaria communities" },
    { "id": "government", "stakeholder": "Kenyan Government", "className": "Knight", "blurb": "The Treasury, the ICT ministry and Parliament" },
    { "id": "business", "stakeholder": "Local Businesses", "className": "Bard", "blurb": "Safaricom, the banks, the startups, EcoCloud and the local developers" },
    { "id": "microsoft", "stakeholder": "Microsoft", "className": "Wizard", "blurb": "Azure and the capital-allocation decision, with G42 on the same side" }
  ],
  "rounds": [
    { "id": "grid", "boss": "Grid Wyrm", "lead": "citizen", "title": "What will Kenyans accept on power?", "narration": "…5.1…", "discuss": "Why did the full 1 GW do so little damage, and what condition made 60 to 100 MW safe?",
      "options": [ { "id": "A", "screen": "…", "phone": "Households first, deal waits", "score": 40, "debrief": "…", "projector": "…" }, /* B 80, C 15, D 55 */ ] },
    { "id": "debt", "boss": "Debt Golem", "lead": "government", "discuss": "Two live offers, one honest refusal, one dead option. Which would you sign, and who carries the risk?", /* A 10, B 45, C 65, D 60 */ },
    { "id": "fog", "boss": "Fog of Demand", "lead": "business", "discuss": "What would Kenya's businesses need to see before they sign, and what would Microsoft need to see before it builds?", /* A 70, B 80, C 40, D 35 */ },
    { "id": "core", "boss": "The core", "lead": "microsoft", "discuss": "What should Microsoft do, and why?", /* scores null, debrief "", projector "" */ }
  ],
  "synergy": { "A": [["C"], ["A","D"], ["A"]], "B": [["B","D"], ["C","D"], ["A","B"]], "C": [["A"], ["B"], ["C","D"]], "D": [["B","C"], ["C","D"], ["B"]] },
  "endings": { "A": { "title": "Olkaria Colossus", "mustBeTrue": ["…"], "risk": ["…"] }, /* B, C, D */ "holds": { "title": "The Deadlock holds", "text": "Your board sends the party back to Nairobi." } },
  "exhibits": [ [ { "id": "t1a", "text": "Olkaria generates about 950 MW", "source": "James, 2026" }, /* … */ ], /* 4 sets of 3 */ ],
  "quotes": { "tanui": "…", "ruto": "…", "smith": "…" },
  "scoring": { "roundHp": 100, "focusThreshold": 0.6, "focusBonus": 15, "alignmentBonus": 10, "casterBonus": 10, "exhibitBonus": 5, "maxExhibits": 3, "calloutBonus": 10, "maxCallouts": 2, "calloutPointsSpoke": 10, "calloutPointsAwarded": 30, "decisionBase": 50, "synergyBonus": 15, "speedBonusMax": 20, "voteSeconds": 30, "tiers": { "decisive": 260, "fragile": 180 } }
}
```

- [ ] **Step 6: Write `shared/content.ts`**

`ContentSchema = z.object({...})` mirroring Step 5: `roles: z.array(role).length(4)`, `rounds: z.array(round).length(4)` with `lead: z.enum(ROLES)`, each `options: z.array(option).length(4)`, option ids `z.enum(['A','B','C','D'])`, `score: z.number().min(0).max(100).nullable()`, `phone: z.string().max(28)`, `projector: z.string().max(130)`, `synergy: z.record(optionId, z.array(z.array(optionId)).length(3))`, `exhibits: z.array(z.array(exhibit).length(3)).length(4)`, `quotes: z.object({ tanui, ruto, smith })`. `loadContent(raw) { return ContentSchema.parse(raw); }`.

- [ ] **Step 7: Run the test, then type-check**

Run: `npx vitest run tests/content.test.ts && npx tsc --noEmit`
Expected: 6 tests PASS, tsc clean.

- [ ] **Step 8: Commit and push**

```bash
git add -A && git commit -m "feat: toolchain, case content and schema" && git push
```

---

### Task 2: Scoring

**Files:**
- Create: `shared/scoring.ts`
- Test: `tests/scoring.test.ts`

**Interfaces:**
- Consumes `CaseContent`, `SynergyTable` (Task 1), `Tally`, `OptionId`, `DamageResult`, `Player` (Task 1).
- Produces:
  - `shares(t: Tally): Record<OptionId, number>` (zeros when the total is 0)
  - `blendShares(lead: Tally, support: Tally): Record<OptionId, number>`
  - `majorityOf(s: Record<OptionId, number>): { majority: OptionId; tied: boolean }` (earliest letter on tie; all-zero is `A`, tied)
  - `synergyHits(final: OptionId, prior: (OptionId | null)[], table: SynergyTable): number`
  - `effectiveScores(content: CaseContent, roundIndex: number, prior: (OptionId | null)[]): Record<OptionId, number>`
  - `computeDamage(args: { content: CaseContent; roundIndex: number; lead: Tally; support: Tally; prior: (OptionId | null)[]; exhibits: number; rallies: number }): DamageResult`
  - `speedBonus(responseMs: number, windowMs: number, max: number): number`
  - `pointsFor(args: { content: CaseContent; roundIndex: number; option: OptionId; responseMs: number; windowMs: number; prior: (OptionId | null)[]; isLead: boolean }): number`
  - `endingFor(args: { content: CaseContent; finalLead: Tally; finalSupport: Tally; totalDamage: number }): { ending: OptionId | 'holds'; tier: 'decisive' | 'fragile' | 'holds'; majority: OptionId }`
  - `consistencyAward(players: Player[], content: CaseContent): string | null`
  - `tableAward(players: Player[]): { table: string; mean: number } | null`

- [ ] **Step 1: Write the failing tests**

```ts
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
});

describe('points, endings, awards', () => {
  it('speed bonus is linear and clamped', () => {
    expect(speedBonus(6000, 30000, 20)).toBe(16);
    expect(speedBonus(0, 30000, 20)).toBe(20);
    expect(speedBonus(45000, 30000, 20)).toBe(0);
  });
  it('points are effective score plus speed plus the caster bonus for the lead class', () => {
    const base = { content: c, roundIndex: 0, option: 'B' as const, responseMs: 6000, windowMs: 30000, prior: [] as const };
    expect(pointsFor({ ...base, isLead: true })).toBe(106);
    expect(pointsFor({ ...base, isLead: false })).toBe(96);
    expect(pointsFor({ content: c, roundIndex: 3, option: 'B', responseMs: 30000, windowMs: 30000, prior: ['B', 'C', 'B'], isLead: false })).toBe(95);
  });
  it('picks the ending by final blended majority and total damage tier', () => {
    const f = { content: c, finalLead: T(1, 5, 1, 1), finalSupport: T(4, 20, 4, 4) };
    expect(endingFor({ ...f, totalDamage: 300 })).toEqual({ ending: 'B', tier: 'decisive', majority: 'B' });
    expect(endingFor({ ...f, totalDamage: 200 })).toEqual({ ending: 'B', tier: 'fragile', majority: 'B' });
    expect(endingFor({ ...f, totalDamage: 179 })).toEqual({ ending: 'holds', tier: 'holds', majority: 'B' });
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
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/scoring.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `shared/scoring.ts`**

Formulas from spec 4.4. `computeDamage`: `effective = effectiveScores(...)`, `sh = blendShares(lead, support)`, `perOption[o] = sh[o] * effective[o]`, `base = Σ perOption`, `{majority, tied} = majorityOf(sh)`, `focus = !tied && sh[majority] >= focusThreshold ? focusBonus : 0`, `leadMajority` and `supportMajority` from `majorityOf(shares(...))` when that group's total is above 0 else `null`, `leadTied` and `supportTied` from the same calls (`false` when the group is empty), `alignment = both present && neither tied && equal ? alignmentBonus : 0`, `exhibit = min(exhibits, maxExhibits) * exhibitBonus`, `rally = min(rallies, maxCallouts) * calloutBonus`, `total = clamp(round(base + focus + alignment + exhibit + rally), 0, scoring.roundHp)`. `speedBonus = clamp(round(max * (1 - responseMs / windowMs)), 0, max)`. `pointsFor = effective[option] + speedBonus + (isLead ? casterBonus : 0)`. `endingFor`: majority of `blendShares(finalLead, finalSupport)`; tiers from `content.scoring.tiers`; below fragile returns `ending: 'holds'`. `consistencyAward`: players with votes for rounds 0 to 3 only; `synergyHits(votes[3].option, [votes[0..2]])`; max hits then max score; `null` when none qualify. `tableAward`: group by non-null `table`, keep groups of 2 or more, highest mean `score`, `null` when none.

- [ ] **Step 4: Run tests and type-check**

Run: `npx vitest run tests/scoring.test.ts && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 5: Commit and push**

```bash
git add shared/scoring.ts tests/scoring.test.ts && git commit -m "feat: scoring with lead and support shares, alignment, awards" && git push
```

---

### Task 3: Names, room codes and the room reducer

**Files:**
- Create: `shared/names.ts`, `shared/codes.ts`, `shared/room-logic.ts`
- Test: `tests/names.test.ts`, `tests/codes.test.ts`, `tests/room-logic.test.ts`

**Interfaces:**
- Consumes everything from Tasks 1 and 2.
- Produces:
  - `generateName(seed: string): string` (two capitalised words from fixed lists, deterministic for a seed)
  - `sanitizeName(raw: string | undefined, seed: string): string` (16-character cap, generated fallback)
  - `sanitizeTable(raw: string | undefined): string | null` (same cleaning, `null` when empty)
  - `makeRoomCode(rng: () => number): string`, `isValidCode(s: string): boolean`
  - `initialState(code: string, hostKey: string, now: number, content: CaseContent): RoomState`
  - `reduce(state: RoomState, ev: RoomEvent, content: CaseContent): { state: RoomState; effects: Effect[] }` (pure; never mutates the input)
  - `tallyFor(state: RoomState, round: number): Tally` (lead + support + synthetic)
  - `leadTallyFor(state: RoomState, round: number, content: CaseContent): Tally`
  - `supportTallyFor(state: RoomState, round: number, content: CaseContent): Tally` (non-lead players plus synthetic)
  - `hostView(state: RoomState, now: number, content: CaseContent): HostView`
  - `playerView(state: RoomState, clientId: string, now: number, content: CaseContent): PlayerView | null`

- [ ] **Step 1: Write the failing name and code tests**

```ts
// tests/names.test.ts
import { it, expect } from 'vitest';
import { generateName, sanitizeName, sanitizeTable } from '../shared/names';
it('generates a stable two-word name per seed', () => {
  expect(generateName('abc')).toBe(generateName('abc'));
  expect(generateName('abc').split(' ')).toHaveLength(2);
  expect(generateName('abc')).not.toBe(generateName('abd'));
});
it('sanitises names and tables', () => {
  expect(sanitizeName('  Sarah\u0007  ', 's')).toBe('Sarah');
  expect(sanitizeName('AVeryLongNameIndeed', 's')).toBe('AVeryLongNameInd');
  expect(sanitizeName('   ', 's')).toBe(generateName('s'));
  expect(sanitizeName(undefined, 's')).toBe(generateName('s'));
  expect(sanitizeTable('  Table 3 ')).toBe('Table 3');
  expect(sanitizeTable('')).toBeNull();
  expect(sanitizeTable(undefined)).toBeNull();
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
import { initialState, reduce, tallyFor, leadTallyFor, supportTallyFor, hostView, playerView } from '../shared/room-logic';
import type { RoomState, RoomEvent, HostCmd } from '../shared/types';
const c = loadContent(raw);
const KEY = 'host-secret';
const t0 = 1_000_000;
const mk = () => initialState('ABCD', KEY, t0, c);
const cmd = (s: RoomState, k: HostCmd, now = t0, key = KEY) => reduce(s, { type: 'cmd', key, cmd: k, now }, c);
const run = (s: RoomState, evs: RoomEvent[]) => evs.reduce((acc, ev) => reduce(acc.state, ev, c), { state: s, effects: [] as any[] });
const join = (id: string, name: string | undefined, role = 'government', now = t0, table?: string): RoomEvent => ({ type: 'join', clientId: id, name, role, table, now });
const vote = (id: string, round: number, option: any, now = t0 + 6000): RoomEvent => ({ type: 'vote', clientId: id, round, option, now });
// p1 Ann is a citizen (Rogue), so p1 leads round 0; p2 and p3 are support in round 0
const toVote = () => run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'government'), join('p3', 'Cy', 'microsoft'), { type: 'cmd', key: KEY, cmd: { k: 'start' }, now: t0 }, { type: 'cmd', key: KEY, cmd: { k: 'openVote' }, now: t0 }]).state;

describe('lobby and joins', () => {
  it('starts in lobby with full boss hp and round -1', () => {
    const s = mk();
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400); expect(s.voteWindowMs).toBe(30000);
  });
  it('joins keep identity on rejoin, generate names, clean tables', () => {
    const s = run(mk(), [join('p1', 'Ann', 'citizen'), join('p2', undefined, 'business', t0, '  Table 3 '), join('p1', 'Other', 'microsoft')]).state;
    expect(Object.keys(s.players)).toHaveLength(2);
    expect(s.players.p1).toMatchObject({ name: 'Ann', role: 'citizen', table: null });
    expect(s.players.p2.name.split(' ')).toHaveLength(2);
    expect(s.players.p2.table).toBe('Table 3');
  });
  it('rejects a bad role and does not create the player', () => {
    const r = reduce(mk(), join('p4', 'Dee', 'dragon'), c);
    expect(r.state.players.p4).toBeUndefined();
    expect(r.effects).toContainEqual({ type: 'error', clientId: 'p4', msg: 'bad role' });
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
    const s = run(toVote(), [vote('p1', 0, 'B'), vote('p1', 0, 'A'), join('p1', 'Ann', 'citizen'), vote('p1', 0, 'C'), vote('p2', 0, 'B')]).state;
    expect(tallyFor(s, 0)).toEqual({ A: 0, B: 2, C: 0, D: 0 });
  });
  it('splits the tally into the lead class and the rest, synthetic votes count as support', () => {
    const s = cmd(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, { k: 'injectVotes', counts: { D: 3 } }).state;
    expect(leadTallyFor(s, 0, c)).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(supportTallyFor(s, 0, c)).toEqual({ A: 1, B: 0, C: 0, D: 3 });
    expect(tallyFor(s, 0)).toEqual({ A: 1, B: 1, C: 0, D: 3 });
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
    expect(tallyFor(reduce(ticked.state, vote('p2', 0, 'B', t0 + 30500), c).state, 0).B).toBe(0);
    expect(reduce(s, { type: 'tick', now: t0 + 1000 }, c).state.phase).toBe('vote');
  });
  it('injectVotes only while accepting votes, and synthetic voters never appear as players', () => {
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
  it('prefers voters of the lead class, only in locked', () => {
    const s = locked();
    expect(cmd(toVote(), { k: 'callout', pick: 0.1 }).effects).toContainEqual({ type: 'error', msg: 'bad phase' });
    for (const pick of [0.1, 0.9]) {
      const co = cmd(s, { k: 'callout', pick }).state.callouts[0][0];
      expect(co).toMatchObject({ playerId: 'p1', option: 'B', status: 'pending' });
    }
  });
  it('falls back to other voters once the lead class is used up, never a non-voter or a repeat', () => {
    const s = cmd(cmd(locked(), { k: 'callout', pick: 0.5 }).state, { k: 'judge', awarded: true }).state;
    expect(cmd(s, { k: 'callout', pick: 0.5 }).state.callouts[0][1].playerId).toBe('p2');   // p3 did not vote, p1 already called
  });
  it('allows an explicit pick, refuses a second pending call-out and a third call-out', () => {
    const s = cmd(locked(), { k: 'callout', playerId: 'p2' }).state;
    expect(s.callouts[0][0].playerId).toBe('p2');
    expect(cmd(s, { k: 'callout', pick: 0.2 }).effects).toContainEqual({ type: 'error', msg: 'call-out pending' });
    let t = cmd(s, { k: 'judge', awarded: false }).state;
    t = cmd(cmd(t, { k: 'callout', pick: 0.2 }).state, { k: 'judge', awarded: true }).state;
    expect(cmd(t, { k: 'callout', pick: 0.2 }).effects).toContainEqual({ type: 'error', msg: 'call-out limit' });
    expect(cmd(t, { k: 'judge', awarded: true }).effects).toContainEqual({ type: 'error', msg: 'no pending call-out' });
  });
  it('falls back to a nameless hand call-out when nobody is eligible', () => {
    const s = cmd(cmd(cmd(mk(), { k: 'start' }).state, { k: 'openVote' }).state, { k: 'closeVote' }).state;
    expect(cmd(s, { k: 'callout', pick: 0.3 }).state.callouts[0][0]).toMatchObject({ playerId: null, option: null, status: 'pending' });
  });
  it('judging sets call-out points; reveal adds rally damage and the points, pending counts as declined', () => {
    const s = cmd(cmd(locked(), { k: 'callout', playerId: 'p1' }).state, { k: 'judge', awarded: true }).state;
    expect(s.callouts[0][0]).toMatchObject({ status: 'awarded', points: 30 });
    const t = cmd(s, { k: 'callout', playerId: 'p2' }).state;           // left pending on purpose
    const r = cmd(t, { k: 'reveal' }).state;
    // lead B only, support A only: blended A 0.5 B 0.5, base = 20 + 40 = 60, tie so no focus, majorities differ so no alignment, rally 10 -> 70
    expect(r.damageLog[0].rally).toBe(10); expect(r.damageLog[0].total).toBe(70);
    expect(r.callouts[0][1]).toMatchObject({ status: 'declined', points: 10 });
    expect(r.players.p1.lastPoints).toBe(80 + 16 + 10 + 30);   // score, speed, caster, call-out awarded
    expect(r.players.p2.lastPoints).toBe(40 + 16 + 10);        // score, speed, call-out spoke
  });
});

describe('reveal and scoring', () => {
  const revealed = () => {
    const s = run(toVote(), [vote('p1', 0, 'B', t0 + 6000), vote('p2', 0, 'B', t0 + 6000), vote('p3', 0, 'A', t0 + 15000)]).state;
    const withExhibit = { ...s, exhibits: { 0: ['t1a', 't1b'] } };
    return cmd(cmd(withExhibit, { k: 'closeVote' }).state, { k: 'reveal' }).state;
  };
  it('applies damage, records the majority, awards points with the caster bonus', () => {
    const s = revealed();
    const d = s.damageLog[0];
    // lead B 1; support A 1, B 1 (tied): blended A 0.25 B 0.75, base = 10 + 60 = 70, focus 15, alignment 0 (support tied), exhibit 10 -> 95
    expect(d.total).toBe(95); expect(d.alignment).toBe(0); expect(d.supportTied).toBe(true); expect(d.leadTied).toBe(false);
    expect(s.bossHp).toBe(305);
    expect(s.majorities[0]).toBe('B');
    expect(s.players.p1.lastPoints).toBe(80 + 16 + 10); expect(s.players.p1.score).toBe(106);
    expect(s.players.p2.lastPoints).toBe(80 + 16);
    expect(s.players.p3.lastPoints).toBe(40 + 10);
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
  it('kick removes a player, their votes, bans the client id and tells the phone', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const r = cmd(s, { k: 'kick', playerId: 'p1' });
    expect(r.state.players.p1).toBeUndefined(); expect(tallyFor(r.state, 0).B).toBe(0);
    expect(r.state.banned).toEqual(['p1']);
    expect(r.effects).toContainEqual({ type: 'kicked', clientId: 'p1' });
    const again = reduce(r.state, join('p1', 'Ann', 'citizen'), c);
    expect(again.state.players.p1).toBeUndefined();
    expect(again.effects).toContainEqual({ type: 'kicked', clientId: 'p1' });
    expect(again.effects).toContainEqual({ type: 'error', clientId: 'p1', msg: 'removed' });
  });
  it('reset returns to lobby keeping players and bans but clearing scores, damage and call-outs', () => {
    const banned = cmd(revealed(), { k: 'kick', playerId: 'p3' }).state;
    const s = cmd(banned, { k: 'reset' }).state;
    expect(s.phase).toBe('lobby'); expect(s.round).toBe(-1); expect(s.bossHp).toBe(400);
    expect(Object.keys(s.players)).toHaveLength(2); expect(s.players.p1.score).toBe(0); expect(s.damageLog).toEqual([]); expect(s.callouts).toEqual({});
    expect(s.banned).toEqual(['p3']);
  });
});

describe('views', () => {
  it('host view hides the key and carries the lead role and both tallies', () => {
    const v = hostView(run(toVote(), [vote('p1', 0, 'B'), vote('p2', 0, 'A')]).state, t0 + 1, c);
    expect((v as any).hostKey).toBeUndefined();
    expect(v.lead).toBe('citizen');
    expect(v.leadTally).toEqual({ A: 0, B: 1, C: 0, D: 0 }); expect(v.supportTally).toEqual({ A: 1, B: 0, C: 0, D: 0 }); expect(v.tally).toEqual({ A: 1, B: 1, C: 0, D: 0 });
    expect(v.serverNow).toBe(t0 + 1);
  });
  it('player view carries role, lead flag and picks, hides tallies until reveal, ranks players', () => {
    const s = run(toVote(), [vote('p1', 0, 'B')]).state;
    const v = playerView(s, 'p1', t0 + 1, c)!;
    expect(v).toMatchObject({ role: 'citizen', lead: 'citizen', isLead: true, myVote: 'B', playerCount: 3, rank: 1, callout: null, tally: null, leadTally: null });
    expect(v.picks).toEqual(['B']);
    expect(playerView(s, 'p2', t0, c)!.isLead).toBe(false);
    const r = cmd(cmd(s, { k: 'closeVote' }).state, { k: 'reveal' }).state;
    expect(playerView(r, 'p1', t0, c)!.tally).toEqual({ A: 0, B: 1, C: 0, D: 0 });
    expect(playerView(r, 'p2', t0, c)!.rank).toBe(2);
    expect(playerView(r, 'p2', t0, c)!.picks).toEqual([null]);
    expect(playerView(r, 'nobody', t0, c)).toBeNull();
    expect(playerView(mk(), 'p1', t0, c)).toBeNull();
  });
  it('player view carries the pending call-out and flags the called player', () => {
    const s = cmd(cmd(run(toVote(), [vote('p1', 0, 'B')]).state, { k: 'closeVote' }).state, { k: 'callout', playerId: 'p1' }).state;
    expect(playerView(s, 'p1', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: true });
    expect(playerView(s, 'p3', t0, c)!.callout).toEqual({ name: 'Ann', option: 'B', isMe: false });
    expect(hostView(s, t0, c).callouts[0][0].playerId).toBe('p1');
  });
});
```

- [ ] **Step 3: Run to see them fail**

Run: `npx vitest run tests/names.test.ts tests/codes.test.ts tests/room-logic.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 4: Implement `shared/names.ts` and `shared/codes.ts`**

`names.ts`: two word lists of 24 each (first: Steam, Rift, Olkaria, Savanna, Geothermal, Baseload, Acacia, Silicon, Nairobi, Azure, Pylon, Ochre…; second: Gecko, Giraffe, Heron, Weaver, Mongoose, Hornbill, Ibis, Zebra, Dikdik, Crane, Serval, Oryx…), FNV-1a 32-bit over the seed to index both. `clean(raw)`: strip `[\u0000-\u001f\u007f]`, trim, slice 16. `sanitizeName = clean || generateName(seed)`; `sanitizeTable = clean || null`. `codes.ts`: alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ`, `isValidCode = /^[A-HJ-NP-Z]{4}$/`.

- [ ] **Step 5: Implement `shared/room-logic.ts`**

Transitions exactly as spec 6.2. Error messages: `'bad host key'`, `'bad role'`, `'removed'`, `'wrong round'`, `'unknown player'`, `'already voted'`, `'not accepting votes'`, `'not in travel'`, `'bad phase'`, `'call-out pending'`, `'call-out limit'`, `'no pending call-out'`. `initialState` has `banned: []`. `kick` removes the player, appends the id to `banned` (once) and emits `{ type: 'kicked', clientId }`; a `join` from a banned id emits both `{ type: 'kicked', clientId }` and the `'removed'` error and changes nothing. `reset` keeps `banned`. Lead role of a round = `content.rounds[round].lead`. `leadTallyFor` counts votes of players whose `role` is the lead; `supportTallyFor` counts the rest plus `synthetic[round]`; `tallyFor` is their sum. Call-out eligibility: voters this round not already in `callouts[round]`; if any eligible voter has the lead role, choose among those only; explicit `playerId` wins if eligible; otherwise index `floor(pick * eligible.length)` over ids sorted by `joinedAt` then id; no eligible voter → `{ playerId: null, option: null }`. Judge sets `status` and `points` (`calloutPointsAwarded` or `calloutPointsSpoke`). Reveal: pending call-outs become `declined` with `calloutPointsSpoke`; `rallies = count(awarded)`; `computeDamage({ lead: leadTallyFor, support: supportTallyFor, prior: majorities.slice(0, round), exhibits: (exhibits[round] ?? []).length, rallies })`; `bossHp = max(0, bossHp - total)`; per player with a vote this round `lastPoints = pointsFor({ ..., isLead: player.role === lead }) + Σ their call-out points this round`, players without a vote get `lastPoints = 0`; `score += lastPoints`. `openVote` uses `seconds ?? content.scoring.voteSeconds`. `reopen` as in Global Constraints. `playerView.rank = 1 + count(players with score strictly greater)`; `picks` has one entry per round 0 to `state.round` (empty in the lobby); `isLead = player.role === lead`; `tally`, `leadTally`, `supportTally` are `null` before `reveal`. Always return new objects.

- [ ] **Step 6: Run tests and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS.

- [ ] **Step 7: Commit and push**

```bash
git add shared tests && git commit -m "feat: room reducer with roles, lead and support tallies, call-outs" && git push
```

---

### Task 4: Cloudflare Worker and Durable Object

**Files:**
- Create: `wrangler.jsonc`, `worker/index.ts`, `worker/room.ts`, `scripts/simulate-class.ts`
- Create: minimal `host/index.html` and `player/index.html` placeholders so the assets directory exists (Tasks 5 and 7 replace them)

**Interfaces:**
- Consumes `reduce`, `initialState`, `hostView`, `playerView` (Task 3), `makeRoomCode`, `isValidCode` (Task 3), `loadContent` (Task 1), message types (Task 1).
- Produces HTTP: `POST /api/rooms → 201 { code, hostKey, joinUrl }`; `GET /ws/:code?role=host&key=…` and `GET /ws/:code?role=player&clientId=…` → WebSocket; `GET /j/:code` → player page; `GET /` → 302 `/host/`. WebSocket protocol: client sends `ClientMsg` JSON, server sends `ServerMsg` JSON; the host receives `{ t: 'host', state }` after every change, each player `{ t: 'you', view }`.
- Produces `scripts/simulate-class.ts`: `npm run simulate -- --base http://localhost:8787 --code ABCD --n 60` joins N players with roles round-robin over the four roles and table names `Table 1` to `Table 15`.

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

`export class Room extends DurableObject<Env>` with: `fetch(req)` handling `POST /init` (store `initialState`) and WebSocket upgrades (`new WebSocketPair()`, `ws.serializeAttachment({ role, clientId })`, `this.ctx.acceptWebSocket(server, [role])`, 403 on a bad host key); `webSocketMessage(ws, raw)` mapping `ClientMsg` to `RoomEvent` (a `callout` without `pick` gets `pick: Math.random()`); `apply(event)` = reduce, `storage.put('state')`, run effects (`setAlarm` → `storage.setAlarm`, `clearAlarm` → `storage.deleteAlarm`, `error` → `{t:'error'}` to the matching socket or the host, `kicked` → `{t:'kicked'}` to every socket whose attachment has that client id, then `ws.close(4001, 'removed')`), `broadcast()`; `broadcast()` sends `hostView(state, Date.now(), content)` to host sockets and `playerView(...)` to each player socket (skip `null`); `alarm()` applies `{ type: 'tick' }` and deletes storage after 6 hours of silence; `webSocketClose` is a no-op.

- [ ] **Step 3: Implement `worker/index.ts`**

Routes as in the Interfaces block. Room creation: `code = makeRoomCode(Math.random)`, `hostKey = crypto.randomUUID()`, `stub.fetch('https://room/init', { method: 'POST', body })`, `joinUrl = new URL('/j/' + code, req.url).toString()`. `/ws/:code`: `isValidCode` then forward to the stub. `/j/:code`: `env.ASSETS.fetch(new Request(new URL('/player/index.html', req.url), req))`. `/`: 302 to `/host/`. Else `env.ASSETS.fetch(req)`.

- [ ] **Step 4: Write `scripts/simulate-class.ts`**

Parse `--base`, `--code`, `--n` (default 60). Client i: role `ROLES[i % 4]`, table `Table ${floor(i / 4) + 1}`, name `Sim ${i}`; open `/ws/:code?role=player&clientId=sim-i`, send `join`. On `{t:'you'}` with `phase === 'vote'` and `myVote === null`, vote after `Math.random() * 20000` ms, option weighted 1:3:1:2 (A:B:C:D). Log `joined N`, per round `round r: votes sent`, exit on `leaderboard`.

- [ ] **Step 5: Smoke test locally**

Create the two placeholder HTML files, `npm run build`, `npm run dev:worker`. In a second terminal: `curl -s -X POST http://localhost:8787/api/rooms` → `{"code":"XXXX","hostKey":"…","joinUrl":"http://localhost:8787/j/XXXX"}`. `npm run simulate -- --base http://localhost:8787 --code XXXX --n 60` → `joined 60`. With `npx wscat -c "ws://localhost:8787/ws/XXXX?role=host&key=HOSTKEY"`: send `{"t":"cmd","key":"HOSTKEY","cmd":{"k":"start"}}`, then `openVote`, wait 30 s, then `callout` (expect a `Sim` name whose role is `citizen` in `callouts[0][0]`), `judge` awarded, then `reveal`. Expected: the phase locks at 30 s without `closeVote`; after reveal `damageLog[0].total` is between 50 and 100 and `rally` is 10; `players` has 60 entries.

- [ ] **Step 6: Type-check, commit, push**

```bash
npx tsc --noEmit && npx vitest run && git add -A && git commit -m "feat: worker, durable object room, class simulator" && git push
```

---

### Task 5: Player page (phone)

**Files:**
- Create: `player/index.html`, `player/main.ts`, `player/net.ts`, `player/render.ts`, `player/styles.css`
- Test: `tests/player-render.test.ts` (`// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes `PlayerView`, `ClientMsg`, `ServerMsg`, `Role`, `ROLES` (Task 1), `CaseContent` (Task 1), `synergyHits` (Task 2), WebSocket protocol (Task 4).
- Produces `player/render.ts`: `render(root: HTMLElement, view: PlayerView | null, content: CaseContent, ui: UiState, actions: Actions): void` with `UiState = { status: 'connecting' | 'joining' | 'joined' | 'kicked' | 'offline'; name: string; role: Role | null; table: string }` and `Actions = { join(name: string, role: Role, table: string): void; vote(option: OptionId): void }`. Also `formatCountdown(deadline: number, serverNow: number, localNow: number, localAtServerNow: number): string` (`"23 s"`, never negative).
- Produces `player/net.ts`: `class PlayerSocket { constructor(code: string, clientId: string); onView(cb): void; onStatus(cb: (s: 'open' | 'closed' | 'kicked') => void): void; send(msg: ClientMsg): void }` with reconnect (1 s, 2 s, 4 s, max 10 s) and a re-sent `join` on every open. A `{ t: 'kicked' }` message or a close with code 4001 reports `'kicked'` and stops all reconnecting; `main.ts` then sets `status: 'kicked'` and never sends `join` again in that tab.

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
const base: PlayerView = { phase: 'vote', round: 0, serverNow: 1000, voteDeadline: 31000, voteWindowMs: 30000, name: 'Ann', role: 'citizen', table: null, lead: 'citizen', isLead: true, myVote: null, lastPoints: 0, score: 0, rank: 1, playerCount: 12, tally: null, leadTally: null, supportTally: null, majorities: [], picks: [], callout: null };
const joined = { status: 'joined' as const, name: 'Ann', role: 'citizen' as const, table: '' };
const noop = { join: vi.fn(), vote: vi.fn() };
const mount = () => { const el = document.createElement('div'); document.body.appendChild(el); return el; };

describe('player render', () => {
  it('requires a name and a role before joining', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn() };
    render(el, null, c, { status: 'joining', name: '', role: null, table: '' }, actions);
    const input = el.querySelector('input[name=nickname]') as HTMLInputElement;
    const roles = [...el.querySelectorAll('button[data-role]')];
    const button = el.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(input.maxLength).toBe(16);
    expect(roles.map(r => r.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(roles[1].textContent).toContain('Knight'); expect(roles[1].textContent).toContain('Kenyan Government');
    expect((el.querySelector('input[name=table]') as HTMLInputElement).maxLength).toBe(16);
    expect(button.disabled).toBe(true);
    input.value = 'Sarah'; input.dispatchEvent(new Event('input'));
    expect(button.disabled).toBe(true);
    (roles[1] as HTMLButtonElement).click();
    expect(button.disabled).toBe(false);
    button.click();
    expect(actions.join).toHaveBeenCalledWith('Sarah', 'government', '');
  });
  it('renders four vote buttons with phone labels, says when your class leads, and sends a vote', () => {
    const el = mount(); const actions = { join: vi.fn(), vote: vi.fn() };
    render(el, base, c, joined, actions);
    const buttons = [...el.querySelectorAll('button[data-option]')];
    expect(buttons.map(b => b.getAttribute('data-option'))).toEqual(['A', 'B', 'C', 'D']);
    expect(buttons[1].textContent).toContain('Yes to 60 to 100 MW, tied');
    expect(el.textContent).toContain('Your class leads this round');
    (buttons[1] as HTMLButtonElement).click();
    expect(actions.vote).toHaveBeenCalledWith('B');
    render(el, { ...base, isLead: false }, c, joined, actions);
    expect(el.textContent).not.toContain('Your class leads this round');
  });
  it('shows the locked state, the call-out, and the result with the full debrief', () => {
    const el = mount();
    render(el, { ...base, myVote: 'B' }, c, joined, noop);
    expect(el.textContent).toContain('Locked'); expect(el.querySelectorAll('button[data-option]')).toHaveLength(0);
    render(el, { ...base, phase: 'locked', myVote: 'B', callout: { name: 'Ann', option: 'B', isMe: true } }, c, joined, noop);
    expect(el.textContent).toMatch(/You're up/); expect(el.textContent).toContain('Yes to 60 to 100 MW, tied');
    render(el, { ...base, phase: 'locked', myVote: 'A', callout: { name: 'Ann', option: 'B', isMe: false } }, c, { ...joined, name: 'Cy' }, noop);
    expect(el.textContent).toContain('Ann is defending B');
    render(el, { ...base, phase: 'reveal', myVote: 'B', picks: ['B'], lastPoints: 106, score: 106, rank: 3, tally: { A: 1, B: 9, C: 1, D: 1 } }, c, joined, noop);
    expect(el.textContent).toContain('106'); expect(el.textContent).toMatch(/3(rd)? of 12/);
    expect(el.textContent).toContain(c.rounds[0].options[1].debrief.slice(0, 40));
  });
  it('summarises the four picks at the end and tells a kicked player plainly', () => {
    const el = mount();
    render(el, { ...base, phase: 'ending', round: 3, picks: ['B', 'C', 'B', 'B'], majorities: ['B', 'C', 'B', 'B'], score: 400, rank: 2 }, c, joined, noop);
    expect(el.textContent).toMatch(/B.*C.*B.*B/s); expect(el.textContent).toMatch(/3 of 3/);
    render(el, null, c, { status: 'kicked', name: 'Ann', role: 'citizen', table: '' }, noop);
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
Expected: FAIL, module not found.

- [ ] **Step 4: Implement `player/render.ts`**

One function per state: `joinForm` (name input `name="nickname" maxlength="16" required`; four `button[data-role]` from `content.roles` in order showing class name and stakeholder, the selected one `aria-pressed="true"`; table input `name="table" maxlength="16"` with placeholder "Table (optional)"; `button[type=submit]` "Join" disabled until the trimmed name is non-empty and a role is selected), `waiting` ("You're in as {name}, {className}. Watch the screen."), `voteButtons` (letter, inline SVG shape, phone label; a line "Your class leads this round" when `isLead`), `locked` ("Locked: {letter}. {phone label}"), `calledOut` ("You're up. Defend {letter}: {phone label}." and `navigator.vibrate?.(200)`), `someoneCalled` ("{name} is defending {letter}." or "Someone is defending their choice."), `result` ("+{lastPoints} this round", "{score} total", "{rank} of {playerCount}", then for rounds 1 to 3 "Why {letter} scored what it did" with the full `debrief` of the player's option, and for round 4 "Your pick {letter} fits {hits} of the three earlier decisions" via `synergyHits(myVote, majorities.slice(0, 3), content.synergy)`; or "You did not vote this round."), `ending` (the four `picks` with phone labels, "Coherence: {hits} of 3" via `synergyHits(picks[3], picks.slice(0, 3), content.synergy)`, rank), `kicked` ("You were removed from the room."), `offline` ("Reconnecting…"). Phase mapping: `lobby|travel` → waiting; `vote` → voteButtons or locked; `locked` → calledOut when `callout?.isMe`, someoneCalled when `callout`, else locked or "You did not vote this round."; `reveal` → result; `ending|leaderboard` → ending.

- [ ] **Step 5: Implement `player/net.ts`, `player/main.ts`, `player/index.html`, `player/styles.css`**

`main.ts`: code from `location.pathname.match(/\/j\/([A-Z]{4})/)`, client id from `localStorage['olkaria.clientId']`, name, role and table drafts from `localStorage['olkaria.join']`; on submit store them and send `join`; re-render on every view; countdown tick every 250 ms while `phase === 'vote'`. `index.html`: viewport meta, `<main id="app">`, DM Sans or system sans. `styles.css`: anti-vibecode tokens, 17 px base, flat buttons with dim strokes, role buttons in a 2 × 2 grid with inline SVG class icons (dagger, shield, lute, staff) and no colour, the four vote buttons full width 64 px tall with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` labels and the option fills `#b5473d`, `#3f6fa3`, `#c9a227`, `#4f8a5b` with white letter and shape, `:active` darkens 8%, disabled greys out.

- [ ] **Step 6: Run tests, build, check bundle size**

Run: `npx vitest run tests/player-render.test.ts && npm run build && ls -la dist/assets | grep player`
Expected: tests PASS; player JS bundle under 100 KB.

- [ ] **Step 7: Manual check on a phone**

`npm run dev:worker` (or `wrangler dev --ip 0.0.0.0`), create a room with curl, open `http://<laptop-lan-ip>:8787/j/CODE` on a phone, join as a Knight, drive the host with `wscat`: open the vote, tap B, confirm "Locked: B", reload the phone mid-vote (still locked, no fresh buttons), reveal, confirm points and the debrief appear.

- [ ] **Step 8: Commit and push**

```bash
git add player tests/player-render.test.ts && git commit -m "feat: phone page with name, role and table" && git push
```

---

### Task 6: Host networking: online client, offline client, session memory

**Files:**
- Create: `host/net.ts`, `host/session.ts`
- Test: `tests/offline-client.test.ts`, `tests/session.test.ts` (`// @vitest-environment happy-dom` for session)

**Interfaces:**
- Consumes `reduce`, `initialState`, `hostView` (Task 3), `effectiveScores` (Task 2), types (Task 1), HTTP and WS protocol (Task 4).
- Produces:
  ```ts
  export interface RoomClient {
    readonly mode: 'online' | 'offline';
    connect(): Promise<{ code: string; joinUrl: string }>;
    send(cmd: HostCmd): void;
    onState(cb: (view: HostView) => void): () => void;
    onError(cb: (msg: string) => void): () => void;
    addBots(n: number): void;
  }
  export class WsRoomClient implements RoomClient { constructor(baseUrl: string) }
  export class OfflineRoomClient implements RoomClient { constructor(content: CaseContent, now?: () => number); tick(): void }
  export function createRoomClient(loc: Location, content: CaseContent): RoomClient
  export function botTally(content: CaseContent, roundIndex: number, prior: (OptionId | null)[], n: number, rng: () => number): Tally
  ```
  and `host/session.ts`: `rememberRoom(code, hostKey)`, `recallRoom(): { code; hostKey } | null`, `forgetRoom()` over `sessionStorage['olkaria.room']`.

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
  expect(views.at(-1).phase).toBe('vote'); expect(views.at(-1).supportTally.B).toBe(3); expect(views.at(-1).lead).toBe('citizen');
  t = 31000; client.tick();
  expect(views.at(-1).phase).toBe('locked');
  client.send({ k: 'callout' }); client.send({ k: 'judge', awarded: true });
  client.send({ k: 'reveal' });
  expect(views.at(-1).damageLog[0].total).toBe(100);   // all support on B: 80 + focus 15 + rally 10, capped
  expect(views.at(-1).damageLog[0].alignment).toBe(0);
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

`OfflineRoomClient`: `state = initialState('OFFLINE', 'offline', now(), content)`; `send(cmd)` reduces with key `'offline'` (a `callout` without `pick` gets `Math.random()`); `tick()` public and on a 250 ms interval from `connect()`; emits `hostView(state, now(), content)` after every reduce; errors via `onError`. `botTally`: weights `effectiveScores(...)[o] + 10`, sample `n` with `rng`. `addBots(n)` → `injectVotes` with `botTally` for the current round and `state.majorities`. `WsRoomClient.connect()`: `recallRoom()` or `POST /api/rooms` then `rememberRoom`; open `/ws/:code?role=host&key=…`; reconnect with backoff; `send` wraps `{ t: 'cmd', key, cmd }`; `{t:'host'}` → `onState`, `{t:'error'}` → `onError`. `createRoomClient`: `?mode=offline` → offline, else `new WsRoomClient(loc.origin)`.

- [ ] **Step 4: Run tests and type-check, commit, push**

```bash
npx vitest run && npx tsc --noEmit && git add host/net.ts host/session.ts tests/offline-client.test.ts tests/session.test.ts && git commit -m "feat: host room clients (online, offline, bots)" && git push
```

---

### Task 7: Phaser bootstrap, HTML HUD, integer zoom, router, Lobby scene, hotkeys

**Files:**
- Create: `host/index.html`, `host/main.ts`, `host/scale.ts`, `host/router.ts`, `host/hotkeys.ts`, `host/hud/Hud.ts`, `host/hud/hud.css`, `host/art/placeholders.ts`, `host/scenes/Boot.ts`, `host/scenes/Lobby.ts` (plus empty `Travel`, `Battle`, `Ending`, `Leaderboard` scene classes for later tasks)
- Test: `tests/scale.test.ts`, `tests/router.test.ts`, `tests/hud.test.ts` (`// @vitest-environment happy-dom`)

**Interfaces:**
- Consumes `RoomClient` (Task 6), `CaseContent`, `HostView`, `Role`, `OptionId` (Task 1).
- Produces registry keys read by every scene: `game.registry.get('client'): RoomClient`, `'content': CaseContent`, `'hud': Hud`, `'view': HostView | null` (scenes listen to `registry.events` `changedata-view`).
- Produces `host/scale.ts`: `integerZoom(winW: number, winH: number, w = 320, h = 180): number` (`max(1, floor(min(winW / w, winH / h)))`) and `applyZoom(game: Phaser.Game, hudRoot: HTMLElement): void` (sets `game.scale.setZoom`, centres the canvas, positions `hudRoot` over the canvas rect, sets `--zoom`; called at boot and on `resize`).
- Produces `host/router.ts`: `sceneFor(view: { phase: Phase; round: number }, active: { key: string; round: number } | null): { key: string; data: { round: number; resume: boolean } } | null` with the rules in spec 6.3 Reconnect: `lobby` → `Lobby`; `travel` → `Travel` unless the active scene is `Travel` or `Battle` for that round; `vote`, `locked`, `reveal` → `Battle` with `resume: true` unless the active scene is `Battle` for that round; `ending` → `Ending`; `leaderboard` → `Leaderboard`; `null` when the active scene fits.
- Produces `host/hud/Hud.ts`: `class Hud` with `constructor(root: HTMLElement)` and methods `showLobby(a: { qrDataUrl: string | null; code: string; joinUrl: string; count: number; roleCounts: Record<Role, number>; classNames: Record<Role, string>; recent: string[]; offline: boolean; smith: string; tanui: string })` (`recent` is the last eight joiners as "Ann, Knight", already emptied by the caller when names are hidden), `showNarration(a: { boss: string; title: string; narration: string; quote?: string; footer: string })`, `showOptions(a: { options: { letter: OptionId; screen: string }[]; leadLabel: string; timerText: string; votedText: string; leadShares: Record<OptionId, number> | null; supportShares: Record<OptionId, number> | null; footer: string })`, `showBanner(a: { name: string | null; letter: OptionId | null; phone: string | null; footer: string } | null)`, `flashRally(text: string, ms?: number)`, `showDebrief(a: { lines: { letter: OptionId; damage: number; text: string }[]; breakdown: { base: number; focus: number; alignment: number; exhibit: number; rally: number; total: number; capped: boolean }; alignment: string; rally: string | null; discuss: string })` (renders the breakdown as "Base 62.5, Focus 0, Party aligned +10, Exhibits +10, Rally 0. Total 83", adding " (capped at 100)" when `capped`), `showEnding(a: { title: string; tier: string; split: Record<OptionId, number>; mustBeTrue: string[]; risk: string[]; holds: { round: string; chose: string; needed: string }[] | null })`, `showLeaderboard(a: { rows: { name: string; className: string; score: number }[]; consistent: string; table: string | null; split: Record<OptionId, number>; question: string })`, `showToast(text: string, ms?: number)`, `showKeymap(show: boolean)`, `clear()`. Exports `OPTION_COLORS: Record<OptionId, string>`.
- Produces `host/hotkeys.ts`: `installHotkeys(game: Phaser.Game, client: RoomClient, hud: Hud): void` handling 1 to 4, Shift+1 to Shift+4, B, C, Y, N, H, F, Esc, R and Shift+R per spec 6.5; Y and N send `judge` only when `view.phase === 'locked'` and a call-out is pending, otherwise ignored here (the Travel scene owns N for skipping); R sends `reopen`; Shift+R once shows `hud.showToast('Press Shift+R again to reset', 3000)` and a second Shift+R within 3 s sends `reset`. Space, arrows and A are scene-level.
- Produces `host/art/placeholders.ts`: `makePlaceholders(scene: Phaser.Scene): void` creating textures `class-citizen`, `class-government`, `class-business`, `class-microsoft` (12 × 16 neutral figures), `tile-ground`, `tile-platform`, `exhibit`, `gate`, `boss-grid`, `boss-debt`, `boss-fog`, `boss-core` (64 × 48 silhouettes), and a 6 px bitmap digit font `digits` for damage numbers.

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
  expect(sceneFor({ phase: 'travel', round: 1 }, { key: 'Battle', round: 1 })).toBeNull();
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
const sh = (A: number, B: number, C: number, D: number) => ({ A, B, C, D });
it('draws four cards in letter order with letter colours and two bars each', () => {
  const root = document.createElement('div'); document.body.appendChild(root);
  const hud = new Hud(root);
  hud.showOptions({ options: [{ letter: 'A', screen: 'a' }, { letter: 'B', screen: 'b' }, { letter: 'C', screen: 'c' }, { letter: 'D', screen: 'd' }],
    leadLabel: 'Rogues', timerText: '30 s', votedText: '0 of 3 voted', leadShares: sh(0.1, 0.6, 0.1, 0.2), supportShares: sh(0.2, 0.5, 0.1, 0.2), footer: 'Space locks' });
  const cards = [...root.querySelectorAll('[data-card]')];
  expect(cards.map(c => c.getAttribute('data-card'))).toEqual(['A', 'B', 'C', 'D']);
  expect((cards[0] as HTMLElement).style.getPropertyValue('--option')).toBe(OPTION_COLORS.A);
  expect((cards[1].querySelector('[data-bar=lead]') as HTMLElement).style.width).toBe('60%');
  expect((cards[1].querySelector('[data-bar=support]') as HTMLElement).style.width).toBe('50%');
  expect(root.textContent).toContain('Rogues');
});
it('shows the lobby counts, the banner and the debrief lines', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  hud.showLobby({ qrDataUrl: null, code: 'ABCD', joinUrl: 'https://x/j/ABCD', count: 3, roleCounts: { citizen: 1, government: 2, business: 0, microsoft: 0 }, classNames: { citizen: 'Rogue', government: 'Knight', business: 'Bard', microsoft: 'Wizard' }, recent: ['Ann, Knight', 'Cy, Rogue'], offline: true, smith: 's', tanui: 't' });
  expect(root.textContent).toContain('Knights 2'); expect(root.textContent).toContain('Offline mode'); expect(root.textContent).toContain('Ann, Knight');
  hud.showBanner({ name: 'Sarah', letter: 'B', phone: 'Yes to 60 to 100 MW, tied', footer: 'Y convincing, N not' });
  expect(root.textContent).toContain('Sarah, defend B: Yes to 60 to 100 MW, tied');
  hud.showBanner({ name: null, letter: null, phone: null, footer: '' });
  expect(root.textContent).toContain('Hand call-out');
  hud.showDebrief({ lines: [{ letter: 'A', damage: 6, text: 'line a' }, { letter: 'B', damage: 44, text: 'line b' }], breakdown: { base: 62.5, focus: 0, alignment: 10, exhibit: 10, rally: 10, total: 93, capped: false }, alignment: 'The party stood with the Rogues: both chose B', rally: 'Rally: Sarah +10', discuss: 'Why?' });
  expect(root.querySelectorAll('[data-debrief-line]')).toHaveLength(2);
  expect(root.textContent).toContain('Rally: Sarah +10'); expect(root.textContent).toContain('stood with the Rogues');
  expect(root.textContent).toContain('Base 62.5, Focus 0, Party aligned +10, Exhibits +10, Rally +10. Total 93');
  hud.showDebrief({ lines: [], breakdown: { base: 80, focus: 15, alignment: 0, exhibit: 15, rally: 20, total: 100, capped: true }, alignment: '', rally: null, discuss: '' });
  expect(root.textContent).toContain('Total 100 (capped at 100)');
});
```

- [ ] **Step 2: Run to see them fail**

Run: `npx vitest run tests/scale.test.ts tests/router.test.ts tests/hud.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `host/main.ts`, `host/index.html`, `host/scale.ts`, `host/router.ts`**

Config: `type: Phaser.AUTO`, `width: 320`, `height: 180`, `pixelArt: true`, `scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH }`, `physics: { default: 'arcade', arcade: { gravity: { y: 600 } } }`, `backgroundColor: '#15141c'`, scenes `[Boot, Lobby, Travel, Battle, Ending, Leaderboard]`. Before creating the game: `loadContent(await import('../content/case.json'))`, `client = createRoomClient(location, content)`, `hud = new Hud(document.getElementById('hud')!)`, registry set; `client.onState(v => { game.registry.set('view', v); const next = sceneFor(v, activeScene(game)); if (next) game.scene.start(next.key, next.data); })`; `applyZoom(game, hudRoot)` after boot and on `window.resize`; `installHotkeys(game, client, hud)`. `index.html`: dark body, `<div id="game">` and a sibling `<div id="hud">` positioned absolute with `pointer-events: none`, the title font from Task 11 (Pixelify Sans from Google Fonts until then).

- [ ] **Step 4: Write `Hud.ts`, `hud.css`, `placeholders.ts`, `hotkeys.ts`, `Boot.ts`**

Invoke the anti-vibecode skill before `hud.css`. Sizes in `calc(var(--zoom) * Npx)`: body 4, narration 5, banner name and titles 7 (24, 30 and 42 px at zoom 6). Cards in a 2 × 2 grid over the lower 45% of the HUD, each with a letter badge in `--option`, the screen text, and two thin bars at the bottom labelled with `leadLabel` and "Party", widths from the shares. Panels are flat slate surfaces at 85% opacity, torch-amber accent only for the "Discuss" line and rally flash, no gradients. QR as an `<img>` at `height: 45%`. `data-card`, `data-bar`, `data-debrief-line` attributes as in the tests. `Boot`: `makePlaceholders(this)` then `this.scene.start('Lobby')`; the router takes over on the first view. `hotkeys.ts` as in the Interfaces block: digits → `injectVotes` (shift ×10), B → `addBots(30)`, C → `callout`, Y and N → `judge` when pending, H → `hideNames`, F → `game.scale.toggleFullscreen()`, Esc → `hud.showKeymap`, R → `reopen`.

- [ ] **Step 5: Write `Lobby.ts`**

On create: `client.connect()` → `QRCode.toDataURL(joinUrl, { margin: 1, scale: 8 })` → `hud.showLobby({...})` with `roleCounts` from `view.players`, `classNames` from `content.roles`, and `recent` as the last eight players by `joinedAt` formatted "Ann, Knight" (an empty array when `view.hideNames`); the canvas draws a gothic skyline strip. On `changedata-view`: diff `players`, drop a `class-{role}` sprite per new player at a random x with a small tween (no text on the canvas), and refresh `showLobby` with the new counts and list. Offline mode shows the offline notice instead of the QR. Space → `client.send({ k: 'start' })`.

- [ ] **Step 6: Run tests, then manual check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all PASS.
Run: `npm run dev`, open `http://localhost:5173/host/?mode=offline`: canvas a whole multiple of 320 × 180 and centred, HUD exactly over it, offline notice, Esc shows the key map, Space switches to the empty Travel scene without console errors; resizing steps the zoom in whole numbers. Then `npm run build && npm run dev:worker`, open `http://localhost:8787/host/`: QR about 45% of the height; a phone joining as a Knight drops a knight sprite with the name and the counts read "Knights 1". Reload the host tab: same code, same players (Review Focus 4). Press Space, reload again: back in Travel for round 0.

- [ ] **Step 7: Commit and push**

```bash
git add host tests && git commit -m "feat: phaser bootstrap, hud, integer zoom, router, lobby, hotkeys" && git push
```

---

### Task 8: Battle scene (vote, call-out, special attack, debrief)

**Files:**
- Create: `host/scenes/Battle.ts`, `host/ui/HpBar.ts`, `host/strikers.ts`
- Test: `tests/strikers.test.ts`

**Interfaces:**
- Consumes registry (`client`, `content`, `hud`, `view`), `Hud` (Task 7), textures (Task 7), `DamageResult` (Task 1).
- Produces `Battle` scene started with `{ round: number; resume: boolean }`; `HpBar`: `class HpBar extends Phaser.GameObjects.Container { constructor(scene, x, y, w, roundHp: number, totalHp: number); set(roundRemaining: number, totalRemaining: number, animateMs?: number): void }`; `host/strikers.ts`: `classFor(content: CaseContent, roundIndex: number): { lead: Role; support: Role[] }` (support in role order, lead removed) and `labelFor(content: CaseContent, role: Role, plural?: boolean): string` ("Rogue" or "Rogues").

- [ ] **Step 1: Write the failing striker test**

```ts
import { it, expect } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { classFor, labelFor } from '../host/strikers';
const c = loadContent(raw);
it('names the lead class and the three support classes of a round', () => {
  expect(classFor(c, 0)).toEqual({ lead: 'citizen', support: ['government', 'business', 'microsoft'] });
  expect(classFor(c, 2)).toEqual({ lead: 'business', support: ['citizen', 'government', 'microsoft'] });
  expect(labelFor(c, 'citizen', true)).toBe('Rogues'); expect(labelFor(c, 'business')).toBe('Bard');
});
```

- [ ] **Step 2: Write the scene state table**

The scene renders from `view.phase`, world on the canvas, text through `hud`:
- `travel` (arrived, vote not open): boss idle; `hud.showNarration` with the round's narration (which ends with the lead class's call to strike) and a quote (round 1 `quotes.ruto`, round 2 `quotes.tanui`); footer "Space opens the vote".
- `vote`: `hud.showOptions` with the four options, `leadLabel = labelFor(lead, true)`, timer from `voteDeadline - serverNow` corrected by local clock offset, "N of M voted" (N = Σ `view.tally`, M = player count; offline: N only), `leadShares` and `supportShares` null. Space → `closeVote`.
- `locked`: `showOptions` again with `leadShares = shares(view.leadTally)` and `supportShares = shares(view.supportTally)`; footer "C calls a student out. Space: the party strikes". When `view.callouts[round]` has a pending entry: `hud.showBanner` ("{name}, defend {letter}: {phone}" or "Hand call-out. Who defends their choice?"), the called student's class sprite steps forward 8 px, footer "Y convincing, N not". After a judge, `hud.flashRally("+10 rally")` in amber or `"no bonus"` in grey for 1.5 s. Resolved call-outs listed small under the cards.
- `reveal` (skipped entirely when started with `resume: true`, straight to the debrief): at most 6 s, and every number shown sums to `damageLog[round].total` (before the cap). Let `d = damageLog[round]`, `leadHalf = Σ shares(view.leadTally)[o] × d.effective[o] × 0.5` and `supportHalf = Σ shares(view.supportTally)[o] × d.effective[o] × 0.5`; when only one group voted, that group's strike carries all of `d.base` and the other strike is skipped with a HUD toast ("No {Rogues} voted this round" or "The party left it to the {Rogues}"). Sequence: the lead class sprite lunges large, flashing in `leadMajority`'s colour, with the number `leadHalf` (one decimal); the three support sprites lunge together, flashing in `supportMajority`'s colour, with `supportHalf`; then one flourish per bonus with its number: "Focus +15" when `d.focus > 0`, "Party stands together +10" when `d.alignment > 0`, "Exhibit +5" per collected exhibit up to `d.exhibit / 5`; then one rally strike per awarded call-out by the called student's class with their name and "+10"; `HpBar.set` drains by `d.total` over 1.5 s; screen shake 200 ms. Then `hud.showDebrief` with one line per option "{letter} {perOption, one decimal}: {projector}", `breakdown` from `d` (`capped = base + focus + alignment + exhibit + rally > 100`), the alignment text in one of four forms ("The party stood with the {Rogues}: both chose {X}" when `d.alignment > 0`; "The {Rogues} were split" and/or "The party was split" when `d.leadTied` or `d.supportTied`; "Split: {Rogues} chose {X}, the party chose {Y}" when both majorities exist, neither tied, and they differ; "No {Rogues} voted this round" when `leadMajority` is null), the rally line when `d.rally > 0`, and the discuss line. Space during the sequence skips to the debrief; Space on the debrief → `next`.
- After `next` the router starts Travel or Ending.

- [ ] **Step 3: Implement `strikers.ts`, `HpBar.ts`, `Battle.ts`**

Space handling: `busy` set when the strike sequence starts; Space while `busy` kills the tweens, shows the debrief, clears `busy`, sets `lockedUntil = time + 600`; Space is ignored while `time < lockedUntil`; only a later Space sends `next` (Review Focus 5). Damage numbers use the `digits` bitmap font, the only canvas text besides the HP label.

- [ ] **Step 4: Manual check in offline mode**

`npm run dev`, `http://localhost:5173/host/?mode=offline`, Space through the lobby, N through travel (the Travel stub starts Battle at once until Task 9), Space to open the vote, `2` ten times and `1` twice, Space to lock: the Party bars show 83% and 17%, the lead bars are empty and the debrief will say no Rogues voted. C: hand call-out banner; Y: "+10 rally". Space to reveal: the lead strike is skipped with the "No Rogues voted this round" toast, the party strike shows 73.3, then "Focus +15" and a rally strike "+10", and the HP drops by 98; the debrief lists four projector lines, the breakdown "Base 73.3, Focus +15, Party aligned 0, Exhibits 0, Rally +10. Total 98", the "No Rogues voted this round" line and the rally line. Press Space twice quickly during the strike: skips once, does not advance. Reload on the debrief: returns to the debrief with no replay. Online with two phones (a Rogue voting B and a Knight voting A): lead bar B 100%, Party bar A 100%, C names the Rogue first, the debrief says "Split: Rogues chose B, the party chose A".

- [ ] **Step 5: Run tests, type-check, commit, push**

```bash
npx vitest run && npx tsc --noEmit && git add host tests && git commit -m "feat: battle scene with special attack, call-out, debrief" && git push
```

---

### Task 9: Travel scene (platformer segments and exhibits)

**Files:**
- Create: `host/scenes/Travel.ts`, `host/levels/road.ts`

**Interfaces:**
- Consumes registry, textures (Task 7), `Hud.showToast` (Task 7), `classFor` (Task 8), content exhibits (Task 1).
- Produces `host/levels/road.ts`: `export interface Segment { width: number; platforms: { x: number; y: number; w: number }[]; exhibits: { x: number; y: number }[]; gateX: number; autoPath: { x: number; jump: boolean }[] }` and `export const SEGMENTS: Segment[]` (four, 640 to 960 px wide, the fourth 320 px, three exhibit spots each).

- [ ] **Step 1: Write `road.ts`**

Four hand-laid segments. Ground at y 160, platforms 16 px tall, exhibits on platforms, the gate 32 px before the end, `autoPath` listing x positions where the auto-runner jumps. Gaps no wider than 48 px: jump velocity -260 at gravity 600 gives about 0.87 s airborne, and at 90 px/s that covers about 78 px horizontally.

- [ ] **Step 2: Implement `Travel.ts`**

Arcade physics. Lead sprite is `class-{classFor(content, round).lead}` with `setCollideWorldBounds`; the three support class sprites lerp toward the lead's position from 200 ms ago. Platforms as a static group from `tile-platform`; camera follows the lead. Controls: cursor keys only (left and right move, up or Space jumps when `body.blocked.down`), A toggles auto-run (90 px/s, jumps at the next `autoPath` x), N → go to the gate. Overlap with an exhibit: destroy it, `client.send({ k: 'exhibit', exhibitId })`, `hud.showToast(text + ' (' + source + ')')`. Overlap with the gate → `this.scene.start('Battle', { round, resume: false })`. A small HUD label "Travel {round + 1}: {boss} ahead. {Rogues} lead." via `hud.showToast` with no timeout.

- [ ] **Step 3: Manual check**

Offline: from the lobby, Space, walk right, jump onto a platform, touch an exhibit: toast for 4 s; after the gate the Battle narration appears. A at the start of segment 2: the lead reaches the gate without falling. N skips. In Battle after two exhibits, the reveal plays two "Exhibit +5" flourishes and the debrief breakdown reads "Exhibits +10".

- [ ] **Step 4: Type-check, commit, push**

```bash
npx tsc --noEmit && git add host && git commit -m "feat: travel platformer segments with exhibit pickups" && git push
```

---

### Task 10: Ending and Leaderboard scenes

**Files:**
- Create: `host/scenes/Ending.ts`, `host/scenes/Leaderboard.ts`

**Interfaces:**
- Consumes registry, `endingFor`, `consistencyAward`, `tableAward` (Task 2), `Hud.showEnding`, `Hud.showLeaderboard` (Task 7), `labelFor` (Task 8).
- Produces: `Ending` reads `view.damageLog` (sum of `total`), `view.leadTally` and `view.supportTally` (round 3's while phase is `ending`), picks the ending via `endingFor`, calls `hud.showEnding` with title, tier, the final split (`view.tally`), "What must be true" and "The risk you accepted"; for `holds`, rows for rounds 1 to 3 "{Rogues} chose {letter}: {phone}" beside "Needed: {synergy letters}". The canvas shows the core cracking (or standing, for `holds`). Space → `next`. `Leaderboard` calls `hud.showLeaderboard` with the top 5 by `score` (name or "Player" when `hideNames`, plus class name), "Most consistent strategist: {name}" or "No one voted in all four rounds", "Top table: {table} ({mean} avg)" or `null`, and the final split under "What should Microsoft do, and why?". Space does nothing here; the screen stays up for the discussion and only Shift+R twice (Task 7 hotkeys) resets to the lobby.

- [ ] **Step 1: Implement both scenes**

- [ ] **Step 2: Manual check**

Offline run with N in every travel (no exhibits, no lead class, no call-outs, so each round is the pressed option's score plus the 15 focus bonus): key `2` ten times in every round gives damage 95, 60, 95, 95 (round 4 with prior B, B, B: B has 2 hits, 80 + 15), total 345, "The Seed Plant", decisive. Then `3` twice in round 1, `1` twice in round 2, `1` twice in round 3, `2` twice in round 4: damage 30, 25, 85, 80 (prior C, A, A: B has 1 hit, 65 + 15), total 220, "The Seed Plant", fragile. Then `3`, `1`, `4`, `2` twice each: damage 30, 25, 50, 65 (prior C, A, D: B has 0 hits), total 170, "The Deadlock holds" with three rows of class choice versus needed (B needed B or D, C or D, A or B). Leaderboard shows "No one voted in all four rounds" and no top table in offline mode; Space on it does nothing; Shift+R once shows the confirm toast and a second Shift+R returns to the lobby.

- [ ] **Step 3: Type-check, commit, push**

```bash
npx tsc --noEmit && git add host && git commit -m "feat: ending and leaderboard scenes" && git push
```

---

### Task 11: Art pass: dark-fantasy sprites, tiles, font, bosses, credits

**Files:**
- Create: `host/art/assets/`, `host/art/bosses.ts`, `CREDITS.md`
- Modify: `host/scenes/Boot.ts` (load real assets, keep placeholders as fallback), `host/scenes/Battle.ts` (use `bosses.ts`), `host/index.html` and `host/hud/hud.css` (title font)

**Interfaces:**
- Produces `host/art/bosses.ts`: `buildBoss(scene: Phaser.Scene, id: 'grid' | 'debt' | 'fog' | 'core', x: number, y: number): Phaser.GameObjects.Container` with an `idle` tween and a `hit()` method (flash and recoil, 300 ms).

- [ ] **Step 1: Source assets, GitHub first, and record licences before copying**

Check `sparklinlabs/superpowers-asset-packs` (CC0, GitHub) for usable 16 px fantasy characters, tiles and monsters; browse `Siilwyn/awesome-pixel-art` for other GitHub-hosted licensed packs. For the dark-fantasy platformer look, take from the authors' pages when GitHub has no licensed copy: ansimuz's Gothicvania packs (backgrounds, tiles), 0x72's Dungeon Tileset II (knight, wizard, elf as rogue, a recoloured figure with a lute or coin purse as bard; ogre, demon, necromancer for boss bases), LuizMelo's medieval packs; and Alagard for the title font if its licence allows web embedding, else Pixelify Sans. For each file: write pack name, author, URL, licence and the exact files used into `CREDITS.md` first, then copy. Anything without a clear free-use licence is not used.

- [ ] **Step 2: Build the bosses**

Grid Wyrm: a chain of segments following a sine path with lightning particles, two amber eyes. Debt Golem: a stone figure (ogre base or stacked blocks) with chains and "68%" and "48.5%" in bitmap digits on its chest. Fog of Demand: a wraith inside 60 drifting particles with three floating labels "97.5%", "8.7%", "20 MW". Core: a pulsing dark heart behind a cracked ring. Palette per spec 7.

- [ ] **Step 3: Swap placeholders for sprites in Boot, Lobby, Travel and Battle; keep placeholders as the fallback when an asset fails to load**

- [ ] **Step 4: Manual check**

Full offline run at 1920 × 1080 fullscreen (F): no blurry sprites (whole-number zoom), HUD text at or above the spec 7 minimums (24 px copy, 30 px narration, 42 px banner), legible from the back of a classroom, four distinct class sprites, three bosses animating, `hit()` firing on each strike. `CREDITS.md` lists every file in `host/art/assets/`.

- [ ] **Step 5: Commit and push**

```bash
git add host CREDITS.md && git commit -m "feat: dark-fantasy art pass, bosses, credits" && git push
```

---

### Task 12: Deploy to spark-bot's Cloudflare account, load test, runbook

**Files:**
- Create: `RUNBOOK.md`
- Modify: `README.md`

- [ ] **Step 1: Log in and deploy**

The wrangler token on this Mac has expired, so Caleb runs `npx wrangler login` in his own terminal (`! npx wrangler login` in the Claude prompt) and picks the account spark-bot deploys to; `npx wrangler whoami` must show that account before continuing. Then `npm run deploy`.
Expected: a `https://olkaria.<account>.workers.dev` URL; `curl -s -X POST https://olkaria.<account>.workers.dev/api/rooms` returns a code.

- [ ] **Step 2: Load test**

Open the deployed host page, note the code, run `npm run simulate -- --base https://olkaria.<account>.workers.dev --code CODE --n 60`, play all four rounds with Space, one C and Y per round. Expected: lobby shows 60 joined with 15 of each class within 5 s; each round's tally sums to 60 by lock; the call-out names a student of the lead class; reveal draws within 1 s of Space; the leaderboard shows five names and a top table.

- [ ] **Step 3: Write `RUNBOOK.md`**

Sections: before class (confirm the URL, `caffeinate -d`, open `/host/` in Chrome, F, create the room, check the QR from the back row), the 12-minute run of show from spec 3.1 with the discuss lines and the key map, if something breaks (Wi-Fi: `?mode=offline` and hand counts with 1 to 4; a student cannot join: the URL and code under the QR; a class with no one of the lead role: the debrief says so, carry on), after class (`reset`; nothing to clean up).

- [ ] **Step 4: Rehearsal with teammates**

Five phones join with five different roles and one shared table name, a full 12-minute run, one deliberate switch to offline mode in round 2, one host reload in round 3, one call-out per round. Note anything that confused a teammate in `RUNBOOK.md`.

- [ ] **Step 5: Commit and push**

```bash
git add RUNBOOK.md README.md && git commit -m "docs: runbook and deployment notes" && git push
```

---

## Self-review notes

- Spec coverage: 3.1 run of show → RUNBOOK (T12); 3.2 and 3.3 screens → T5, T7 to T10; 4.1 roles and classes → T1 content, T3 lead and support tallies, T5 join, T7 lobby counts, T8 strikers; 4.2 bosses → T11; 4.3 round shape → T8; 4.4 scoring → T2; 4.5 travel → T9; 4.6 endings → T10; 5 content → T1; 6.2 → T3; 6.3 → T4 and T7 router; 6.4 and 6.5 → T6, T7; 6.6 → T1; 7 → T7 HUD, T11; 8 → T12.
- Type consistency: `RoomClient.addBots` declared in T6, used in T7; `HostCmd` keys match T1, T3 tests and T7 hotkeys; `hostView` and `playerView` take `content` in T3 and are called that way in T4 and T6; `Hud.showOptions` takes `leadShares` and `supportShares` from `view.leadTally` and `view.supportTally` via `shares` in T8; `classFor` (T8) is used by T9 and T10.
- Arithmetic checked: spec worked examples (62.5 + 10 + 10 = 82.5 → 83; 73.3 + 15 + 10 = 98.3 → 98; even split 47.5 → 48; round 4 base 78.125 + 10 = 88.125 → 88); T3 reveal (10 + 60 + 15 + 10 = 95, points 106, 96, 50); T3 call-out reveal (60 + 10 = 70, points 136, 66); T6 offline (80 + 15 + 10 = 105 → 100); T8 manual (73.3 + 15 + 10 = 98.3 → 98); T10 manual runs (95 + 60 + 95 + 95 = 345; 30 + 25 + 85 + 80 = 220; 30 + 25 + 50 + 65 = 170).
- Revision 3 (Caleb, 2 Nov): G42 folded into Microsoft, fourth role Local Businesses as the Bard with round 3 rewritten from the buyers' side (T1 content and tests, T3, T5, T7, T8 tests, T10 manual numbers, T11 sprite note).
- Second reviewer pass (2 Nov): strike numbers now sum to the damage drained with a breakdown line (T7 `showDebrief`, T8 reveal); kick bans the client id with a `kicked` effect and message (T1 types, T3, T4, T5); Space never resets, Shift+R twice does (T7 hotkeys, T10); discuss lines moved into spec 5; `leadTied` and `supportTied` drive four alignment texts (T1, T2, T3, T8); lobby names in the HUD list, no canvas text (T7); round 4 phone result shows coherence (T5); `class-business` texture and lute icon (T7, T5); float-safe share assertions (T2).
- Review Focus coverage: 1 and 2 in T3; 3 in T2 and T3; 4 in T6, T7 and T8 manual; 5 in T8 manual; 6 in T3; 7 in T3.
- Revision 2 (Caleb, 2 Nov): stakeholder roles as classes with a lead class per round (T1 content, T2 blended shares and alignment, T3 lead and support tallies and lead-first call-outs, T5 role picker, T7 lobby counts and two bars, T8 special attack and alignment line, T9 lead sprite, T10 top table, T4 and T12 roles in the simulator), 12-minute segment (T12 runbook), spark-bot's Cloudflare account (T12), dark-fantasy art with GitHub-first sourcing (T11).
