# Olkaria: two-minute votes, early lock, one voice per option

## 1. Intent

Caleb asked on 3 Nov 2026 for three changes to a round:

- the vote window grows from 30 s to 2 minutes, and a vote locks itself as soon as everyone has voted;
- the screen shows how many players are still to vote;
- call-outs go up to four a round, each one picking a random voter whose option the round has not heard yet.

Why: with 30 s the tables could not talk before voting, and with one call-out the room heard one side. The game is on 4 Nov, so nothing here reshapes a screen: the numbers change, the room gets one more lock rule and a new chooser, and the status line says who is left.

## 2. Rules

2.1 **Window.** `voteSeconds` is 120 in `content/case.json`. R (reopen or extend) uses the window the vote opened with, as today. The host's `openVote` may still pass its own seconds.

2.2 **Early lock.** When a vote arrives and, with it counted, every player in the room has a vote for the current round, the room locks the vote in that same event: phase `locked` and a `clearAlarm` effect, exactly what `closeVote` does. Conditions: there is at least one player; synthetic votes (1 to 4, Shift, B) are not players and never trigger it; a player who joins during the vote has no vote and holds the lock off until they vote or the clock runs out; a player whose phone has gone dark but who is still in the room's list holds it off too, and the clock covers that case. After an early lock, R reopens as any reopen does: a fresh deadline, standing votes stand, nobody votes twice.

2.3 **The count on the screen.** While the vote is open the status line reads "N still to vote" (N is the number of players without a vote this round), "Everyone has voted" at zero, and "No players yet" when the room has no players. Once locked it reads "N of M voted" as today (M is players plus synthetic voters). Offline it reads "N voted" as today, and there is no early lock, because there are no players.

2.4 **The clock** reads minutes and seconds on the projector and on the phone: "2:00", "1:59", "0:09", "0:00", rounded up as today.

2.5 **Lock note.** When the vote locked itself because everyone voted, the host shows "Everyone has voted. C calls a student out, Space strikes" for 2 s, under the same Space rest as the clock lock. The clock's own note is unchanged.

2.6 **Call-outs.** `maxCallouts` is 4. Each `callout` picks from the players who voted this round and have not been called this round. Of those, it prefers the ones whose option no call-out of this round has covered yet (a hand call-out covers nothing); when that pool is empty, any uncalled voter. The pick is `floor(pick * pool.length)` over the pool sorted by join time then id, as today, so the reducer stays pure; an explicit `playerId` still wins; with nobody eligible it records a hand call-out, as today. The preference for the lead class goes. A fifth call-out is refused with "call-out limit"; a call-out while one is pending is refused as today.

2.7 **Rally damage** stays `min(convincing rallies, maxCallouts) * calloutBonus`, so up to 40 a round with four. `calloutBonus` stays 10 (the controller's ruling: Caleb asked for four voices, not for less damage each; one number in `case.json`, `calloutBonus` 5, puts the cap back at 20).

## 3. Copy

- Status line, vote open: `${n} still to vote`, `Everyone has voted`, `No players yet`.
- Status line, locked: `${count} of ${total} voted` (unchanged). Offline: `${count} voted` (unchanged).
- Clock: `m:ss`.
- Note: `Everyone has voted. C calls a student out, Space strikes`.
- The options footer and the key map keep "C calls a student out". The runbook says four a round, one voice per option.

## 4. Docs

RUNBOOK.md (the run of show, "Every round", the key table, the troubleshooting lines on call-outs and R, the rehearsal checklist); the game spec `2026-11-02-olkaria-deadlock-design.md` (4.3 steps 2 and 3, the rally bonus line, the state machine lines on `openVote` and `callout`, the summary line on call-outs); the character sheet builder's rule text (the controller rebuilds the PDF and the artifact).

## 5. Non-goals

No change to points per vote (the speed bonus decays over the new window by itself). No count of voters on the phone. No banner redesign: one call-out at a time stays, so the facilitator paces the four. No change to the ending tiers.
