# Olkaria class edits: design

Date: 4 November 2026. For the BUSI611 session on 5 November 2026, so this ships tonight. Approved by Caleb with the amendments marked "Caleb's ruling".

## Why

Caleb's team rewrote the case discussion around five questions and four problems: power, demand, competition and risk. The game must now carry that discussion and stop competing with it. Scores, damage, explanations and collecting facts all pull the room's attention away from the argument. The game becomes a simple frame: a boss per problem, a question, a vote, students defending their answers, the boss dies, the room sees how it split.

## Goals

- The five questions below, word for word apart from one spelling normalisation, each with options A, B and C.
- The question on both the phone and the projector while voting.
- No points of any kind, anywhere. The boss always dies.
- After voting, the phone tells the student to look at the screen.
- Four problem bosses plus the original Deadlock core as the final boss.
- New role sprites holding weapons, including Satya Nadella for Microsoft.
- No walking levels and no fact collecting between bosses.
- Team 1 to Team 8 dropdown instead of the free-text table.
- An ending that congratulates the room and shows who picked A, B and C.
- The character sheet matches the new game.

## Non-goals

- No new game mechanics. Nothing replaces points.
- No team competition or team results. Teams are a label (see Join).
- Internal names need not change where renaming would only add risk tonight. `table` in the code may keep meaning team, and the `travel` phase may keep its name for the moment before a vote opens.

## Anti-goals

- A score, rank, damage number, HP bar or "points" word left visible on any screen, including the how-to slides. The one allowed use of the word is the flash "Valid point, Ann!".
- A phone showing an explanation of why an option is good or bad.
- A question or option paraphrased or shortened anywhere. There are no short labels (Caleb's ruling): an option is shown as its letter, its full text, or both.
- The live URL breaking before class. The current version stays live until the new one passes a smoke test.

## The questions

"data center" is normalised to "data centre", because the source used both and the case uses "centre". Everything else is verbatim, including "SSA" in Q3 (Caleb's ruling).

### Q1. Boss: Grid Wyrm (Power)
What should Kenya do about the data centre's electricity needs?

- A. Protect households first. Delay the project until Kenya has enough reliable electricity for its residents.
- B. Prioritize economic growth. Give the data centre access to electricity to attract investment, even if it puts more pressure on the grid.
- C. Make Microsoft pay. Require Microsoft and its partners to secure additional electricity for the project.

### Q2. Boss: Fog of Demand (Demand)
How should Microsoft secure enough customers in Kenya?

- A. Secure business commitments. Ask major Kenyan companies to commit to using Microsoft's services before construction.
- B. Make the government a customer. Have Kenya purchase cloud services for government operations to help create demand.
- C. Bet on future growth. Microsoft invests now without any demand guarantee, trusting that Kenya's growing technology market will bring customers later.

### Q3. Boss: Hydra of Rivalry (Competition)
AWS, Google and Oracle are already investing in SSA. How should Microsoft respond?

- A. Enter, but start small, so it is present without overspending.
- B. Move fast, so firms get a nearby Azure region instead of relying on South Africa.
- C. Let rivals compete, because more providers could mean more choice and lower prices.

### Q4. Boss: Wraith of Risk (Risk)
If Microsoft waits, what is the biggest thing lost?

- A. They don't lose out since the money works harder in markets that have present demand.
- B. Jobs and skills training, which are already weakened by the Nairobi centre closure.
- C. Investor trust, progress made in talks, and the chance to be East Africa's tech hub.

### Q5. Boss: The Deadlock (final)
What should Microsoft do in Kenya?

- A. Build big. Build the full 1 GW data centre now. Microsoft gets in early, but may build before there are enough customers.
- B. Start small. Build a smaller facility (24-60 MW) and grow later. Less money is at risk, but rivals may build bigger first.
- C. Wait. Focus on South Africa instead. This avoids the risk, but Microsoft could lose G42 and a rival could take the opportunity.

## The flow

1. **Lobby.** As now: address, QR, player count. Space starts.
2. **Boss arrives.** The Battle scene comes up at once with the party, the boss, the problem's name (Power, Demand, Competition, Risk, The Deadlock) and the question. No road, no walking, no gate, no facts to collect, no narration. Space opens the vote.
3. **Vote.** Projector: question, three option cards with full text, the clock, how many still have to vote. Phone: "Question N of 5", the clock, the question, three buttons with the full option text. The 2:00 window and the early lock when everyone has voted stay.
4. **After a phone votes.** The phone shows "Look at the screen now." as the main line, then "You picked B." and the option's full text in smaller type. It stays there through the lock and the reveal. A phone that did not vote shows "Look at the screen now." only.
5. **Locked.** Projector shows one share bar per option, because the lead/support split goes. C calls a student out as now: the banner names the student and the letter ("Ann, defend B"), the phone says "You're up. Defend B." over the option's full text, and the other phones say "Ann is defending B." Y and N stay (Caleb's ruling). Y flashes "Valid point, Ann!" on the projector, or "Valid point!" for a hand call-out with no name. N shows nothing and clears the banner. Neither awards anything. One call-out at a time, up to 4 a round, as now.
6. **Space: the boss dies.** All four party members strike, the boss flashes and dies. Always, whatever the vote, including a round with no votes. A few seconds at most, and Space skips it. No numbers rise and there is no HP bar. The arena then shows the dead boss's spot, the question and the final A/B/C split as counts and shares. No explanations and no citations.
7. **Space: next boss,** back to step 2. After Q5 Space goes to the ending.
8. **Ending (Caleb's ruling).** The projector says "Congratulations!" with "The Deadlock is broken." under it. The four characters jump on the spot, in a loop. Below, Q5's question and three columns, one per option: the letter, the option's full text, how many picked it, and the names of the students who picked it, in the order they joined. With names hidden (H), a column shows its count only. Hand counts and bot votes add to the count and have no names. A column shows at most 30 names, then "and N more". There are no ending titles, no "what must be true" and no "risk" lines. It closes the game: Space does nothing further. The phones show "Congratulations!", "Look at the screen now.", and the student's five picks, each as its letter and full option text, or "No vote".

## Join

- Name stays free text and is required.
- Role picker stays, with the new sprites.
- The table field becomes a required dropdown: placeholder "Choose your team", then Team 1 to Team 8. Join stays disabled until name, role and team are all set. The room accepts only those eight values.
- The team shows on the phone's waiting card. It affects nothing else.

## Roles

The fantasy classes go. Roles and their displayed names:

| Role id | Shown as | Sprite, each holding a weapon |
|---|---|---|
| citizen | Citizen | Everyday clothes, carrying a working tool as a weapon |
| business | Local Businessman | Suit and tie, swinging a briefcase or holding a sword |
| government | Government | Formal dress with a Kenyan-flag-coloured sash, holding a large gavel |
| microsoft | Satya Nadella | Short dark hair, glasses, trim beard, dark jacket, the four-colour Microsoft square on the chest, holding a sword |

The figures must be recognisable on the projector at the scene's zoom, and the Nadella sprite must read as him with a legible logo. The current 12 x 16 grid leaves too little room for that, so go to 16 x 20 in `shared/figures.ts`. The rule that figures carry no option colour is waived for the logo's four colours. The figures appear in the lobby, the arena, the phone and the how-to, all drawn from `shared/figures.ts`.

No role leads a round any more: the "your class leads" note, lead and support tallies, the lead's position in front and the caster bonus all go. The party stands in a row and all strike together.

## Bosses

| Round | Id | Name | Art |
|---|---|---|---|
| Q1 | power | Grid Wyrm | Existing |
| Q2 | demand | Fog of Demand | Existing |
| Q3 | competition | Hydra of Rivalry (Caleb's ruling). Three heads, one per rival. No real company logos | New, same style and box as the others |
| Q4 | risk | Wraith of Risk (Caleb's ruling). An hourglass body, for the cost of waiting | New, same style and box as the others |
| Q5 | core | The Deadlock | Existing core |

The Debt Golem goes. All five share a death animation, added to the boss class alongside `idle`, `hit` and `reset`.

## What gets removed

- `Travel` scene, roads, gates, the party's follow logic, exhibits and their commands, and the hotkeys that only drive these (N as the road's skip, A and the arrows).
- `Leaderboard` scene and its phase, both scoring awards, player scores and ranks.
- Damage, HP, bonuses, synergy, tiers, every ending title with its bullets, the "Deadlock holds" ending, option scores, debriefs and projector lines, short phone labels, the debrief panel, the narration panel, the old quotes. Call-out points and the rally damage go; the Y/N judging itself stays.
- Option D from every type, tally, schema, colour lookup, offline hotkey (1 to 3 now) and bot draw. Bots draw evenly, since there are no scores to lean on.

Call-outs: the limit stays 4 per round, but only 3 options now exist. The picker prefers a voter of an option not yet heard and, once every chosen option has been heard, takes any voter not yet called.

## Also changed

- How-to slides (`?`): rewritten to the new flow, no points or classes. Fewer slides is fine.
- Facilitator menu: stages become Q1 to Q5 and Ending. Its restart, lobby, reload and sound items stay.
- `RUNBOOK.md` and `README.md`: rewritten to the new flow. The old per-round discussion prompts refer to damage and go. The builder writes no new ones, because the team has its own discussion script: the runbook lists the five questions and their bosses only. This is the builder's call.
- Music: the road's theme is no longer used. Theme cues per phase otherwise stay, with the boss's arrival taking the old pre-vote slot.
- Room data: a room saved by an earlier build must still load without crashing the Durable Object. The class opens a fresh room with `?new=1`, so a stale room need not be playable. A stored `leaderboard` phase loads as `ending`.

## Character sheet

Caleb's saved edits live in the artifact at https://claude.ai/artifact/XvnuWqZreg91KxBx9ZsoH1 (`data/sheet.json`), so read that back first, and treat it as newer than the repo's `docs/character-sheet/sheet.json`.

- Rounds section: the five new questions and options, word for word, the same full option text the phone's vote buttons show (Caleb's ruling). No narration, because the old narration argues the old questions. No "The Facts" lists and no "On your phone:" lines (Caleb's ruling): both come out of the JSON and the `build.py` template.
- The cards' `stakeholder` lines stay as Caleb wrote them.
- Class cards: titles and sprites become the new roles. Drop each card's "Round N" line. Stats and specials stay as flavour, renaming a special only where it names a dead class.
- Preamble: stays as Caleb wrote it, unless a sentence describes a mechanic that has gone, which then goes.
- Rebuild the artifact and the PDF at `~/Desktop/BUSI611/Olkaria character sheet.pdf`.

## Builder's calls, for Caleb to check

- "Look at the screen now." appears as soon as a student votes, not only at the reveal, following "after the user selects".
- The ending lists names under each of Q5's options, reading "who picked A/B/C" as the students by name. The 30-name cap per column, and the line "The Deadlock is broken.", are the builder's.
- N on a call-out shows nothing.
- Boss art and sprite detail.

## Verification

- Unit tests stay green, removing those for deleted features and adding them for the new behaviour.
- Deploy in two steps, because a deploy to `olkaria` replaces the live game at once and a Worker with a Durable Object gets no preview URL. First deploy the build as a second Worker, `olkaria-next`, with its own Durable Object namespace (a wrangler environment), and smoke-test that. Only when it passes, `npm run deploy` to `olkaria` after `wrangler whoami`, and run the smoke test again on production. If production fails, `wrangler rollback`. This is the builder's call. Caleb's ruling on the gate: once `olkaria-next` passes, go live without waiting for him, then send him the screenshots (sprites, bosses, both vote screens, the ending) on Telegram; anything he dislikes is fixed after.
- The smoke test: a host at 1920 x 1080 and a phone at 390 x 844 run a real room through all five questions to the ending, with screenshots of each boss, a vote screen on both devices, and the ending. Check no phone screen needs a horizontal scroll and the Q2 option text fits the projector cards.
- A search of the built host and phone text for "points", "score", "rank", "damage", "HP" and the old class names.
- Commit and push to main as work completes. Telegram update at each junction.
