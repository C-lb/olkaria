# How to play, on the projector: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `?` on the host opens an eight-slide, animated how-to-play over the game, built from the case content, walked with Space and closed with Esc.

**Architecture:** A pure slide model (`howtoSlides`) turns `CaseContent` into eight typed slides. A view module (`howToPanel`) draws one slide as HUD markup with CSS-only motion; `Hud.showHowTo` mounts it full-bleed beside the menu. A keys module (`installHowTo`) owns the index and a capture-phase keydown listener, registered before the menu's so it can swallow keys while open and hand M on to the menu.

**Tech Stack:** TypeScript, the HUD's `h()` builders, `figureSvg` from `shared/figures.ts`, `clockText` from `host/strikers.ts`, Vitest with happy-dom.

**Spec:** `docs/superpowers/specs/2026-11-03-olkaria-how-to-play-design.md`

**Depends on:** Task 5 of `2026-11-03-olkaria-facilitator-menu.md` (`shared/figures.ts`) and Task 2 of `2026-11-03-olkaria-vote-window-and-callouts.md` (`clockText`, `maxCallouts` 4, `voteSeconds` 120). Run after both.

## Global Constraints

- No em dash or en dash anywhere: code, comments, CSS, tests, docs, commit messages.
- Copy verbatim from the spec's section 3; every number from `content.scoring`, never a literal in the view.
- Colours and faces only through the tokens in `hud.css`; no inline hex, no literal font name.
- `innerHTML` only for the constant figure markup (`figureSvg`), as the option shapes are drawn; every word is a text node.
- Every animated element's resting style is its end state; the reduced-motion rule leaves a complete slide.
- Every commit ends with the two trailer lines the dispatch gives.

## Review Focus

- `?` while the menu is up does nothing: the how-to listener runs first, so it must ask `hud.menuOpen()` (Task 2 test).
- Space on the last slide closes the how-to and does not start the game: the keydown is stopped before Phaser hears it (Task 2 test with a bubble listener).
- M while the how-to is up closes it and the same press opens the menu (Task 2 test).
- A view change while the how-to is up (a phone joins, the lobby redraws) leaves it up: the dialog is a sibling of the screen, not inside it (Task 1 test).
- Nothing clips at zoom 4 or zoom 6, and no keycap, badge or option label wraps (Task 2 browser step, both sizes, every slide).

---

### Task 1: The slides: model, markup, styles

**Files:**
- Create: `host/howto.ts` (the model only; Task 2 adds the keys)
- Create: `host/hud/HowTo.ts`
- Modify: `host/hud/Hud.ts` (export `h`, `Kid`, `badge`, `tint`; add `figure()`, `showHowTo()`, `menuOpen()`, a `howto` field)
- Modify: `host/hud/hud.css` (two type tokens, the how-to block, the keyframes)
- Test: `tests/howto.test.ts`, `tests/hud.test.ts`

**Interfaces:**
- Produces:

```ts
// host/howto.ts
export type Party = { role: Role; className: string; stakeholder: string }[];   // ROLES order
export type HowToSlide =
  | { kind: 'title'; eyebrow: string; name: string; sub: string; party: Party; line: string }
  | { kind: 'join'; eyebrow: string; steps: string[] }
  | { kind: 'round'; eyebrow: string; boss: string; hp: number; question: string; options: { letter: OptionId; label: string }[]; clock: string; hit: number; lines: string[] }
  | { kind: 'lead'; eyebrow: string; party: Party; lead: Role; halves: [string, string]; lines: string[] }
  | { kind: 'points'; eyebrow: string; chips: { label: string; value: string }[]; line: string }
  | { kind: 'damage'; eyebrow: string; hp: number; chunks: { label: string; note: string; width: number }[]; line: string }
  | { kind: 'ending'; eyebrow: string; lines: string[]; max: number; fragile: number; decisive: number; fill: number; holds: string }
  | { kind: 'awards'; eyebrow: string; items: string[] };
/** The eight slides of spec section 3, in order, from the case content. */
export function howtoSlides(content: CaseContent): HowToSlide[];

// host/hud/HowTo.ts
export interface HowToArgs { slide: HowToSlide; index: number; count: number; onNext: () => void; onClose: () => void }
/** div.hud-howto[role=dialog][aria-label="How to play"] > section.howto-slide[data-kind] + footer.howto-foot */
export function howToPanel(a: HowToArgs): HTMLElement;

// host/hud/Hud.ts (now exported)
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs?: Record<string, string>, ...kids: Kid[]): HTMLElementTagNameMap[K];
export type Kid = Node | string | false | null | undefined;
export function badge(letter: OptionId, size?: string): HTMLElement;
export function tint<E extends HTMLElement>(el: E, letter: OptionId): E;
/** One class figure as an element: figureSvg(role, scale) through a holder, the first element. */
export function figure(role: Role, scale: number): Element;
class Hud {
  /** The how-to on its full-bleed dialog (host/howto.ts). Each call draws the slide afresh so its motion restarts; null takes it down. clear() leaves it. */
  showHowTo(a: HowToArgs | null): void;
  /** Whether the menu is up. */
  menuOpen(): boolean;
}
```

- Values the model fixes: `name` and `sub` are `content.title` split at the first ": " ("Olkaria", "the Deadlock"); `party` is `content.roles` in `ROLES` order with `className` and `stakeholder`; the round slide is `content.rounds[0]`: `boss`, `question` is its `title`, `options` are `{ letter: o.id, label: o.phone }`, `hp` is `scoring.roundHp`, `clock` is `clockText(scoring.voteSeconds)`, `hit` is 62; the lead slide's `lead` is `rounds[0].lead`, `halves` is `['Lead class', 'The rest of the party']`; the points chips are `['Evidence behind your pick', '0 to 100']`, `['A fast vote', `up to +${speedBonusMax}`]`, `['Your class leads this boss', `+${casterBonus}`]`, `['Called out and you speak', `+${calloutPointsSpoke}`]`, `['Called out and convincing', `+${calloutPointsAwarded}`]`; the damage chunks are, in order, base `{ label: "Evidence behind the party's pick", note: '0 to 100', width: max(0, roundHp - the other four widths) }`, focus `{ label: `Focus: ${Math.round(focusThreshold * 100)}% or more of you on one option`, note: `+${focusBonus}`, width: focusBonus }`, alignment `{ 'Lead class and party agree', `+${alignmentBonus}`, alignmentBonus }`, exhibits `{ 'Exhibits found on the road', `+${exhibitBonus} each, up to ${maxExhibits}`, exhibitBonus * maxExhibits }`, rallies `{ 'Rallies won', `+${calloutBonus} each, up to ${maxCallouts}`, calloutBonus }`; the damage line is `${Words[rounds.length]} bosses, ${roundHp} each. ${roundHp * rounds.length} in all.` with a word table for 2 to 9 ("Four"), digits otherwise; the ending slide's lines are `${stakeholder of rounds[3].lead} decides.` and the fixed second line, `max` is `roundHp * rounds.length`, `fragile` and `decisive` the tiers, `fill` is `decisive`, `holds` is `Under ${fragile}, ${endings.holds.title with its first letter lowercased}.` ("Under 180, the Deadlock holds."); the eyebrows, steps, lines and award items are the spec's words.

- [ ] **Step 1: Write the failing tests**

`tests/howto.test.ts`:

```ts
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
```

In `tests/hud.test.ts` (import `howtoSlides` from `../host/howto` and `vi`):

```ts
it('showHowTo draws one slide on a full-bleed dialog with the dots and the keycaps, restarts on each call, and null takes it down', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  const slides = howtoSlides(c); const onNext = vi.fn(); const onClose = vi.fn();
  hud.showHowTo({ slide: slides[2], index: 2, count: 8, onNext, onClose });
  const dialog = root.querySelector('.hud-howto')!;
  expect(dialog.getAttribute('role')).toBe('dialog');
  expect(dialog.getAttribute('aria-label')).toBe('How to play');
  expect(dialog.parentElement).toBe(root);   // a sibling of the screen, so a redraw of the screen leaves it
  expect(dialog.querySelector('.howto-slide')!.getAttribute('data-kind')).toBe('round');
  expect(dialog.textContent).toContain('Grid Wyrm');
  expect(dialog.textContent).toContain('2:00');
  expect(dialog.querySelectorAll('.howto-option')).toHaveLength(4);
  expect(dialog.querySelectorAll('.howto-dot')).toHaveLength(8);
  expect(dialog.querySelector('.howto-dot[aria-current]')).toBe(dialog.querySelectorAll('.howto-dot')[2]);
  expect([...dialog.querySelectorAll('.howto-key')].map((k) => [k.querySelector('kbd')!.textContent, k.querySelector('span')!.textContent])).toEqual([['Space', 'Next'], ['Esc', 'Close']]);
  (dialog.querySelector('.howto-slide') as HTMLElement).click();
  expect(onNext).toHaveBeenCalledTimes(1);
  hud.showHowTo({ slide: slides[7], index: 7, count: 8, onNext, onClose });
  expect(root.querySelectorAll('.hud-howto')).toHaveLength(1);
  expect([...root.querySelectorAll('.howto-key span')].map((s) => s.textContent)).toEqual(['Close', 'Close']);
  hud.showLobby(lobby({}));   // a screen change under the dialog
  expect(root.querySelector('.hud-howto')).not.toBeNull();
  hud.showHowTo(null);
  expect(root.querySelector('.hud-howto')).toBeNull();
});
it('every slide draws, and the party slides draw the shared figures with the lead stepping forward', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  const slides = howtoSlides(c); const noop = () => {};
  for (const [i, slide] of slides.entries()) {
    hud.showHowTo({ slide, index: i, count: slides.length, onNext: noop, onClose: noop });
    expect(root.querySelector('.howto-slide')!.getAttribute('data-kind')).toBe(slide.kind);
    expect(root.querySelector('.howto-slide .eyebrow')!.textContent).toBe(slide.eyebrow);
  }
  hud.showHowTo({ slide: slides[0], index: 0, count: 8, onNext: noop, onClose: noop });
  expect([...root.querySelectorAll('.howto-member svg.figure')].map((f) => f.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
  expect(root.querySelector('.howto-name')!.textContent).toBe('Olkaria');
  hud.showHowTo({ slide: slides[3], index: 3, count: 8, onNext: noop, onClose: noop });
  expect(root.querySelector('.howto-member.howto-lead svg.figure')!.getAttribute('data-role')).toBe('citizen');
  hud.showHowTo({ slide: slides[5], index: 5, count: 8, onNext: noop, onClose: noop });
  expect(root.querySelectorAll('.howto-chunk')).toHaveLength(5);
  expect((root.querySelector('.howto-chunk') as HTMLElement).style.getPropertyValue('--w')).toBe('50%');
});
it('menuOpen says whether the menu is up', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  expect(hud.menuOpen()).toBe(false);
  hud.showMenu({ actions: [], stages: [], stagesHint: '', onPick: () => {}, onClose: () => {} });
  expect(hud.menuOpen()).toBe(true);
  hud.showMenu(null);
  expect(hud.menuOpen()).toBe(false);
});
```

(`lobby()` is the file's lobby fixture; if Task 7 of the menu plan has not run yet it still takes `code`, `smith` and `tanui`.)

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/howto.test.ts tests/hud.test.ts`
Expected: module not found, then `showHowTo` and `menuOpen` are not functions.

- [ ] **Step 3: The model**

`host/howto.ts`: `howtoSlides(content)` per the Interfaces, importing `clockText` from `./strikers`, `ROLES` from `../shared/types`. A module comment says what the how-to is (spec 1) and that the words are the spec's.

- [ ] **Step 4: The markup**

`host/hud/Hud.ts`: export `h`, `Kid`, `badge`, `tint`; add `figure(role, scale)` (a `span` holder's `innerHTML` set to `figureSvg(role, scale)`, its first element returned, as `player/render.ts` does); add `private howto: HTMLElement | null`, `showHowTo` (remove the old dialog, append the new one to the root after the menu's slot, so it sits over the screen and the flash and under `.hud-top`), `menuOpen()`. Update the layer-order comment at the top of the file.

`host/hud/HowTo.ts`: `howToPanel(a)` draws, with `h` and the helpers:

- `div.hud-howto[role=dialog][aria-label="How to play"]` holding `section.howto-slide[data-kind=<kind>]` (a click on it calls `onNext`) and `footer.howto-foot` with `ol.howto-dots > li.howto-dot` (`aria-current="step"` on the index) and `ul.howto-keys > li.howto-key > kbd.key + span` for Space ("Next", or "Close" when `index === count - 1`) and Esc ("Close").
- Every slide starts with `p.eyebrow`. Elements that animate in carry a class and `style="--i: n"` for their stagger.
- title: `h1.howto-title > span.howto-name + span.howto-sub`; `ul.howto-party > li.howto-member.howto-walk[style=--i]` with `figure(role, 3)`, `b.howto-class`, `span.howto-who`; `p.howto-line.howto-in`.
- join: `ol.howto-steps > li.howto-step.howto-in[style=--i]`.
- round: `header.howto-boss > h2.howto-bossname + div.howto-hp > div.howto-hpbar.howto-hit[style=--hit: .62]`; `p.howto-question`; `div.howto-vote > ul.howto-options > li.howto-option` (each `tint`ed, `badge(letter, 'is-inline')` then `span` label) and `div.howto-ring[aria-hidden=true]` with `span.howto-clock` inside; `p.howto-line.howto-in[style=--i]` per line.
- lead: `ul.howto-party > li.howto-member.howto-in` (the lead gets `howto-lead` too); `div.howto-split > span.howto-half.is-lead + span.howto-half`; the lines.
- points: `ul.howto-chips > li.howto-chip.howto-in[style=--i] > span.howto-chip-label + b.howto-chip-value`; the line.
- damage: `div.howto-track > span.howto-chunk.howto-fill[style="--w: <width>%; --i: n"]` for each chunk (width as a percentage of `hp`); `ol.howto-chunks > li.howto-in[style=--i] > span + b` (label, note); the line.
- ending: the lines; `div.howto-gauge > div.howto-gaugefill.howto-fill[style=--w]` (fill as a percentage of max) + `span.howto-mark[style=--at: <pct>%]` for fragile ("180 Fragile") and decisive ("260 Decisive"); `p.howto-line.howto-in` holds.
- awards: `ul.howto-awards > li.howto-in[style=--i]`.

- [ ] **Step 5: The styles**

In `hud.css`, add `--t-slide: calc(var(--zoom) * 10px)` and `--t-howto-name: calc(var(--zoom) * 20px)` to the `.hud` token block and name them in the header's scale. Add a block "How to play" after the menu block:

- `.hud-howto { position: absolute; inset: 0; z-index: var(--z-overlay); display: flex; flex-direction: column; background: var(--bg); pointer-events: auto; }`; `.howto-slide { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: var(--s3); padding: var(--s4) calc(var(--zoom) * 12px); }`; `.howto-foot { display: flex; align-items: center; justify-content: space-between; padding: 0 calc(var(--zoom) * 12px) var(--s3); color: var(--ink-2); }`; dots `.howto-dots { list-style: none; display: flex; gap: var(--s2); } .howto-dot { width: var(--s2); height: var(--s2); border-radius: 50%; background: var(--surface-2); } .howto-dot[aria-current] { background: var(--ink); }`; keycaps share the lobby's rule (`.lobby-key, .howto-key` and `.lobby-key .key, .howto-key .key`).
- Type: `.howto-line { font-size: var(--t-slide); line-height: var(--lh-title); }`, `.howto-name { font: 700 var(--t-howto-name)/var(--lh-title) var(--font-title); text-shadow: var(--s2) var(--s2) 0 var(--surface-2); }`, `.howto-sub { font: 500 var(--t-title)/var(--lh-title) var(--font-title); color: var(--ink-2); }`, `.howto-bossname { font: 700 var(--t-title)/var(--lh-title) var(--font-title); }`, values `.howto-chip-value, .howto-chunks b, .howto-clock, .howto-mark b { color: var(--accent); font-variant-numeric: tabular-nums; }`; `.howto-class { display: block; font-weight: 600; }`, `.howto-who { color: var(--ink-2); }`; option tiles flat on `--surface-2` with the dim stroke, label `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
- Bars: tracks `background: var(--surface-2); border-radius: var(--r-sm); overflow: hidden`; `.howto-hpbar { width: 100%; height: 100%; background: var(--ink); }`; `.howto-chunk { display: block; height: 100%; width: var(--w); background: var(--ink-2); box-shadow: inset calc(var(--zoom) * -1px) 0 0 var(--bg); }` laid out in a flex row; `.howto-half { flex: 1 1 0; }` with `.is-lead { background: var(--ink); }` and the rest `var(--surface-2)`; the gauge fill `background: var(--ink)`; marks positioned at `left: var(--at)` with a 1 px line in `var(--ink-3)` and the label under it.
- Motion: `.howto-in { animation: howto-rise .45s ease-out both; animation-delay: calc(var(--i, 0) * .35s); }`, `@keyframes howto-rise { from { opacity: 0; transform: translateY(var(--s2)); } }`; `.howto-walk { animation: howto-walk 1.1s ease-out both; animation-delay: calc(var(--i, 0) * .22s); } .howto-walk .figure { animation: howto-bob .28s steps(2) 4; animation-delay: calc(var(--i, 0) * .22s); } @keyframes howto-walk { from { transform: translateX(calc(var(--zoom) * -140px)); } } @keyframes howto-bob { 50% { transform: translateY(calc(var(--zoom) * -1px)); } }`; `.howto-fill { transform-origin: left; animation: howto-grow .6s ease-out both; animation-delay: calc(var(--i, 0) * .55s); } @keyframes howto-grow { from { transform: scaleX(0); } }`; `@property --p { syntax: '<number>'; inherits: false; initial-value: 0; } .howto-ring { --p: 0; background: conic-gradient(var(--ink) calc(var(--p) * 1turn), var(--surface-2) 0); border-radius: 50%; animation: howto-drain 3s linear both; } @keyframes howto-drain { from { --p: 1; } to { --p: 0; } }` with the clock text centred over a `--bg` disc inside; `.howto-hit { width: calc(var(--hit, 1) * 100%); animation: howto-hit .5s ease-in both 3s; transform-origin: left; } @keyframes howto-hit { from { transform: scaleX(calc(1 / var(--hit, 1))); } }`; `.howto-lead { transform: translateY(calc(var(--zoom) * -3px)) scale(1.15); animation: howto-step .5s ease-out both .9s; } @keyframes howto-step { from { transform: none; } }`. Say in the block's comment that resting styles are end states and the reduced-motion rule at the end of the file covers the block.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 7: Commit**

```bash
git add host/howto.ts host/hud/HowTo.ts host/hud/Hud.ts host/hud/hud.css tests/howto.test.ts tests/hud.test.ts
git commit -m "feat: how-to-play slides drawn by the HUD from the case content"
```

---

### Task 2: Keys, lobby keycap, key map, runbook

**Files:**
- Modify: `host/howto.ts` (add `installHowTo`)
- Modify: `host/main.ts` (install order: hotkeys, how-to, menu)
- Modify: `host/hud/Hud.ts` (the lobby's third keycap; the `KEYS` row)
- Modify: `host/hud/hud.css` (`.keys` grid rows 8)
- Test: `tests/howto.test.ts`, `tests/hud.test.ts`
- Modify: `RUNBOOK.md`

**Interfaces:**
- Produces:

```ts
// host/howto.ts
/**
 * Puts the how-to on `?` with one capture-phase keydown listener on window, registered before the menu's (main.ts),
 * so that while it is open it stops every key before the menu, the hotkeys and Phaser; browser chords are stopped too
 * but never prevented (Cmd+R still reloads), and M closes it and passes on to the menu. Closed: chords pass untouched,
 * and `?` opens it at the first slide unless the key is held, typed into a field, or the menu is up. Open: Space, Enter, ArrowRight, ArrowDown and PageDown go on (the last
 * slide closes); ArrowLeft, ArrowUp and PageUp go back; Escape and `?` close; held keys do nothing. Each slide is
 * drawn afresh as it is shown. Returns open, close and dispose; installing again removes the earlier install first.
 */
export function installHowTo(hud: Hud, content: CaseContent): { open: () => void; close: () => void; dispose: () => void };
```

- Consumes: Task 1's `howtoSlides`, `Hud.showHowTo`, `Hud.menuOpen`; `typing()` from `host/hotkeys.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/howto.test.ts` (a real `Hud` on a root in `document.body`, `press(key, init)` dispatching a cancelable, bubbling keydown on window as `tests/menu.test.ts` does, `afterEach` disposing and removing the root):

```ts
it('? opens the how-to at the first slide; Space, the arrows and Esc walk and close it; the last slide closes on Space', () => {
  press('?', { shiftKey: true });
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  press(' ');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);
  press('ArrowRight');
  press('PageDown');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[3]);
  press('ArrowLeft');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[2]);
  press('Escape');
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  for (let i = 0; i < 7; i++) press(' ');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[7]);
  press(' ');
  expect(root.querySelector('.hud-howto')).toBeNull();
});
it('the first slide stays on back, a held key does nothing, and a click on the slide goes on', () => {
  press('?', { shiftKey: true });
  press('ArrowLeft');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  press(' ', { repeat: true });
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  (root.querySelector('.howto-slide') as HTMLElement).click();
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);
});
it('while open it stops every key before a bubble listener, chords included but never prevented, and M closes it and passes on', () => {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  press(' ');
  expect(heard).toHaveBeenCalledTimes(1);   // closed: Space passes
  press('?', { shiftKey: true });
  expect(heard).toHaveBeenCalledTimes(1);   // the opening press is stopped
  press(' ');
  press('x');
  expect(heard).toHaveBeenCalledTimes(1);
  for (const flag of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    const chord = new KeyboardEvent('keydown', { key: ' ', [flag]: true, bubbles: true, cancelable: true });
    window.dispatchEvent(chord);
    expect(heard).toHaveBeenCalledTimes(1);   // a chord is stopped on its way to the scenes
    expect(chord.defaultPrevented).toBe(false);   // but never prevented: Cmd+R still reloads
  }
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);   // chorded Space did not advance
  press('m');
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(heard).toHaveBeenCalledTimes(2);   // M went on to the next listener
  const closedChord = new KeyboardEvent('keydown', { key: '?', shiftKey: true, metaKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(closedChord);
  expect(root.querySelector('.hud-howto')).toBeNull();   // closed, a chord never opens it
  expect(heard).toHaveBeenCalledTimes(3);   // and passes untouched
  window.removeEventListener('keydown', heard);
});
it('? does nothing while typing, while the menu is up, or when held; dispose takes it all down', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  input.remove();
  hud.showMenu({ actions: [], stages: [], stagesHint: '', onPick: () => {}, onClose: () => {} });
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  hud.showMenu(null);
  press('?', { shiftKey: true, repeat: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).not.toBeNull();
  dispose();
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
});
```

In `tests/hud.test.ts`: the lobby keycap test expects `[['Space', 'Start'], ['Esc', 'Shows hotkeys'], ['?', 'How to play']]` and its name says three keycaps; the key-map test expects 15 rows and `toContainEqual(['?', 'How to play'])`, with `['M or Esc', 'This menu']` still last.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/howto.test.ts tests/hud.test.ts`
Expected: `installHowTo` is not exported; the keycap and key-map counts fail.

- [ ] **Step 3: Keys**

`host/howto.ts`: `installHowTo` per the Interfaces, with a module-level `uninstall` as `menu.ts` has. State: `index: number | null` (null is closed). `draw()` calls `hud.showHowTo({ slide: slides[index], index, count: slides.length, onNext: next, onClose: close })`; `next()` closes on the last slide; `back()` stays at 0; `close()` blurs a focused element and calls `hud.showHowTo(null)`. The listener: closed, a chord returns untouched, and only `?` without `repeat`, `typing()` or `hud.menuOpen()` opens, with `stopPropagation`; open, M or m without a chord or `repeat` closes and returns without stopping; every other keydown, chords included, gets `stopImmediatePropagation()` (so the menu's listener on the same target never runs and Phaser never sees Ctrl+Space), after which a chord returns with no `preventDefault` (Cmd+R still reloads) and the keys named get `preventDefault()` and their action, ignoring `repeat`. `dispose` closes, removes the listener and clears `uninstall`.

`host/main.ts`: `const howto = installHowTo(hud, content);` between `installHotkeys` and `installMenu`, with a comment saying the order is what lets the how-to swallow keys before the menu; update the header comment to name the how-to.

- [ ] **Step 4: Lobby, key map, runbook**

`host/hud/Hud.ts`: the lobby's keycaps become `keycap('Space', 'Start'), keycap('Esc', 'Shows hotkeys'), keycap('?', 'How to play')`; `KEYS` gains `['?', 'How to play']` before `['M or Esc', 'This menu']`. `hud.css`: `.keys` reads `grid-template-rows: repeat(8, auto)`. `RUNBOOK.md`: before the run of show, "? opens How to play: eight slides, Space next, Esc closes. Show it while the phones join."; a row "? | How to play, eight slides; Space next, Esc closes" in the key table.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run check && npm run build`
Expected: green.

- [ ] **Step 6: Look at it**

`npm run dev`, open `http://localhost:5173/host/?mode=offline` in headless Chrome at 1920x1080 (zoom 6) and 1280x720 (zoom 4), driving real keys over CDP as the menu check did (`/private/tmp/claude-501/-Users-caleb/edf8fed2-3e7f-4281-a8a6-8a81070d68cd/scratchpad/menu-check.mjs` is the pattern). Press `?`, wait 4 s, screenshot; Space, wait 4 s, screenshot; through all eight slides, at both sizes, into the plan's workspace. Check: nothing clips, no keycap, badge or option label wraps, the figures are crisp, every animation has finished by 4 s and the slide is complete, the dots and keycaps sit along the bottom, the lobby shows three keycaps, M from the how-to opens the menu, Space on the last slide closes without starting the game (the lobby is still up). Stop the dev server and Chrome.

- [ ] **Step 7: Commit**

```bash
git add host/howto.ts host/main.ts host/hud/Hud.ts host/hud/hud.css tests/howto.test.ts tests/hud.test.ts RUNBOOK.md
git commit -m "feat: ? opens How to play from any screen; the lobby and the key map say so"
```
