# Runbook

Live game: https://olkaria.sparkbot-worker.workers.dev
Projector page: https://olkaria.sparkbot-worker.workers.dev/host/
Phones join at the address on the lobby screen, which ends in `/j/` and the room code.

Load-tested on 3 November 2026 on this URL: 60 simulated phones, two full games, every vote counted.

## Before class

1. Open https://olkaria.sparkbot-worker.workers.dev/host/ to confirm the URL.
   A QR code and a four-letter room code appear within a few seconds.
2. In a terminal, run `caffeinate -d` and leave it running.
   It keeps the display awake. Ctrl+C stops it after class.
3. Mute notifications: turn on Do Not Disturb.
4. In Chrome, open https://olkaria.sparkbot-worker.workers.dev/host/?new=1, no more than about an hour before class.
   The room is created when the page loads, and a room closes after 6 hours with no activity.
   `?new=1` makes it a fresh room, so the class does not land in a rehearsal room with its old players.
   The page drops `?new=1` from the address by itself, so a reload stays in this room.
   Only this tab on this laptop hosts: the room's key lives in the tab. A co-presenter who opens the host address on their own laptop makes a second room.
5. Open a second tab at https://olkaria.sparkbot-worker.workers.dev/host/?mode=offline and leave it there.
   Once loaded it needs no network, so offline mode is one tab away.
   Chrome can unload a tab it thinks is idle, and reloading it needs the network.
   So add olkaria.sparkbot-worker.workers.dev in Chrome settings, Performance, "Always keep these sites active", or click the offline tab just before class.
6. Use that offline tab for the real fullscreen look on the projector.
   F, then Space shows the travel backdrop, then N shows the Grid Wyrm and its HP bar.
   Check the backdrop, the boss, the HP bar, the class figures and the text sizes.
   The class figures are 12 × 16 placeholders drawn in code, and they stay that way for this presentation.
   So far the game has only been seen in a laptop browser window, never fullscreen on a 1920 × 1080 projector.
   At 1920 × 1080 it draws at 6× and fills the screen.
   For the next boss: Space, B, then Space four times, then N, with a slow two-count between presses. The same again for each boss after it.
   Then Shift+R twice takes that tab back to its lobby, and Esc leaves fullscreen.
7. Go back to the class tab and press F for fullscreen. That is the tab you run the game in.
   If a key ever does nothing, click once on the game. A click gives the page the keyboard and does nothing else.
8. Scan the QR from the back row with your phone, and read the lobby text from there too.
   The QR should open the join form for this room. You do not need to join.

## The 12-minute run of show

? opens How to play: eight slides, Space next, Esc closes. Show it while the phones join.

| Time | Beat | On the projector | You |
|---|---|---|---|
| 0:00 to 1:30 | Lobby | QR, code, address, counts per class, avatars dropping in | "Tables of four. Scan, type your name, pick your role (one of each per table), then type your table number, just the number." Space starts. |
| 1:30 to 2:00 | Travel 1 | The party runs toward Olkaria past three exhibit pickups | Run with the arrows or A. Read each fact as it pops. N skips to the arena. |
| 2:00 to 4:30 | Round 1, Grid Wyrm | The Rogues' special attack: what Kenyans accept on power | Up to 2 min vote, locks when everyone has voted, up to four call-outs, strike, 45 s debrief |
| 4:30 to 7:00 | Round 2, Debt Golem | The Knights' special attack: what the Government offers | Same shape |
| 7:00 to 9:30 | Round 3, Fog of Demand | The Bards' special attack: what Kenya's businesses commit | Same shape |
| 9:30 to 11:30 | Round 4, the core | The Wizards' special attack: Microsoft's decision, then the ending | "What should Microsoft do, and why?" |
| 11:30 to 12:00 | Leaderboard | Top five, most consistent strategist, top table, the final split | Hand the split to the discussion |

Travels 2 to 4: press N straight away unless you are running early.

The times above are for a 30 s vote and one call-out. A vote of up to 2 min and up to four call-outs can stretch each round, so the run can pass 12:00 and every time from 2:00 on slides later with it. Time it at the rehearsal.

### Keys

| Key | What it does |
|---|---|
| Space in the lobby | Start the game |
| Space in travel | Jump |
| Space at the narration | Open the vote |
| Space in the vote | Lock the vote |
| Space on the locked vote | The party strikes |
| Space during the strike | Skip to the debrief |
| Space on the debrief | Next travel, or the ending after round 4 |
| Space on the ending | The leaderboard |
| Space on the leaderboard | Nothing |
| Arrows | Run and jump in travel |
| A | Auto-run in travel. It pauses at each exhibit. An arrow takes control back. |
| N | In travel: skip to the arena. With a call-out up: not convincing. |
| C | Call a student out, once the vote is locked |
| Y | Call-out convincing |
| R | Reopen a locked vote, or extend an open one, with a fresh 2:00 |
| 1 to 4 | Add one vote for A to D |
| Shift+1 to 4 | Add ten votes for A to D |
| B | Add 30 bot votes, weighted toward the evidence |
| H | Hide or show names in the lobby list and on the leaderboard |
| F | Fullscreen on or off |
| ? | How to play, eight slides; Space next, Esc closes |
| Esc | Show or hide the key map. In fullscreen, Chrome takes Esc to leave fullscreen. |
| Shift+R twice | Within 3 s: back to the lobby. Players stay; votes and scores go. |
| Cmd+R | Reload. Needs the network. The same room and screen come back, except that the narration comes back as the start of travel, and a strike in progress comes back as its debrief. |

In the arena, Space rests about a second after each press, and a second and a half once the vote locks. A second press inside the rest is ignored without a note.
If Space seems to do nothing, wait a moment and press it again.
A key the room refuses, such as C before the vote locks, shows a short note such as "Bad phase" and changes nothing.
The vote keys (1 to 4, Shift, B) work while a vote is open or locked. They count for the party, never the lead class.

### Every round

1. You arrive at the arena with the narration up. Space opens the vote.
2. The vote runs 2:00 and locks itself at 0:00, or as soon as everyone has voted. Space locks it early.
   The status line counts who is still to vote.
   When the vote locks itself, Space does nothing for a second and a half, and a note says why: the clock ran out, or everyone voted.
   Then C calls a student out, and Space strikes.
3. Once locked, each card shows two bars: the lead class and the rest of the party.
   C calls out a voter whose option the round has not heard yet, at random among them (anyone uncalled once every voted option has been heard).
   The student defends their choice.
   Y if convincing: +10 damage and 30 points to them. N if not: no bonus and 10 points.
   C again for the next voice. Four per round at most.
4. Space: the party strikes. Space during the strike skips to the debrief.
5. Debrief: read the discuss line and take a comment or two. Space moves on to the next travel.

After round 4's debrief, Space shows the ending. Space again shows the leaderboard.
On the leaderboard Space does nothing, so a stray press cannot end the closing screen.

### Discuss lines

As of 3 November, the debriefs show these lines (`rounds[i].discuss` in `content/case.json`).

- Round 1, Grid Wyrm: "Why did the full 1 GW do so little damage, and what condition made 60 to 100 MW safe?"
- Round 2, Debt Golem: "Two live offers, one honest refusal, one dead option. Which would you sign, and who carries the risk?"
- Round 3, Fog of Demand: "What would Kenya's businesses need to see before they sign, and what would Microsoft need to see before it builds?"
- Round 4, the core: "What should Microsoft do, and why?"

### Exhibit facts

As of 3 November (`exhibits` in `content/case.json`).
Each pickup in travel adds +5 to the next strike, three at most. N skips them.

- Travel 1: Olkaria generates about 950 MW. Record peak demand 2,444 MW, January 2026. 1 GW = about 31% of installed capacity.
- Travel 2: Public debt about 68% of GDP, June 2025. 48.5% of ordinary revenue goes to debt service. PPP liabilities need Parliament's approval, September 2026.
- Travel 3: Kenya's data-centre market is about 20 MW. Market worth US$266 million in 2025, US$805 million by 2031. 97.5% of online Kenyans vs 8.7% of all Kenyans used AI.
- Travel 4: US$1 billion is 0.6% of Microsoft's FY2027 capex. Nairobi development centre closing, October 2026. Microsoft committed US$329 million more to South Africa, April 2026.

## If something breaks

**The Wi-Fi drops.**
The projector shows "Reconnecting to the room" and keeps trying, at most 10 s apart.
That note goes when the scene changes, so the other sign is Space and the game keys answering "Not connected".
Phones keep trying too. They can switch to cellular data, and the laptop can tether to your phone.
If the room does not come back, switch to offline mode:

1. Esc leaves fullscreen. Click the offline tab from before class and press F there.
   With a network you could also open https://olkaria.sparkbot-worker.workers.dev/host/?mode=offline.
2. Offline mode starts at its own lobby with no phones. Space starts it.
3. To catch up, play each round you already did on bot votes: N, Space, B, then Space four times.
   Leave a slow two-count between presses and wait for each change: N brings the narration, Space opens the vote, B adds 30 votes, then each Space brings the bars, the strike, the debrief and the next travel.
   If the debrief comes by itself at the end of the strike, leave out that Space.
4. For your round: N, then Space to open the vote, then the hand counts.
   Take a show of hands per option and type the counts: 1 to 4 add one vote for A to D, Shift+1 to 4 add ten.
   For 23 hands on B: Shift+2, Shift+2, then 2 three times.
   Digits typed before the vote opens answer "Not accepting votes" and count for nothing.
5. The debrief says no one of the lead class voted, because hand counts count for the party. That is expected.
6. The offline leaderboard has no names and no top table, and it says "No one voted in all four rounds".
   The final split and the closing question still show.
7. Do not reload the offline tab. Offline mode keeps nothing, and with no network a reload loses the page: Chrome shows its offline page.
8. If the Wi-Fi comes back, you can return to the class tab. It reconnects by itself and shows "Connected".
   Phones that still have the page open reconnect on their own.
   The room is where you left it, except that an open vote will have locked itself. Nothing played offline carries over.

**The projector says "The room has closed. Reload the page for a new room".**
The room closed after 6 hours with no activity, so the page cannot get back in.
Before the note, the projector shows "Reconnecting to the room" for several seconds with no Wi-Fi trouble, and every key answers "Not connected".
Reload the tab (Cmd+R). It opens a new room with a new code, and the class scans the new QR.

**A student cannot join.**
Read out the address beside the QR, with the `/j/` and the four-letter code at the end. Codes have no I or O.
The bare address without `/j/` opens the projector page, not the join page.
A phone that says "Can't reach room" most likely has the wrong code.

**A student picked the wrong role.**
While the lobby is up, they tap Change on their phone and pick again; the counts per class move with them.
Once the game has started, roles stay as they are.

**A class has no one in the lead role.**
The lead strike is skipped, the party carries the whole attack, and the debrief says so ("No Rogues voted this round"). Carry on.

**The projector page reloads.**
With a network, it comes back to the same room and the same screen, in the same tab.
A strike in progress comes back as its debrief. Travel starts again from the beginning.
The narration counts as travel, because the room stays in travel until the vote opens: a reload there brings back the start of travel, and N gets you to the arena again.
With no network, a reload shows Chrome's offline page, so do not reload while the Wi-Fi is down.
Never open the host page in a new tab mid-game. A new tab makes a new room, and the phones stay in the old one.
If you close the tab by accident, Cmd+Shift+T reopens it.
If it comes back in the game, carry on. If it comes back at a lobby with a new code, the old room is out of reach: ask the class to scan the new QR.

**A call-out nobody wants.**
N declines it: no bonus, and the student still gets 10 points.
C again calls someone else, four per round at most.
Space with the call-out still up strikes at once and counts it as declined, so there is no further call-out that round.

**A vote needs more time.**
R reopens it with a fresh 2:00, even after it locked. Once the party has struck, the round is final.
A vote that locked because everyone had voted reopens the same way, for a late joiner. It locks again once everyone has voted.
If nobody new votes, the reopened vote stays open and the status line reads "Everyone has voted". Space or the clock closes it.

**Names should not be on screen.**
H hides them in the lobby list and on the leaderboard.
Everything about a call-out still names the student: the banner, the line under the cards, the rally strike and the debrief's rally line.
There is no kick on the projector, and none will be built. A rude name stays in the room.
H keeps it off the lobby list and the leaderboard. If a call-out lands on it, press N straight away.
The banner shows the name until you do, and the line under the cards keeps it until the debrief.

**Something is badly wrong.**
Shift+R, then Shift+R again within 3 s, takes the room back to the lobby. The first press shows "Press Shift+R again to reset".
Everyone stays joined. Votes and scores go.

## After class

- Shift+R twice resets the room to the lobby, if you want the screen cleared.
- Rooms close by themselves after 6 hours with no activity. There is nothing to clean up.
- Ctrl+C in the caffeinate terminal.

## Rehearsal checklist

For 4 November, on the projector if you can.

- [ ] Five phones join with the same table number and every role covered. There are four roles, so one comes twice.
- [ ] A full 12-minute run, timed against the run of show.
- [ ] Up to four call-outs per round, one voice per option, judged with Y or N.
- [ ] Round 2: switch to the offline tab on purpose and play the round with hand counts. Then go back to the online tab and carry on.
- [ ] Round 3: reload the host page once (Cmd+R) after the vote opens. It should come back to the same screen, or to the debrief if the strike was playing. Do it in the online tab, since offline mode starts over on a reload.
- [ ] The leaderboard names the shared table as the top table.

### What confused a teammate

-
-
-
