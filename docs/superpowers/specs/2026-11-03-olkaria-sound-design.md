# Olkaria: chiptune music and pixel sound effects

Date: 3 November 2026. Adds sound to the host page. Amends `2026-11-02-olkaria-deadlock-design.md` section 7 (which listed sound as the first cut) and the 3 November menu design (one more menu item). Repo `~/olkaria`.

## 1. Intent

Caleb asked: "are there sound effects? and background music? make it intense like kahoot's, and sound effects make it sound pixel like." There is no sound in the build today.

Why. Kahoot's hold on a room is half its music: a bouncy lobby loop, then a tense question loop that speeds up as the clock runs down. Olkaria has the same beats (lobby, travel, a vote of up to 2:00, a strike, an ending) and a pixel-art world, so the music should be chiptune, and the effects the clicks and blips of an 8-bit game.

## 2. Goals, non-goals, anti-goals

Goals

- Music on the host for every phase, looping, with the vote theme tightening as the clock runs down (faster, higher, a ticking lead) and a riser in the last three seconds.
- Pixel sound effects for the moments that matter: a phone joins, the vote locks, the countdown ticks, a call-out lands, a rally is judged, each strike number hits, the ending resolves, the menu opens.
- Everything synthesised in the browser with the Web Audio API: square, pulse, triangle and noise voices. No audio files, nothing to license, nothing to download.
- One key (S) and one menu item turn sound off and on; the choice survives a reload.
- Nothing plays on the phones.

Non-goals

- No recorded or downloaded music. No voice. No per-student sounds.
- No sound on the phone page.
- No volume slider: on or off.

Anti-goals

- Sound must never block or delay the game: if the browser refuses the audio context, or the page has not yet been touched, the game plays on silently.
- No sound may fire more than once for one event, and a burst of joins must not machine-gun the room.
- Nothing shrill. The music sits under the facilitator's voice: music well below the effects, the effects below speech.

## 3. The sound of it

### 3.1 Voices

A small chip: four kinds of voice, each an oscillator or a noise source through a gain envelope.

- Pulse (a square wave at 25% or 12.5% duty, built as two detuned-free squares or a periodic wave): leads.
- Square (50%): bass.
- Triangle: pads and arpeggios.
- Noise (a white-noise buffer through a band-pass filter): drums and hits. A kick is low noise with a fast pitch drop, a hat is high short noise, a snare is mid noise.

Envelopes are attack, decay, sustain and release in milliseconds, chosen per voice. Music tracks go through a music gain (0.28), effects through an effects gain (0.55), both into a master (0.8). While strike hits play, the music gain dips to 0.12 and returns over 400 ms.

### 3.2 Music, one theme per moment

Themes are patterns: a tempo, a length in bars, and tracks of sixteenth-note steps written as note names ("C4"), rests ("-") and holds ("."). All in 4/4 unless said.

| Theme | When | Feel | Tempo |
|---|---|---|---|
| lobby | Lobby | Bouncy major loop (C major, I V vi IV), pulse lead, square bass on the beat, hat on the off-beats | 124 |
| travel | Travel | Driving dorian loop (D dorian), bass arpeggio in eighths, lead over it, kick and hat | 144 |
| narration | Arrival, before the vote | Low drone on the root, a sparse minor motif every two bars, no drums | 80 |
| vote | Vote open | Tense minor loop (A minor, i VI III VII), bass on eighths, snare on 2 and 4, a pulsing triangle arpeggio | 150, then 170 under 10 s, 185 under 3 s |
| locked | Vote locked, call-outs | A held minor pad and a kick every beat, nothing else: the room waits | 100 |
| strike | The special attack plays | Kick on every beat and a two-note bass stab; the hits are the music | 160 |
| debrief | Debrief | Calm major loop (F major), triangle arpeggio, soft bass, no drums | 100 |
| endingWon | An option's ending | 6/8 fanfare loop, major, pulse lead in triplet eighths over bass and kick | 132 |
| endingHolds | The Deadlock holds | Slow minor loop, low square bass, triangle pad, no drums | 72 |
| leaderboard | Leaderboard | The lobby theme a fourth up and faster | 140 |

Tension in the vote theme comes in three levels from the clock: 0 above 10 s, 1 at 10 s or under (tempo 170, a ticking pulse lead on every eighth joins), 2 at 3 s or under (tempo 185, the lead an octave up, and a one-bar riser: a saw-like pulse sliding up two octaves). The level only ever rises within a vote; a reopen puts it back to 0.

Every theme loops seamlessly. A theme change happens at the next beat boundary, not mid-note, so switches land in time; a change to the same theme does nothing.

### 3.3 Effects

Short, synthesised, one to four notes each. The list and what fires them:

| Effect | Fires on | Sound |
|---|---|---|
| join | A new avatar drops into the lobby | Two rising pulse blips (E5 G5), 60 ms each. In a burst of joins the blips step up a note each, and at most one plays per 120 ms |
| exhibit | An exhibit is picked up on the road | Coin: B5 then E6, pulse, 50 ms and 120 ms |
| gate | The party reaches the gate | A low square thud with a short noise, then a rising triangle note |
| voteOpen | The vote opens | Three ascending pulse notes (C5 E5 G5), 70 ms each |
| tick | Each whole second from 10 s down to 1 s | One high short pulse (C6, 40 ms); from 3 s down, two per second (C6 and E6) |
| lock | The vote locks | A square thud (A2, 120 ms) with a snare |
| callout | A call-out lands | Three-note pulse fanfare (G4 C5 E5) |
| rallyYes | Judged convincing | Ascending pulse arpeggio (C5 E5 G5 C6), 60 ms each |
| rallyNo | Judged not convincing | Two descending triangle notes (E4 C4), 120 ms each |
| hit | Each strike number lands | A noise burst with a square note whose pitch drops over 90 ms; bigger damage, lower and longer (per-option numbers are small hits, the total is the big one) |
| strikeEnd | The strike's drain finishes | A pulse chord (C4 E4 G4) 300 ms, with a kick |
| endingWon | The ending names an option | Major fanfare, five pulse notes rising, 1.2 s |
| endingHolds | The Deadlock holds | Two low square notes falling (A2 F2), 1 s |
| menuOpen, menuClose | The menu opens or closes | One soft triangle blip, up for open (A4), down for close (E4) |
| soundOn | Sound turned on | The join blip, once |

No effect for every vote cast (sixty phones would make noise all through the vote), none for footsteps, none for the clock above 10 s.

### 3.4 Controls

- S toggles sound. A toast says "Sound off" or "Sound on" for 1.5 s. The menu's Actions row gains a fourth item, "Sound off" or "Sound on" by the current state, which toggles without asking twice.
- The choice is kept in localStorage (`olkaria.sound`, "on" or "off"); on is the default.
- Browsers only let a page play after the person has touched it. The audio context is created on the first key press or click on the host page, and the theme for the current phase starts then. Until that moment the game is silent and nothing waits for it. The runbook already says to click once on the game before class.

## 4. Where it lives

- `host/audio/score.ts`: pure. Note names to frequencies, the step notation, the themes as data, `stepsBetween(theme, fromBeat, toBeat, tension)` returning the note events in a beat window, `tensionFor(remainingMs)`.
- `host/audio/sfx.ts`: pure. The effects as data: steps of `{ at, wave, hz, hzTo?, ms, gain }`, plus `hitFor(damage)` and the join-burst pitch step.
- `host/audio/chip.ts`: the Web Audio side. Builds voices, schedules a theme's steps 120 ms ahead on a 40 ms timer against `AudioContext.currentTime`, plays an effect's steps now, ducks the music under hits, switches themes on the beat. Takes an `AudioContext` so a test can hand it a fake.
- `host/audio/sound.ts`: the facade the scenes use from the registry under `sound`: `music(theme)`, `tension(level)`, `sfx(name)`, `toggle()`, `enabled`. Owns the lazy context, the first-gesture unlock, the stored choice and the join-burst limiter. Every method is a no-op while sound is off or the context does not exist.
- Hooks: Lobby (theme, join), Travel (theme, exhibit, gate), Battle (narration, voteOpen, vote with tension from its clock, tick, lock, callout, rally, strike with a hit per number and strikeEnd, debrief), Ending (stinger and theme by outcome), Leaderboard (theme), menu (open and close, the Sound item), hotkeys (S), main.ts (registry).
- `host/hud/Hud.ts`: the KEYS row for S.
- RUNBOOK: the S key, the menu item, "click once on the game so the music starts", and a line under "If something breaks" for a silent projector (the laptop's output, the browser's autoplay rule, S).

## 5. Left to the builder

The exact melodies within the keys, progressions and feels above; envelope times; the look-ahead constants if 120 ms and 40 ms stutter on the projector laptop. The composer's test is the browser: each theme loops without a click at the seam, the vote tightens audibly at 10 s and 3 s, and no effect clips.
