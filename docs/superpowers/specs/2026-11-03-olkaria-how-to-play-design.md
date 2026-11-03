# Olkaria: How to play, on the projector

## 1. Intent

Caleb asked on 3 Nov 2026 for a how-to-play with some animation that shows how the scoring matters, in few words, straight to the point, simple; then that it live in the game itself, so he can show it on screen before the game, not in the character sheet or on a separate page. The host page gets a slide show over the game: `?` opens it (the lobby's keycaps name it), Space walks it, Esc closes it. Eight slides, one idea each, each animating in once as it is shown.

## 2. Where it lives

- An HTML overlay in the HUD layer (`host/hud`), full-bleed over the canvas: the world is hidden under it, it is the screen while it is up. It sits at `--z-overlay` like the menu, under the banner and the toasts. Phaser keeps running underneath, the room is untouched, and it opens in any phase.
- Opened by `?` when no field has the focus and the menu is not up; the lobby's third keycap reads "?  How to play"; the key map lists "?", "How to play". It is not a menu item: the reviewed menu stays as it is.
- While it is up no key reaches the menu, the hotkeys, Phaser or the room, with two exceptions: browser chords (Ctrl, Alt, Cmd) pass untouched, and M closes it and goes on to the menu in the same press.
- Keys: Space, Enter, ArrowRight, ArrowDown, PageDown go to the next slide, and on the last slide close. ArrowLeft, ArrowUp, PageUp go back (the first slide stays). Esc or `?` close. A held key (repeat) does nothing. A click on the slide is next (close on the last).
- Code: `host/howto.ts` holds the slide model `howtoSlides(content)` and the keys `installHowTo(hud, content)`; `host/hud/HowTo.ts` holds the markup `howToPanel(args)`; `Hud` gains `showHowTo(args | null)` and `menuOpen()`; the styles are a block in `hud.css`. The pixel figures come from `shared/figures.ts` (`figureSvg`, Task 5 of the facilitator-menu plan); the clock text from `clockText` in `host/strikers.ts` (Task 2 of the vote-window plan).

## 3. The slides

Content comes from `content/case.json`; the words below are the copy, verbatim; every number comes from `scoring`, so a content edit carries through. The character sheet's spoiler rule holds: no option score by letter, no debrief line, no ending title except "The Deadlock holds".

1. **title.** Eyebrow "How to play". "Olkaria" over "the Deadlock" in the pixel face with the lobby's hard shadow. The four figures walk in from the left and stop in a row, each over its class name in bold ("Rogue") and its stakeholder ("Citizen"). Line: "Four classes. One party. Four bosses."
2. **join.** Eyebrow "Join". Three numbered steps appearing one after another: "Scan the code on the screen", "Pick your class", "Type your name".
3. **round.** Eyebrow "Each round, one boss". The first round's boss name in the pixel face with its HP bar (100, full) beside it; the question (the round's title); the four options as their phone labels with letter badges in the option colours, two by two; a clock ring reading the window as m:ss ("2:00") that drains over about three seconds, after which the HP bar takes a hit to 62 of 100. Lines: "Talk at your table. Vote on your phone." then "The clock stops when everyone has voted."
4. **lead.** Eyebrow "The lead class". The four figures in a row, the first round's lead class stepping forward (up and larger). A bar split in halves: left "Lead class", bright; right "The rest of the party", dim. Lines: "Every boss has a lead class." and "Their votes are half the attack. Everyone else is the other half."
5. **points.** Eyebrow "Your points". Five rows popping in one after another, label left and value right: "Evidence behind your pick" "0 to 100"; "A fast vote" "up to +20"; "Your class leads this boss" "+10"; "Called out and you speak" "+10"; "Called out and convincing" "+30". Line: "Points add up over four bosses. Top five at the end."
6. **damage.** Eyebrow "The party's damage". One HP track (100) filling left to right in chunks, each growing in turn, with a numbered list under it in the same order: "Evidence behind the party's pick" "0 to 100" (drawn as what is left to 100, so the example fills the bar); "Focus: 60% or more of you on one option" "+15"; "Lead class and party agree" "+10"; "Exhibits found on the road" "+5 each, up to 3" (drawn 15 wide); "Rallies won" "+10 each, up to 4" (drawn 10 wide, one rally). Line: "Four bosses, 100 each. 400 in all."
7. **ending.** Eyebrow "The last boss and the ending". Lines: "Microsoft decides." and "Its options score by how well they fit what the party chose before." A gauge from 0 to 400 with marks at 180 "Fragile" and 260 "Decisive", filling up to 260. Line: "Under 180, the Deadlock holds."
8. **awards.** Eyebrow "At the end". Three lines popping in: "Top five players", "Most consistent strategist", "Top table".

Footer on every slide: eight dots with the current one bright, then the keycaps "Space  Next" ("Space  Close" on the last slide) and "Esc  Close".

## 4. Look and motion

- Anti-vibecode on the HUD's tokens: `--bg` canvas; `--ink` and `--ink-2` text; `--surface-2` tracks; `--line` strokes; `--accent` only on values (the "+20", "+10", "+30", the HP and gauge numbers); option colours on letter badges and option tiles only; the pixel face for "Olkaria" and the boss name, the body face for everything else; no keycap, badge or option label wraps. Two new type tokens in the `.hud` block: `--t-slide` (10 canvas px, the slide's lines) and `--t-howto-name` (20 canvas px, "Olkaria").
- Motion is CSS only, restarted by rebuilding the slide's DOM each time a slide is shown: a rise-in with a stagger (`--i`), the walk-in with a two-step bob, chunk growth from the left, the ring drain (`@property --p` on a conic gradient), the HP hit, the step forward. Every animated element's resting style is its end state, so the HUD's existing reduced-motion rule (`.hud * { animation: none }`) leaves a complete slide.
- Sizes are canvas pixels, so zoom 4 and zoom 6 look the same; nothing clips at either; each slide fits 320 by 180 with 12 px side gutters and the footer along the bottom.

## 5. Docs

RUNBOOK.md: one line before the run of show ("? opens How to play: eight slides, Space next, Esc closes. Show it while the phones join.") and a row in the key table. The facilitator-menu plan's Task 7 lobby test expects three keycaps.

## 6. Non-goals

No sound, no auto-advance, no menu item, no phone version, no PDF, no editing from the browser.
