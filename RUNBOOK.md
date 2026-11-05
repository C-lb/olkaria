# Runbook

Live game: https://olkaria.sparkbot-worker.workers.dev
Projector page: https://olkaria.sparkbot-worker.workers.dev/host/
Phones join by scanning the QR on the lobby screen, or at the address beside it.

The game is five boss fights, one question each. Every question has three options, A, B and C. The class votes on their phones, students defend their picks, the boss dies whatever the vote, and the projector shows how the room split. Nothing is scored. After question 5 the ending congratulates the room and shows who picked each option.

## Before class

1. Open https://olkaria.sparkbot-worker.workers.dev/host/ to confirm the URL.
   A QR code and the join address appear within a few seconds.
2. In a terminal, run `caffeinate -d` and leave it running.
   It keeps the display awake. Ctrl+C stops it after class.
3. Mute notifications: turn on Do Not Disturb.
4. In Chrome, open https://olkaria.sparkbot-worker.workers.dev/host/?new=1, no more than about an hour before class.
   The room is created when the page loads, and a room closes after 6 hours with no activity.
   `?new=1` makes it a fresh room, so the class does not land in a rehearsal room with its old players.
   The page drops `?new=1` from the address by itself, so a reload stays in this room.
   Only this tab on this laptop hosts, because the room's key lives in the tab. A co-presenter who opens the host address on their own laptop makes a second room.
5. Open a second tab at https://olkaria.sparkbot-worker.workers.dev/host/?mode=offline and leave it there.
   Once loaded it needs no network, so offline mode is one tab away.
   Chrome can unload a tab it thinks is idle, and reloading it needs the network.
   So add olkaria.sparkbot-worker.workers.dev in Chrome settings, Performance, "Always keep these sites active", or click the offline tab just before class.
6. Use that offline tab to check the real fullscreen look on the projector.
   F, then Space shows the Grid Wyrm with question 1. Space opens the vote, B adds 30 bot votes (this offline tab only), and Space locks it.
   Check the backdrop, the boss, the four figures, the option cards and the text sizes from the back of the room.
   Question 2 has the longest options, so check that its cards fit: M, then Q2 Demand twice, then Space to open its vote.
   At 1920 x 1080 the game draws at 6x and fills the screen.
   Then Shift+R twice takes that tab back to its lobby, and Esc leaves fullscreen.
7. Go back to the class tab and press F for fullscreen. That is the tab you run the game in.
   Click once on the game, so the keys work and the music starts.
   If a key ever does nothing, click once on the game again. A click sends nothing to the room.
8. Scan the QR from the back row with your phone, and read the lobby text from there too.
   The QR should open the join form for this room. You do not need to join.

## Run of show

? opens How to play: seven slides in the team's words, six numbered steps (groups of 4, roles and their interests, the 2 minutes of team discussion, sabotage, being called to defend) and a closing slide on the monsters as the case's problems. Space next, ? closes (Esc too, outside fullscreen). Show it while the phones join.

| Beat | On the projector | You |
|---|---|---|
| Lobby | QR, address, how many have joined, avatars dropping in | "Scan, type your name, pick your role, and choose your team from the list." Space starts. |
| Question 1, Grid Wyrm | Power | Space opens the vote. Lock, call-outs, strike, split. |
| Question 2, Fog of Demand | Demand | The same |
| Question 3, Hydra of Rivalry | Competition | The same |
| Question 4, Wraith of Risk | Risk | The same |
| Question 5, The Deadlock | The Deadlock | The same, then Space for the ending |
| Ending | "Congratulations!", the four characters jumping, question 5's split with names | Hand over to the discussion |

Each vote runs up to 2:00 and locks early once everyone has voted. A question with a full 2:00 vote, one call-out and the split takes about 3 to 4 minutes, so five of them take 15 to 20. Time it at the rehearsal.

The roles are Citizen, Government, Local Businessman and Satya Nadella. The teams are Team 1 to Team 8. A team is only a label on the phone and changes nothing in the game.

### Keys

| Key | What it does |
|---|---|
| Space in the lobby | Start the game: question 1's boss arrives |
| Space as a boss arrives | Open the vote |
| Space in the vote | Lock the vote |
| Space on the locked vote | The party strikes and the boss dies |
| Space during the strike | Skip to the split |
| Space on the split | The next boss, or the ending after question 5 |
| Space on the ending | Nothing. The ending closes the game. |
| C | Call a student out, once the vote is locked. One at a time, up to 4 a question. |
| Y | The call-out made a valid point: the projector flashes "Valid point, Ann!" |
| N | Move on from the call-out. Nothing is shown and the banner clears. |
| R | Reopen a locked vote, or extend an open one, with a fresh 2:00. Not once the boss has died. |
| H | Hide or show names in the lobby list and on the ending |
| F | Fullscreen on or off |
| S | Sound off or on |
| ? | How to play, seven slides. Space next, ? closes (Esc too, outside fullscreen). |
| M or Esc | Open or close the menu: restart the question, back to the lobby, reload, sound off or on, go to Q1 to Q5 or the Ending. In fullscreen, Chrome takes Esc to leave fullscreen, so use M. |
| Shift+R twice | Within 3 s: back to the lobby. Players stay; their votes go. |
| Cmd+R | Reload. Needs the network. The same room and question come back. |
| 1 to 3 | Add one vote for A to C. Meant for offline mode, and works online too. |
| Shift+1 to 3 | Add ten votes for A to C |
| B | Add 30 bot votes, spread evenly over A to C. Practice (offline) mode only; online it does nothing |

Y and N do nothing unless a call-out is waiting. Neither gives anything to anyone.
Space rests about a second after each press, and a second and a half once the vote locks. A second press inside the rest is ignored without a note, so if Space seems to do nothing, wait a moment and press it again.
A key the room refuses, such as C before the vote locks, shows a short note such as "Bad phase" and changes nothing.
The vote keys (1 to 3, Shift) work while a vote is open or locked. B does the same in practice (offline) only.

### Every question

1. The boss arrives with the question's name and the question. Space opens the vote.
2. The projector shows the question, three option cards with the full text, the clock and how many still have to vote. Each phone shows the question and three buttons.
   The vote runs 2:00 and locks itself at 0:00, or as soon as everyone has voted. Space locks it early.
3. A phone that has voted shows "Look at the screen now.", then the letter it picked and that option's text.
4. Once the vote locks, each card shows its share of the votes.
   When the vote locks itself, Space does nothing for a second and a half, and a note says why: the clock ran out, or everyone voted.
   If you want call-outs, press C at that point, not Space, because Space strikes.
5. C calls out a voter whose option has not been heard yet, at random among them, and anyone not yet called once every voted option has been heard.
   The banner reads "Ann, defend B". Ann's phone says "You're up. Defend B." with the option's text, and the other phones say "Ann is defending B."
   Y if she made a valid point, N to move on. C again for the next voice, up to 4 a question.
6. Space: all four characters strike and the boss dies. It takes a few seconds, and Space skips it.
7. The split: the question and how many picked A, B and C, as counts and shares. Space goes on to the next boss.

After question 5's split, Space shows the ending: "Congratulations!" and "The Deadlock is broken.", the four characters jumping, and question 5's three options with the names of who picked each, in the order they joined. Hand counts and bot votes add to the counts but have no names. A column shows 30 names at most, then "and N more". H hides the names and leaves the counts.
The phones show "Congratulations!", "Look at the screen now." and the student's five picks.

### The five questions

From `content/case.json`, as the projector and the phones show them.

**Question 1. Grid Wyrm (Power).** What should Kenya do about the data centre's electricity needs?

- A. Protect households first. Delay the project until Kenya has enough reliable electricity for its residents.
- B. Prioritize economic growth. Give the data centre access to electricity to attract investment, even if it puts more pressure on the grid.
- C. Make Microsoft pay. Require Microsoft and its partners to secure additional electricity for the project.

**Question 2. Fog of Demand (Demand).** How should Microsoft secure enough customers in Kenya?

- A. Secure business commitments. Ask major Kenyan companies to commit to using Microsoft's services before construction.
- B. Make the government a customer. Have Kenya purchase cloud services for government operations to help create demand.
- C. Bet on future growth. Microsoft invests now without any demand guarantee, trusting that Kenya's growing technology market will bring customers later.

**Question 3. Hydra of Rivalry (Competition).** AWS, Google and Oracle are already investing in SSA. How should Microsoft respond?

- A. Enter, but start small, so it is present without overspending.
- B. Move fast, so firms get a nearby Azure region instead of relying on South Africa.
- C. Let rivals compete, because more providers could mean more choice and lower prices.

**Question 4. Wraith of Risk (Risk).** If Microsoft waits, what is the biggest thing lost?

- A. They don't lose out since the money works harder in markets that have present demand.
- B. Jobs and skills training, which are already weakened by the Nairobi centre closure.
- C. Investor trust, progress made in talks, and the chance to be East Africa's tech hub.

**Question 5. The Deadlock (The Deadlock).** What should Microsoft do in Kenya?

- A. Build big. Build the full 1 GW data centre now. Microsoft gets in early, but may build before there are enough customers.
- B. Start small. Build a smaller facility (24-60 MW) and grow later. Less money is at risk, but rivals may build bigger first.
- C. Wait. Focus on South Africa instead. This avoids the risk, but Microsoft could lose G42 and a rival could take the opportunity.

## If something breaks

**You need to redo a question, or get to one.**

1. Press M. The menu opens over the screen. While it is open the game keys do nothing.
2. Click what you want, or arrow to it, then press Enter or Space: Restart question N, Back to the lobby, Reload the page, or Q1 to Q5 or Ending under Go to.
3. Restart question N, Back to the lobby and every Go to button turn pale and say Sure? Press the same one again within 3 s. A double-click counts as one press, so press once more after it. Pressing another button calls the first off and arms that one instead, and closing the menu or waiting calls it off too. Reload the page fires at once while the projector is connected, asks twice while it is not, and is greyed out in offline mode.
4. The menu closes and the screen moves: a boss arrives, the lobby comes back, or the ending shows. Phones follow by themselves.

Questions before the one you went to keep their votes. That question and the ones after it start over. Going to the Ending shows what has been played.
Going to a question from the lobby starts the game there.

**The Wi-Fi drops.**
The projector shows "Reconnecting to the room" and keeps trying, at most 10 s apart.
That note goes when the scene changes, so the other sign is Space and the game keys answering "Not connected".
Phones keep trying too. They can switch to cellular data, and the laptop can tether to your phone.
If the room does not come back, switch to offline mode:

1. Esc leaves fullscreen. Click the offline tab from before class and press F there.
   With a network you could also open https://olkaria.sparkbot-worker.workers.dev/host/?mode=offline.
2. Offline mode starts at its own lobby with no phones. Space starts it at question 1.
3. To get to your question, press M, then the question under Go to, twice.
4. Space opens the vote. Take a show of hands per option and type the counts: 1 to 3 add one vote for A to C, and Shift+1 to 3 add ten.
   For 23 hands on B: Shift+2, Shift+2, then 2 three times.
   Digits typed before the vote opens answer "Not accepting votes" and count for nothing.
5. Space locks the vote, Space strikes, and Space goes on, as online. C still works, but with no phones it is a hand call-out with no name, and Y flashes "Valid point!".
6. The offline ending has counts and no names, because hand counts have none.
7. Do not reload the offline tab. Offline mode keeps nothing, and with no network a reload loses the page: Chrome shows its offline page.
8. If the Wi-Fi comes back, you can return to the class tab. It reconnects by itself and shows "Connected".
   Phones that still have the page open reconnect on their own.
   The room is where you left it, except that an open vote will have locked itself. Nothing played offline carries over.

**The projector says "The room has closed. Reload the page for a new room".**
The room closed after 6 hours with no activity, so the page cannot get back in.
Before the note, the projector shows "Reconnecting to the room" for several seconds with no Wi-Fi trouble, and every key answers "Not connected".
Reload the tab (Cmd+R). It opens a new room, and the class scans the new QR.

**A phone looks stuck.**
Refresh the page. It rejoins as the same player.

**A student cannot join.**
Read out the address beside the QR, all of it, with the `/j/` and the letters at the end. Those letters have no I or O.
The bare address without `/j/` opens the projector page, not the join page.
A phone that says "Can't reach this room. Scan the QR on the screen again." most likely has the wrong address. Have it scan the QR.
The Join button stays grey until the student has typed a name, picked a role and chosen a team.

**A student picked the wrong role or team.**
While the lobby is up, they tap Change on their phone and pick again.
Once the game has started, roles and teams stay as they are.

**A phone drops mid-game.**
It reconnects by itself and comes back to the question the room is on, with its vote if it had voted. If it does not, reopen the join address on that phone; it rejoins as the same player.
A student who misses a vote shows "Look at the screen now." with no pick, and their ending shows "No vote" for that question.

**The projector page reloads.**
With a network, it comes back to the same room and the same question, in the same tab.
A boss's arrival comes back as that boss's arrival. A strike in progress comes back on the split.
With no network, a reload shows Chrome's offline page, so do not reload while the Wi-Fi is down.
Never open the host page in a new tab mid-game. A new tab makes a new room, and the phones stay in the old one.
If you close the tab by accident, Cmd+Shift+T reopens it.
If it comes back in the game, carry on. If it comes back at a lobby with nobody joined, the old room is out of reach, so ask the class to scan the new QR.

**A call-out nobody wants.**
N moves on and clears the banner.
C again calls someone else, up to 4 a question.
Space with the call-out still up strikes at once, and that question takes no more call-outs.

**A vote needs more time.**
R reopens it with a fresh 2:00, even after it locked. Once the boss has died, the vote is final.
A vote that locked because everyone had voted reopens the same way, for a late joiner, who shows as "1 still to vote". It locks again once everyone has voted.
If no one is left to vote, the reopened vote stays open and the status line reads "Everyone has voted". Space or the clock closes it.

**Names should not be on screen.**
H hides them in the lobby list and on the ending.
Phones still show a called student's name whatever H says.
A call-out still names the student on the banner and in the "Valid point" flash.
There is no kick on the projector, and none will be built. A rude name stays in the room.
H keeps it off the lobby list and the ending. If a call-out lands on it, press N straight away.

**No sound.** Check the laptop's output and its volume, then press S twice. The browser plays nothing until the page has been clicked or a key pressed once.

**Something is badly wrong.**
Shift+R, then Shift+R again within 3 s, takes the room back to the lobby. The first press shows "Press Shift+R again to reset".
Everyone stays joined. Their votes go.

## After class

- Shift+R twice resets the room to the lobby, if you want the screen cleared.
- Rooms close by themselves after 6 hours with no activity. There is nothing to clean up.
- Ctrl+C in the caffeinate terminal.

## Rehearsal checklist

On the projector if you can.

- [ ] Five phones join, each with a team from the list, and every role covered. There are four roles, so one comes twice.
- [ ] A full run of all five questions and the ending, timed.
- [ ] On a phone, the question and all three options read without a sideways scroll.
- [ ] Up to four call-outs on one question, one voice per option, each judged with Y or N.
- [ ] Question 2: switch to the offline tab on purpose and play the question with hand counts. Then go back to the online tab and carry on.
- [ ] Question 3: reload the host page once (Cmd+R) after the vote opens. It should come back to the same question. Do it in the online tab, since offline mode starts over on a reload.
- [ ] The ending lists each phone's name under the option it picked on question 5. H hides the names and leaves the counts.
- [ ] The menu: M, Restart question 1 twice, play on. M, Q3 Competition twice. M, Back to the lobby twice.
- [ ] Each phone shows its role figure on the join form and on the waiting screen, and its team on the waiting screen.

### What confused a teammate

-
-
-
