# Olkaria: facilitator menu, automatic travel, class figures on the phone, a leaner lobby

Date: 3 November 2026. Amends `2026-11-02-olkaria-deadlock-design.md` (sections 3.2, 4.1, 4.5, 6.2, 6.5). Where the two disagree, this document wins. Repo `~/olkaria`, live at https://olkaria.sparkbot-worker.workers.dev.

## 1. Intent

Caleb asked for six things once the first build was live:

1. A settings menu on the host to restart, reload, go back to the lobby and go to any stage.
2. The class sprites on the phone as well as on the projector.
3. The walk to each boss to happen by itself.
4. No room code on the screen, since nothing takes a code.
5. No extra words or flourishes while a student onboards.
6. A spruced-up lobby screen.

Why. The rehearsal and the class both need a way to reach a given moment without playing everything before it, and a way to recover from a round that went wrong without the class scanning again. Students only see their character on the projector in a crowd; on their own phone it makes the role they picked concrete. Travel needed a key press to get going, which left the party standing while the facilitator talked. The room code was shown but there is nowhere to type it: the QR and the address are the two ways in, and the address carries the code. The join form and the waiting card said more than a student needs in the thirty seconds they have. The lobby is on the projector for ninety seconds and should look the part.

## 2. Goals, non-goals, anti-goals

Goals

- From any screen the facilitator can restart the current round, go back to the lobby, reload the page, or go to any of the four stages or the ending, by mouse or keyboard.
- Nothing destructive happens on one press.
- A jump keeps the rounds revealed before the stage it goes to and clears the rest, so scores and the boss's HP stay honest. A round counts as played only once it is revealed.
- The phone shows the player's class figure wherever it names their role, drawn from the same pixel data the projector paints; the lobby screen shows the same figures beside its counts.
- Travel walks itself to the gate from the moment the segment starts, resting at each exhibit. The arrows still take over, A pauses, N skips.
- A student onboards with a name, a role and a table, and nothing else to read.

Non-goals

- No kick UI, no editing of scores, no settings that change scoring or timing. Content stays in `content/case.json`.
- Bosses are not drawn on the phone. The phone's job in a round is the vote; the boss is on the projector.
- No change to the phone's screens after the lobby (vote, locked, call-out, result, ending).
- No code entry on the phone: the address is the way in without a scan.
- The menu keeps no state across reloads.

Anti-goals

- A stray key must never reset or jump the room. The menu is modal, and every item that changes the room asks twice.
- The menu is not a second way to run the game. Space and the game keys stay exactly as they are.
- No new colour. The menu and the lobby use the HUD's slate and bone; option colours stay on letters.

## 3. The facilitator menu

### 3.1 Opening and closing

- M opens the menu over whatever screen is up, and so does Esc. Either closes it, and so does a click on the scrim outside the panel. In fullscreen Chrome takes Esc to leave fullscreen, so M is the key the runbook teaches. The lobby's keycap names Esc, at Caleb's request (3 November, evening); both keys open the menu.
- The menu is modal. While it is open no key reaches the room or the scenes: digits add no votes, Space advances nothing, N skips nothing. Browser chords (Cmd, Ctrl, Alt) are left to the browser. Key releases pass through, so an arrow held when the menu opened does not stick down.
- A key typed into a form field never opens the menu (the same guard the hotkeys use).
- The key map that Esc showed moves into the menu, under the actions, in its two-column form. Its row for Esc becomes "M or Esc: this menu".
- The lobby's hint line becomes three keycaps with labels: Space "Start", Esc "Shows hotkeys" and ? "How to play" (section 7).

### 3.2 Items

Actions, one row of three:

- Restart round N (the label names the round: "Restart round 2"). This round again from its road. Enabled once the game has started; in the lobby it reads "Restart the round" and is disabled. Hint: "This round again from its road. Its votes go; earlier rounds stay."
- Back to the lobby. The existing reset: players stay, votes and scores go. Disabled in the lobby. Hint: "Players stay; votes and scores go."
- Reload the page. `location.reload()`. Online with the link up, hint "The same room and screen come back." Online with the link down or the room gone, hint "Needs the network. Without it the page is lost." Offline it is disabled, with the hint "Offline mode starts over on a reload. Use Back to the lobby.", because a reload with no network loses the page and the game, and the lobby already restarts offline.

Go to, one row of five: "1 Grid Wyrm", "2 Debt Golem", "3 Fog of Demand", "4 The core", "Ending". The boss names come from the content. Every one is enabled whenever the room is connected, in the lobby too ("1 Grid Wyrm" from the lobby starts the game). One hint under the row: "Earlier rounds stay. The one you go to, and the ones after it, start over. Ending shows what has been played."

Until the first view has arrived, only Reload is enabled.

Asking twice. An item that changes the room (restart, lobby, every stage, the ending) arms on its first press: the button inverts and reads "Sure?" for 3 s. A second press on it inside that time fires it. A press on another item arms that one instead; closing the menu or the time running out disarms. Reload fires at once while the link is up and asks twice while it is down.

After an item fires the menu closes. The room's answer moves the screens as any command does, and a refusal shows as the usual toast.

### 3.3 Keyboard

- Nothing is focused when the menu opens, so Enter or Space do nothing until an arrow has picked an item.
- Arrows move the focus through the enabled buttons in reading order, Left and Up back, Right and Down forward, wrapping at the ends. Enter or Space presses the focused item.

### 3.4 Look

Anti-vibecode, HUD tokens only, every size in canvas pixels through `--zoom`. The panel is the key map's panel (surface-1, r-lg, shadow-pop) low over the scrim; title "Menu"; eyebrows "Actions" and "Go to"; buttons flat on surface-2 with a 1 px line stroke, r-md, body size at weight 600, label on one line and never wrapping, a smaller hint line in ink-2 under an action's label; disabled at 40% opacity; the focus ring one canvas pixel in ink-2; an armed button inverts to ink with bg text. A rule, then the key map rows as they are today.

## 4. Jumping between stages: the room

### 4.1 The `goto` command

`{ k: 'goto', stage: number }`. Stage 0 to 3 is the road of that round; stage 4, the number of rounds, is the ending. Anything else is refused with "bad stage". Allowed in every phase.

A round is settled once it is revealed: `damageLog` holds one entry per settled round, so the settled rounds are the first `damageLog.length`. Only the current round can be unsettled (the room advances through reveals), and it is unsettled in `travel`, `vote` and `locked`. Any jump clears an unsettled round: its votes never became points or damage, and keeping them would let them count toward the ending's majority but not its tier, and show on the leaderboard as picks that scored nothing.

To a road (stage s, 0 to 3):

- Phase `travel`, round s, `voteOpenedAt` and `voteDeadline` null. The alarm is cleared when a vote was open.
- The settled rounds before s are kept entire. Everything from the smaller of s and the settled count onward is cleared: each player's votes in those rounds go, their score becomes the sum of the points on the votes kept, and `lastPoints` becomes the points of round s minus 1 (0 when s is 0 or that round has no vote of theirs). Synthetic votes, exhibits and call-outs of the cleared rounds go. `damageLog` and `majorities` are cut to the kept rounds. `bossHp` becomes the full HP less the damage of the kept rounds.
- A jump forward over rounds never settled pads `majorities` with null and `damageLog` with a zero round (`computeDamage` over empty tallies, which deals 0) up to s entries, so the next reveal lands at its own index and the ending sums only what was dealt.
- `trips` goes up by one (4.3).
- Players, bans and `hideNames` stay.

To the ending (stage 4): phase `ending`, round 3, the deadline fields null, the alarm cleared when a vote was open. An unsettled current round is cleared as above; nothing settled changes. The ending shows what was revealed, and "No one voted in the final round" when round 4 was not revealed. Space from there shows the leaderboard as before. A facilitator who wants round 4 in the ending reveals it first.

### 4.2 Points per round

At the reveal each voter's points for the round (effective score, speed bonus, caster bonus and call-out points, the same sum that becomes `lastPoints`) are written on their vote as `points`, beside `option` and `at`. That is what a jump subtracts. Call-outs only ever land on voters, so no points live outside a vote.

### 4.3 `trips`

`RoomState` gains `trips`: the number of roads the room has set off on. `start`, a `next` into a travel and a `goto` to a road each add one; `reset` keeps the count; a new room starts at 0. The host view carries it, and every scene is started with the trip it belongs to. The router treats a Travel or a Battle as fitting a view only when key, round and trip all match, so a jump to the round already on the projector starts its road again instead of being mistaken for the gate's own hand-over from Travel to Battle.

Rooms made before this deploy have no `trips` field. They idle out within six hours and the class room is new on the day, so there is no migration.

## 5. Automatic travel

- The party sets off by itself one second after the segment starts (`SETOFF_MS` 1000), along the segment's baked path, resting two seconds at each exhibit as it does today, and the gate starts the battle. No key is needed from the lobby's Space to the narration.
- A pauses the walk; A again resumes it from where the lead stands. Any arrow takes control. N skips to the gate. Space still jumps.
- A reload mid-travel starts the segment over and walks it again.
- Key map rows: Arrows "Take over the walk: run and jump; Space jumps too"; A "Pause or resume the walk"; N "Skip to the arena in travel".

## 6. Class figures, shared

- The four 12 by 16 figures (Rogue, Knight, Bard, Wizard) move to `shared/figures.ts` as rectangle lists over `shared/palette.ts`, where `PALETTE` moves; the host re-exports it from `host/art/placeholders.ts` so nothing else changes its imports. The host paints its `class-*` textures from the shared lists as before.
- `shared/figures.ts` also gives `figureSvg(role, scale)`: the markup of an inline SVG of rectangles (viewBox 0 0 12 16, width and height the figure's at `scale`, crisp edges, hidden from assistive tech) built from the constant lists and palette. The phone and the HUD both draw it through a holder element, the way option shapes are drawn today. Nothing from the room or a player goes into it.
- On the phone the figure replaces the weapon glyph: 3x in the role buttons of the join form, 5x on the waiting card in the lobby and in travel, 2x in "Your class leads this round". The four weapon glyphs go.
- No colour outside the palette, and no option colour on a figure.

## 7. The lobby screen

The room code block goes. Nobody types a code: the QR and the address are the two ways in, and the address ends in the code.

One panel across the top as today, the bottom third clear for the skyline and the avatars:

- Header: the title on two lines in the pixel face: "Olkaria" at 16 canvas pixels (it was 7, on one line with the subtitle) and "the Deadlock" under it at the title size (7) in ink-2, each with a hard shadow in the background colour one step down and right (two canvas pixels under the name, one under the subtitle), no blur. No quote under it. On the right, in place of the sentence hint, three keycaps with labels: Space "Start", Esc "Shows hotkeys" and ? "How to play" (the first two are Caleb's labels, 3 November, evening; the third is the how-to's). A keycap is the key map's cap (surface-2, r-sm, weight 600, body size) with a 1 px line stroke and a hard one-canvas-pixel bottom edge in the background colour; its label follows in ink-2.
- Body, three columns. The QR, a square 45% of the HUD's height as today. The join column: eyebrow "Scan, or go to", the address on two lines, the host on the first in ink-2 and the path "/j/ABCD" on the second in ink at weight 700; then "12 joined" with the number a hero in the pixel face (t-code) and the word at body size in ink-2; then a 2 by 2 grid of class tiles, each the class figure at one canvas pixel per pixel (12 by 16) beside its plural name in ink-2 and its count in ink. The "Just joined" list as today.
- Footer: none. Both quotes leave the lobby (Caleb, 3 November, evening). Tanui's still opens round 2's narration; Smith's stays in `content/case.json` and is shown nowhere.
- Offline, the square carries the offline notice as today and the join column shows only the count and the tiles. While connecting, the square says "Connecting to the room" and the join column shows only the count and the tiles.
- No new colour; the figures are the palette.

## 8. Phone onboarding

Lean copy. The join form is the heading "Join the game", a field labelled "Name", the role group labelled "Role" with the four buttons (figure, class name, stakeholder), a field labelled "Table" with the placeholder "Optional", and the Join button, disabled until a name is typed and a role picked. Gone: the title eyebrow, "Try for one of each role at your table.", "Add a name and pick a role to join.", the "Your" in the labels, the placeholder in the name field.

The waiting card (lobby and travel) is the figure at 5x, the name as the title, one line "Rogue, Citizen" (class, then stakeholder) and "Table: 3" when a table was given. Gone: "You're in as ... Watch the screen." The Change button stays, in the lobby only.

The unreachable note becomes "Can't reach this room. Scan the QR on the screen again."

Everything after the lobby is unchanged.

## 9. Documentation

RUNBOOK: the lobby and travel rows of the run of show and the "Travels 2 to 4" line; "A QR code and a four-letter room code appear" and every other mention of a code to type; the Keys table (Arrows, A, "M or Esc", and what the menu does); "If something breaks" gains "You need to redo a round, or get to one" with the menu steps and the asking-twice rule; the rehearsal checklist gains a menu drill (restart a round, jump to round 3, back to the lobby) and a phone check for the figure. README names the menu. The original spec's 3.2, 4.1, 4.5, 5.6, 6.2 and 6.5 are amended to match this document.

## 10. Left to the builder

Exact CSS values inside the tokens; how focus moves inside the panel; test fixtures. The scene code of the walk has no unit test today and is verified in the browser; the builder may add a pure helper in `road.ts` for the set-off if it earns a test.
