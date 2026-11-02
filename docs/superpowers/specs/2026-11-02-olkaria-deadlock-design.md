# Olkaria: the Deadlock. Design for the BUSI611 case engagement game

Date: 2 November 2026. Status: draft for Caleb's review.

Case source: "Should Microsoft Build Its US$1 Billion Data Centre in Kenya?" (BUSI611 case write-up by Caleb, Sarah, Anabelle, Prathiti and Adithi, November 2026), file `~/Downloads/BUSI611 Case Planning.pdf`. Every fact, figure and quote in the game content comes from that document. Section and exhibit numbers below refer to it.

Assignment source: the Canvas case project brief (pasted into `~/Desktop/BUSI611/BUSI611 Module 3 - Sessions 16-20 (Canvas).md`). The group leads a 30 to 35 minute in-class case discussion. The rubric gives 4 points for facilitation (substantive, well paced, thoughtful questions, broad participation, competing views, ends at a clear decision point) and 1 point for creativity and interactivity (at least one interactive element; close by asking the class what the company should do and why).

## 1. Intent

This game is the interactive element and, if the team wants, the spine of the whole 30 minutes.

The class plays as Microsoft's deal team. The opponent is the Deadlock: the stall that has frozen the project since May 2026. It has three heads, matching the three constraints in the case's central question: electricity supply, public finances, and current demand. Each head is a decision round. Students scan a QR code, enter their name, get four options on their phone, and vote. The votes become a combined attack by the party. The attack's strength reflects how well the chosen move fits the evidence in the case. Before the party strikes, the facilitators can call out a random voter by name to defend their choice aloud; a convincing defence adds a bonus strike. The fourth round is the decision itself, and the class's majority picks the ending.

Why Microsoft is the party. The rubric requires the company to be the primary decision-maker. Sections 3 and 7 and all three discussion questions are written from Microsoft's side. Microsoft and G42 hold the decision rights, and Microsoft has the balance sheet (section 3.3). The Kenyan government has the strongest counter-stake, so its constraints become the boss's heads, but Kenya is not the enemy. Kenyan officials appear as characters: Principal Secretary Tanui's line that the project is "not failed or withdrawn" but "requires some structuring" is the quest hook. The Treasury's refusal is a locked gate the party must find another route around, not a monster to kill. This matters in a global development class and it matters for the rubric's "competing views".

## 2. Goals, non-goals, anti-goals

Goals

- Every student votes four times from their own phone with no app install and no account.
- Every round gives the facilitator at least one cold call: a named student defends their vote aloud before the attack lands, so participation is broad and not only the usual hands.
- Each round ends on a debrief screen that gives the facilitator 3 to 5 minutes of structured discussion material: the class split, the damage each option did, and the case fact behind each number.
- The final screen is the class's answer to "what should Microsoft do and why", which is how the rubric says to close.
- Runs on the classroom projector from a deployed URL. Survives a Wi-Fi or server failure through a manual mode driven from the keyboard.
- The team can change every word of content, every score and every citation without touching game code.

Non-goals

- Not a general quiz platform. One case, one room at a time, no persistence beyond the session.
- Not a full platformer. Travel segments are 20 to 30 seconds and skippable.
- Not a grading tool. The leaderboard is for fun.

Anti-goals (a failure even if everything runs)

- Framing Kenya or Kenyans as the villain.
- A hidden right answer on the final decision. The brief says the central question must have no implied right answer. The final round scores conviction and coherence, never correctness.
- Thirty minutes of watching animations. No non-skippable sequence longer than 8 seconds.
- Vibecode UI. The anti-vibecode skill applies to the phone page and the host HUD.

## 3. The experience

### 3.1 Run of show, game as spine (32 minutes)

| Min | Beat | On the projector | Facilitator |
|---|---|---|---|
| 0 to 3 | Lobby | QR code, room code, join URL, join count, pixel avatars dropping in | "Scan to join. You are Microsoft's deal team." Two-sentence recap of the central question. |
| 3 to 4 | Travel 1 | Party runs from Nairobi toward Olkaria; three exhibit pickups | Reads each exhibit fact as it pops. |
| 4 to 10 | Round 1, Grid Wyrm | Narration, four options, 30 s timer, call-out, attack, debrief | Call-out first (1 min, one or two students defend their vote), then 3 min: "Why did holding the 1 GW plan do so little damage?" |
| 10 to 11 | Travel 2 | Rift Valley to the Treasury | |
| 11 to 17 | Round 2, Debt Golem | Same shape | Discussion question 3: who should carry the demand risk. |
| 17 to 18 | Travel 3 | Into the Fog | |
| 18 to 24 | Round 3, Fog of Demand | Same shape | Discussion question 2: when is early too early. |
| 24 to 25 | Travel 4 (short) | The Deadlock's core | |
| 25 to 30 | Round 4, the Decision | Four options, vote, synergy reveal, ending | Discussion question 1. "What would need to be true for a different option to win?" |
| 30 to 32 | Leaderboard and close | Top 5, most consistent strategist, the class split | Closes on the class's decision and why. |

Alternative: game as a 12-minute segment. Same four rounds with about a minute of discussion each; slides take the rest of the slot. The host advances everything manually, so one build serves both.

### 3.2 Host screens (projector)

- Lobby. QR code at least a quarter of the screen height, the room code in large type, the join URL in text under it, "N joined", and a pixel avatar for each joiner dropping onto the Nairobi skyline with their name. Brad Smith's quote sits under the title; PS Tanui's "not failed or withdrawn … requires some structuring" is the quest hook at the bottom. Space starts the game.
- Travel. Side-scrolling platform segment. The presenter controls the lead party member; three followers trail. Three exhibit pickups per segment. Reaching the arena gate starts the round.
- Battle. Boss sprite with the current phase's HP segment and a thin total bar; a narration box (the situation); four option cards with letter, shape and colour; the timer; "23 of 41 voted". The distribution stays hidden until lock, as in Kahoot. After lock: four bars, then the call-out. The facilitator presses C and the game picks a random voter: a banner shows "Sarah, defend B: Start small, 24 to 60 MW" and the party member who proposed that option steps forward. The student explains; the facilitator presses Y (convincing, bonus strike) or N (no bonus). Up to two call-outs per round. Then the four party members strike with sizes proportional to vote share, any rally strikes land last with the student's name on them, damage numbers float, the HP drains. Then the debrief panel: per option, damage dealt and one projector line (section 5.7) with citation, plus a "Discuss" line. The full debrief text goes to each phone for the option its owner chose, and to the facilitator notes in the runbook.

Text on the projector is an HTML layer over the game canvas, not canvas text (section 7), so narration, option cards, the call-out banner, the debrief and the QR are crisp at native resolution and wrap properly.
- Ending. One of five cutscenes (section 4.6) with the class split, "what must be true" and "the risk you accepted".
- Leaderboard. Top 5 by points, "most consistent strategist", and the round 4 split one more time for the closing question.

### 3.3 Player screens (phone)

Join (name required, up to 16 characters; it is the name the class will hear), Waiting ("You're in. Watch the screen."), Vote (four large buttons: letter, shape, short label; countdown), Locked in ("Locked: B. Start small, 24 to 60 MW."), Called out ("You're up. Defend B: Start small, 24 to 60 MW." with the phone vibrating once where supported), Someone else called out ("Sarah is defending B."), Round result (points this round, running total, rank, and the full debrief for the option you chose, so the case fact behind your score is in your hand), Ending summary (your four picks, your synergy count, your rank). A kicked player sees a plain message; a dropped connection shows "Reconnecting".

## 4. Game design

### 4.1 The party: Microsoft's deal team

Four members, one per Kahoot-style button. Each round, each option is proposed by one member, so the class sees the debate inside Microsoft, and the attack shows four strikes sized by vote share. The member-to-option mapping is set per round in content and is flavour, not a rule.

Colour belongs to the letter, never to the member: A is always red, B blue, C yellow, D green, on phones, on the projector's option cards and bars, and on the call-out banner, so a student can match their phone to the screen at a glance. Party sprites are not colour-coded; the proposing member's name appears as a small tag on the card ("The Envoy"). The striker for an option is the member who proposed it, or, when no member is set (round 4), the member whose default button carries that letter. During a strike the striker flashes in the option's colour.

| Button | Member | Class | Lens |
|---|---|---|---|
| A, red triangle | The Engineer | Artificer | power, latency, the site |
| B, blue diamond | The Treasurer | Paladin | capital at risk, returns, fixed costs |
| C, yellow circle | The Envoy | Bard | the Kenyan government, G42, PPP law |
| D, green square | The Scout | Ranger | competitors, timing, other markets |

### 4.2 The boss: the Deadlock

Four phases of 100 HP each, 400 in total.

1. Grid Wyrm (electricity supply). A serpent whose body is a chain of transmission pylons.
2. Debt Golem (public finances). Stacked blocks carved with 68% and 48.5%.
3. Fog of Demand (demand and competitors). A cloud of particles with floating, contradictory numbers (97.5%, 8.7%, 20 MW).
4. The core (the decision). The Deadlock's exposed centre.

### 4.3 Shape of a round

1. Narration box: the situation in two to four sentences with one quote from the case. The facilitator reads it aloud or lets the class read.
2. Four options on screen (full text) and on phones (short label). 30-second timer, join count. Space locks early; the timer locks automatically.
3. Lock: distribution bars appear. Call-out: C picks a random student who voted this round and shows their name and choice; they defend it aloud; Y awards a rally strike, N does not. Up to two per round. The facilitator can skip this step entirely.
4. Reveal: the four members strike, then any rally strikes land. Each contribution appears next to its strike.
5. Debrief panel: for each option, the damage it dealt and a one-line case fact with citation. "Discuss" line at the bottom. Space moves on.

### 4.4 Scoring

Each option in a round has an effective score from 0 to 100.

- Evidence rounds (1 to 3): the effective score is the evidence score set in content (section 5), a judgement of how well the case's own evidence supports the move.
- Decision round (4): effective score = 50 + 15 × synergy hits, where a synergy hit is an earlier round whose class majority is listed as coherent with this option (table in section 5.4). Maximum 95.

Damage for a round:

- base = Σ over options of (vote share × effective score)
- focus bonus = +15 if the top option holds at least 60% of the votes, else 0
- exhibit bonus = +5 per exhibit collected in the preceding travel segment, maximum 3 (+15)
- rally bonus = +10 per call-out the facilitator judges convincing, maximum 2 per round (+20)
- damage = round(base + focus + exhibit + rally), clamped to 0 to 100

Majority of a round = the option with the most votes. On a tie, the earliest letter wins and the round is flagged tied (no focus bonus is possible on a tie anyway).

Ending = the majority option of round 4, in a tier set by total damage over the four rounds (max 400): decisive at 260 or more, fragile from 180 to 259. Below 180 the Deadlock holds and its own ending plays (section 4.6).

Student points per round = effective score of their option + speed bonus, where speed bonus = round(20 × (1 − response time ÷ vote window)), clamped to 0 to 20. A called-out student also earns 10 points for speaking, or 30 if the party awards the rally strike. "Most consistent strategist" goes to the player whose own four picks produce the most synergy hits for their own round 4 pick, ties broken by total points.

Worked example, round 1 with 40 voters: A 4, B 24, C 4, D 8. Shares 0.10, 0.60, 0.10, 0.20. Base = 0.1 × 60 + 0.6 × 85 + 0.1 × 20 + 0.2 × 35 = 66. Focus +15 (B at 60%). Two exhibits, +10. Damage 91. One convincing call-out on top caps the round at 100. An evenly split class (10 each) does 50 with no focus bonus. A class that converges on the weakest option does about 35.

Worked example, round 4 with prior majorities B, D, B and a final tally A 5, B 25, C 5, D 5. Synergy hits: A 0 (score 50), B 3 (95), C 1 (65), D 2 (80). Base = 0.125 × 50 + 0.625 × 95 + 0.125 × 65 + 0.125 × 80 = 83.75. Focus +15. Damage 99.

Why this shape: evidence rounds reward reading the case; the focus bonus rewards a class that commits, which is what a deal team has to do; the rally bonus rewards a student who can argue the choice out loud, which is the facilitation rubric's "broad participation" in game form; the decision round rewards a strategy that hangs together across rounds, which is discussion question 1's "what would need to be true". The scores are visible after each round, so the mechanism is also the teaching.

### 4.5 Travel and exhibits

Short side-scrolling platform segments between rounds. Controls: arrow keys to move and jump (Space also jumps), A to auto-run along a baked path (the safe option on stage), N to skip straight to the arena. Three exhibit pickups per segment. Each is a case figure that pops as a toast for 4 seconds and adds +5 to the next round's damage. The pickups for each segment are set in content; defaults in section 5.5.

### 4.6 Endings

- A, "Olkaria Colossus". Must be true: Microsoft takes a larger share of the investment if G42 turns cautious; dedicated geothermal generation separate from the main grid; demand grows into 1 GW over a long payback. Risk accepted: stranded assets and public opposition over power (section 7, Exhibit 10).
- B, "The Seed Plant". Must be true: KenGen or a commercial anchor signs a smaller commitment; 24 to 60 MW fills within a few years; the expansion option stays open. Risk accepted: weak early returns; competitors build larger facilities first.
- C, "The Long Road South". Must be true: Kenyan demand stays small enough that waiting costs little; the G42 and Kenyan relationships survive the pause. Risk accepted: Oracle, Huawei and Nxtra take the market; the deal lapses.
- D, "The Tenant". Must be true: G42 is willing to own the asset risk; Kenya still delivers power and land; Azure demand fills the capacity Microsoft rents. Risk accepted: the demand risk is moved, not solved; G42's goals diverge from Microsoft's.
- X, "The Deadlock holds". Plays when total damage is under 180. "Your board sends the team back to Nairobi." The screen lists, for each earlier round, the class's majority next to what the final option needed, so the inconsistency is the lesson.

Each ending shows the round 4 split, which is the slide the facilitator closes on.

## 5. Content: the decisions in Microsoft's eyes

These are the answers the game encodes. Evidence scores are judgements made from the case document alone; the team should agree with them before class, and can change them in `content/case.json` without touching code. The phone label is what students see on their screens; the screen text is the full option on the projector.

### 5.1 Round 1, Grid Wyrm: how does Microsoft get its power?

Narration. "Olkaria steam fields, 2026. The Grid Wyrm coils around the geothermal plants that generate about 950 MW. Kenya's whole grid has about 3,192 MW installed against a record peak of 2,444 MW. President Ruto: 'to switch on that one data center, we would need to shut off power for half the country.' The 1 GW plan would take about 31% of installed capacity. How does Microsoft get its power?"

A. The Engineer. Screen: "Dedicated geothermal. Pay KenGen to develop new Olkaria capacity ring-fenced for the site, off the household grid." Phone: "Build our own geothermal". Score 60.
Debrief: "Geothermal is 24-hour baseload and Kenya has the world's highest share of it (section 4.1). But new generation takes years, and Olkaria expansion displaced hundreds of Maasai families (Krebs, 2022; World Bank Inspection Panel, 2015). Strong on power, weak on time and social licence."

B. The Treasurer. Screen: "Shrink phase one to 24 to 60 MW, in line with the EcoCloud talks, and expand only as new generation comes online." Phone: "Start small, 24 to 60 MW". Score 85.
Debrief: "100 MW is about 4% of peak demand and a tenth of Olkaria's output; 1 GW is about 41% of record peak (Exhibit 2). Talks on a 60 MW facility with EcoCloud are already under way (Vimal, 2026). This is the move the grid can take today."

C. The Envoy. Screen: "Hold the 1 GW plan and lean on Kenya's pledge of 10,000 MW of new generation within about seven years." Phone: "Hold 1 GW, trust 10 GW plan". Score 20.
Debrief: "The 10,000 MW target was announced in November 2025 with a 2032 horizon (Kizito, 2025; The Star, 2026). Kenya's record on flagship projects is mixed; Konza progressed slowly and in phases (Exhibit 6). Some transmission lines already run above 120% of design capacity (The Analyst, 2026a). Building ahead of generation is what caused the stall."

D. The Scout. Screen: "Put the capacity in South Africa, where Microsoft just committed another US$329 million, and serve East Africa from there." Phone: "Move it to South Africa". Score 35.
Debrief: "It avoids Kenya's grid, but South Africa's grid is unstable and coal-heavy (Exhibit 7), inference has to sit close to users (Direct LTx, n.d.), and Oracle's Nairobi region through iXAfrica is already announced (iXAfrica Data Centres, 2026). This is Option 3 wearing a power hat."

Microsoft's view. The grid problem is a sizing problem. Everything in section 4.1 says the grid can carry 60 to 100 MW and cannot carry 1 GW. Dedicated generation is the long-run answer but not a 2026 answer. The evidence path is B now, with A as the expansion route.

### 5.2 Round 2, Debt Golem: who should carry the demand risk?

Narration. "Nairobi, outside the Treasury. The Debt Golem is built from the numbers: public debt about 68% of GDP, debt service taking 48.5% of ordinary revenue, the IMF asking that commitments like an anchor-tenant guarantee be counted as debt. In June 2024, protests over the Finance Bill left people dead and the bill withdrawn. In September 2026 the High Court ruled that PPP liabilities need Parliament's approval. The Treasury has said no. A data centre is largely fixed cost, so someone has to carry the demand risk. Who?"

A. The Envoy. Screen: "Kenya's Treasury. Keep pressing for the anchor-tenant guarantee, sweetened with the skills lab and training pledges." Phone: "Kenya's Treasury guarantees". Score 10.
Debrief: "The Treasury already declined the ICT ministry's proposal (Semafor, 2026; The Analyst, 2026a). PS Tanui said Kenya cannot guarantee procurement controlled by market forces or by other governments (Musau, 2026). The sweetener is weaker since the Nairobi development centre closure (Namunwa, 2026). Elections come in 2027."

B. The Engineer. Screen: "KenGen. A smaller purchase commitment signed by the state generator, kept off the national balance sheet." Phone: "KenGen signs, not Treasury". Score 60.
Debrief: "A compromise actually under discussion (The Analyst, 2026b). KenGen would gain a large long-term customer (KenGen, 2025). But the state still ultimately stands behind KenGen, the IMF may still count it, and it answers power offtake more than cloud demand."

C. The Treasurer. Screen: "G42. Let G42 fund and own the facility; Microsoft becomes an anchor tenant and pays for the capacity it uses." Phone: "G42 owns it, we rent". Score 55.
Debrief: "One of the compromises discussed (Steffens Herrera, 2026). G42 is backed by Mubadala and Silver Lake, and Microsoft holds a US$1.5 billion stake and a board seat (AGBI, 2024). It cuts Microsoft's capital at risk, but G42 has its own goals and may turn cautious (sections 3.4 and 7). The risk moves; it does not shrink."

D. The Scout. Screen: "Microsoft itself. Build small on spec with no sovereign guarantee and win commercial anchors (Safaricom, banks, ministries under the Cloud Policy) as it goes." Phone: "We carry it, build small". Score 70.
Debrief: "US$1 billion is about 0.6% of fiscal 2027 capital spending and 2.7% of one quarter's net income (Exhibit 4), and Microsoft's own share is smaller. At 24 to 60 MW the exposure is small. The Cloud Policy and data-localisation rules raise local demand (section 4.4). The counterweight: investors punished capital spending in January 2026 (GeekWire, 2026b), and Microsoft wants predictable demand before it builds (Vimal, 2026). This is the only option that needs no signature Kenya cannot currently give."

Microsoft's view. Risk should sit with whoever can bear it and manage it. Kenya can do neither: the fiscal numbers rule out bearing it, and Tanui's point that demand is set by markets and other governments rules out managing it. Microsoft and G42 can bear it at the scale of a small first phase. Three live options (B, C, D) and one dead one (A). The debrief should say so; the facilitator's question is which of the three live ones the class trusts and why.

### 5.3 Round 3, Fog of Demand: when is early too early?

Narration. "The Fog. Kenya's entire data-centre market is about 20 MW; iXAfrica's flagship runs 4.5 MW of IT load. Phase one alone would be five times the market, the full build fifty times. One survey says 97.5% of online Kenyans used an AI tool last month, the highest of 54 countries. Microsoft's own measure says 8.7% of the population. Oracle, Huawei and Nxtra are building. When is early an advantage, and when is it too early?"

A. The Scout. Screen: "Early is right. Build for the 2031 market (US$805 million, three quarters of new East African capacity) and lock in the hub before Oracle, Huawei and Nxtra do." Phone: "Go early, win the hub". Score 50.
Debrief: "First-mover logic is real: Oracle's region through iXAfrica (January 2026), Nxtra's 44 MW at Tatu City, Huawei's 100-plus clients, AWS's further US$1.5 billion (section 3.2). But even the 2031 market of US$805 million is below the project's US$1 billion headline (section 4.2). Webvan built ahead of the infrastructure and habits it needed (section 7)."

B. The Treasurer. Screen: "Too early for 1 GW. Size phase one to what the market can fill in about three years, 24 to 60 MW, and keep the expansion option." Phone: "Right-size to today's 20 MW". Score 80.
Debrief: "20 MW of market today; 36.3% of households online and 7.0% with fixed internet (section 4.2). Instacart succeeded where Webvan failed because the enabling infrastructure had arrived (section 7). A staged build is how to be early without being too early."

C. The Envoy. Screen: "Demand will come from the state. Data-localisation rules, the Cloud Policy and the AI Strategy push public workloads on-shore; sign ministry MoUs first." Phone: "Government workloads first". Score 40.
Debrief: "The policies exist and do raise demand for a local region (section 4.4). But implementation is uneven, the AI strategy has no 2026/27 budget line, there is no data-centre regulatory framework, and the US trade report says tenders are often influenced by political connections (USTR, 2026). It also rebuilds the dependence on the public purse the Treasury just refused."

D. The Engineer. Screen: "Trust the 97.5%. Kenya has the world's highest AI usage, inference must sit near users, so build now." Phone: "Build for 97.5% AI usage". Score 25.
Debrief: "97.5% is of online Kenyans, who are 40.5% of the population; Microsoft's own measure is 8.7% of all Kenyans (Whitehead, 2026). 77.5 million mobile connections is 134% of the population, which counts SIMs, not data-centre load (section 3.2). Proximity matters for inference (Direct LTx, n.d.), but it does not size the plant."

Microsoft's view. The headline demand signals are the wrong denominator. The right one is paying load: 20 MW today, a market worth less than the project even in 2031. Early entry is an advantage when the enabling infrastructure exists (Instacart) and a trap when it does not (Webvan). Staged capacity is the real option that captures the upside without betting on the fog.

### 5.4 Round 4, the Decision: what should Microsoft do?

Narration. "The Deadlock's core is exposed. Kenya's Treasury will not guarantee demand. The Nairobi development centre is closing. Competitors are building. Microsoft must decide how much risk to take, and when. What should Microsoft do?"

A. Screen: "Proceed with the full 1 GW build, taking a larger stake and securing dedicated generation." Phone: "Full 1 GW build".
B. Screen: "Build a 24 to 60 MW facility now and expand in stages as contracts and power arrive." Phone: "Build small, expand later".
C. Screen: "Pause Kenya. Put the capital into South Africa and return when power, finances and demand improve." Phone: "Wait, invest elsewhere".
D. Screen: "Become the tenant. G42 and local partners build and own; Microsoft anchors it with Azure capacity." Phone: "G42 builds, Microsoft rents".

No evidence scores. Synergy table (earlier-round majorities coherent with each final option):

| Final option | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| A, full build | A, C | A, C | A, D |
| B, build small | B | B, D | B |
| C, wait | D | A | B |
| D, tenant | A, B | C | A, B |

Debrief for round 4 is the ending cutscene (section 4.6). The facilitator's closing question is the rubric's: what should Microsoft do, and why.

Microsoft's view, for the facilitator only (never shown as a right answer). If the class follows the evidence in rounds 1 to 3, the coherent decision is B, possibly structured as D. The case's own Decision section says every option has significant drawbacks; the point of round 4 is that the class owns the trade-off it picks and can say what must be true for it to work.

### 5.5 Exhibit pickups (travel segments)

Three per segment, each worth +5 damage in the next round. Shown as a toast with the figure and source.

- Travel 1 (before round 1): "Olkaria generates about 950 MW (James, 2026)"; "Record peak demand 2,444 MW, January 2026 (James, 2026)"; "1 GW = about 31% of installed capacity (Exhibit 2)".
- Travel 2 (before round 2): "Public debt about 68% of GDP, June 2025 (Ecofin Agency, 2025)"; "48.5% of ordinary revenue goes to debt service (People Daily, 2025)"; "PPP liabilities need Parliament's approval, September 2026 (Capital FM, 2026)".
- Travel 3 (before round 3): "Kenya's data-centre market is about 20 MW (The Analyst, 2026b)"; "Market worth US$266 million in 2025, US$805 million by 2031 (Semafor, 2026)"; "97.5% of online Kenyans vs 8.7% of all Kenyans used AI (Whitehead, 2026)".
- Travel 4 (before round 4): "US$1 billion is 0.6% of Microsoft's FY2027 capex (Exhibit 4)"; "Nairobi development centre closing, October 2026 (Namunwa, 2026)"; "Microsoft committed US$329 million more to South Africa, April 2026 (Kamau, 2026)".

### 5.7 Projector lines

The debrief panel on the projector shows one line per option (130 characters or fewer). The full debriefs in 5.1 to 5.3 go to the phones and the facilitator notes.

Round 1: A "Baseload power, but new wells take years and Olkaria expansion displaced Maasai families (Krebs, 2022)." B "100 MW is about 4% of peak demand, and 60 MW EcoCloud talks already exist (Exhibit 2; Vimal, 2026)." C "The 10 GW target lands in 2032, the flagship record is mixed, and lines already run above 120% (Exhibit 6)." D "Avoids Kenya's grid, but South Africa runs on coal, inference needs proximity, and Oracle is already in Nairobi (Exhibit 7)."

Round 2: A "The Treasury already said no; Tanui: Kenya cannot guarantee others' procurement; elections in 2027 (Semafor, 2026)." B "A compromise on the table, but the state still stands behind KenGen and the IMF may count it (The Analyst, 2026b)." C "Cuts Microsoft's capital at risk, but G42 may turn cautious; the risk moves, it does not shrink (Steffens Herrera, 2026)." D "US$1 billion is 0.6% of FY2027 capex; at 24 to 60 MW the exposure is small; needs no Kenyan signature (Exhibit 4)."

Round 3: A "Oracle, Nxtra and Huawei are moving, but even the 2031 market is under US$1 billion; Webvan built too early (4.2)." B "A 20 MW market with 36% of homes online; Instacart won where Webvan failed by waiting for the infrastructure (4.2, 7)." C "The policies raise local demand, but there is no AI budget line, no framework, and tenders are swayed by connections (USTR, 2026)." D "97.5% is of online Kenyans, who are 40% of people; Microsoft's own measure is 8.7%; SIMs are not load (Whitehead, 2026)."

### 5.6 Characters who speak

- The narrator (dungeon master) voice is the game's; the facilitator reads it.
- PS John Tanui appears in the lobby and before round 2 with his quote: the project is "not failed or withdrawn" but its scale "requires some structuring" (James, 2026; Vimal, 2026).
- President Ruto's "shut off power for half the country" (Semafor, 2026) is the Grid Wyrm's taunt.
- Brad Smith's "single biggest step to advance the availability of digital technology" (Vimal, 2026) opens the lobby.

## 6. Technical design

### 6.1 Shape

One repository, `~/olkaria`, TypeScript throughout.

- `host/`: the projector game. Phaser 3 with Vite for the world layer (boss, party, platforms, HP bar); an HTML layer over the canvas for everything textual (narration, option cards, banner, debrief, QR, toasts, key map). Scenes: Boot, Lobby, Travel, Battle, Ending, Leaderboard. A router starts the right scene for the saved phase and round when the host page loads or reconnects.
- `player/`: the phone page. Plain TypeScript and CSS, no framework. Nine states (section 3.3) plus reconnecting.
- `worker/`: a Cloudflare Worker that serves both pages as static assets and hosts a Durable Object per room over WebSockets.
- `shared/`: types, the content schema, scoring, and the room reducer. Pure functions, unit tested, used by the Durable Object (authoritative) and by the host's offline mode.
- `content/case.json`: everything in section 5 plus endings, party members, exhibit pickups and the synergy table. Validated by a schema test.

Why this stack. Phaser 3 is the standard browser engine for pixel platformers and has a pixel-art render mode and arcade physics. Cloudflare Workers with Durable Objects gives one deploy, one URL, server-side vote tallies that survive a host reload, and no idle-pause problem; the free plan includes SQLite-backed Durable Objects. Caleb already has a Worker deployed (spark-bot) and a Cloudflare account. The alternative, Supabase Realtime, needs less server code but Caleb's free-tier projects pause when idle, which is the wrong failure mode for a one-shot class slot.

### 6.2 Room state machine (authoritative, in `shared/room-logic.ts`)

Phases: `lobby`, `travel`, `vote`, `locked`, `reveal`, `ending`, `leaderboard`. Round index runs 0 to 3; it is -1 in the lobby.

Transitions

- `lobby` → `travel` on host `start` (round becomes 0).
- `travel` → `vote` on host `openVote` with a window in seconds (default 30). Sets the deadline and schedules an alarm.
- `vote` → `locked` on host `closeVote` or when the alarm fires at the deadline.
- In `locked`, host `callout` picks a random player who voted this round and has not been called this round (the command carries the random number so the reducer stays pure), and records a pending call-out; at most 2 per round; when no player is eligible (offline mode, or nobody voted) the call-out is recorded with no player so the facilitator can still cold-call by hand. Host `judge` with awarded true or false resolves the pending call-out and sets the called player's call-out points (30 awarded, 10 declined). `callout` while one is pending, or outside `locked`, is an error.
- `locked` → `reveal` on host `reveal`. Computes the round's damage from the tally and the awarded call-outs, applies it to the boss, awards points (vote points plus any call-out points), records the majority. A still-pending call-out is treated as declined.
- `reveal` → `travel` (round + 1) on host `next` while round < 3; `reveal` → `ending` after round 3.
- `ending` → `leaderboard` on host `next`.
- `locked` → `vote` on host `reopen`, with a fresh deadline of now plus the window; existing votes stand and the original opening time stays, so earlier voters keep their speed bonus. In `vote`, `reopen` extends the deadline to now plus the window. In any other phase it is an error; a reveal is final.
- Any phase → `lobby` on host `reset` (players kept, scores and tallies cleared).
- Host `exhibit` during `travel` adds a pickup for the current round (max 3).
- Host `injectVotes` during `vote` or `locked` adds synthetic votes to the current round's tally (manual mode and bots). Synthetic voters never appear in the player list or the leaderboard.
- Host `kick` removes a player.

Player events

- `join` with a client id and a name. A repeat `join` with a known client id is a rejoin and keeps name, votes and score. Names are trimmed, stripped of control characters, cut to 16 characters. The phone requires a name before it will join; if an empty name still arrives, the server gives a generated one (two words from a Kenya and geothermal word list, for example "Steam Gecko") so the room never shows a blank.
- `vote` with round and option. Rejected unless the phase is `vote`, the round is the current one, the player exists and has not voted this round. The first vote locks; there is no changing an answer.

The reducer signature is `reduce(state, event, content) → { state, effects }`, where effects are `setAlarm`, `clearAlarm` or `error`. The Durable Object runs the effects. The host's offline mode ignores alarms and uses a timer.

### 6.3 Transport (Cloudflare Worker and Durable Object)

- `POST /api/rooms` creates a room: a 4-letter code from A to Z without I and O, and a random host key. Returns `{ code, hostKey, joinUrl }`.
- `GET /ws/:code?role=host&key=…` and `GET /ws/:code?role=player&clientId=…` upgrade to WebSockets handled by the room's Durable Object (WebSocket hibernation API, tagged by role and client id).
- The Durable Object stores the state after every reduce, broadcasts a host view to the host and a per-player view to each player after every change, and uses a storage alarm for the vote deadline. Rooms self-delete after 6 hours of silence.
- `GET /j/:code` serves the player page; `GET /` redirects to `/host/`. Everything else is static assets from the Vite build.
- Host commands carry the host key. Player messages carry the client id. No other auth.

Views. The host view is the full state minus the host key. The player view has: phase, round, the player's own vote this round and their picks for every round so far, points for the last round, running score, rank, player count, server time (for the countdown), the pending call-out (name, option, and whether it is this player), and the tally only once the phase is `reveal` or later.

Reconnect. The host page remembers its room for the tab. On load or reconnect it reads the saved phase and round and starts the matching scene: `lobby` the Lobby; `travel` the start of that travel segment (N skips it); `vote` and `locked` the Battle at that state; `reveal` the Battle's debrief directly, without replaying the strike; `ending` and `leaderboard` those screens.

### 6.4 Offline and manual mode

The host page opened with `?mode=offline` never touches the network. It runs the same reducer in the browser. Keys 1 to 4 add one vote each to the current round, Shift+1 to Shift+4 add ten, B adds 30 random bot votes weighted toward the strongest option, and every other key works as it does online. This is the rehearsal mode and the plan B if the room's Wi-Fi fails: the facilitator counts hands and types the tallies. The same keys also work in online mode (they call `injectVotes`), so a half-working room can be topped up by hand.

### 6.5 Host keyboard

Space: advance (start, lock, reveal, next). C: call out a random voter (locked phase only). Y or N: judge the pending call-out, convincing or not. R: reopen a locked vote, or extend an open one (those two phases only). Arrow keys and Space in travel: move and jump. A: auto-run. N in travel: skip to the arena. H: hide player names on the projector (the call-out banner still shows the called student's name, since that is the point). F: fullscreen. Esc: show the key map. 1 to 4, Shift+1 to Shift+4, B: tallies (section 6.4).

### 6.6 Content file

`content/case.json` holds: party members (id, name, class, lens, colour, shape), four rounds (id `grid`, `debt`, `fog`, `core`; boss name; narration; options with letter, member, screen text, phone label, evidence score or null, full debrief, projector line, and the round's discuss line), the synergy table, five endings (title, must-be-true bullets, risk bullets, holds listing), four exhibit sets, the quotes in section 5.6, and the scoring constants (round HP, focus threshold and bonus, exhibit bonus and cap, call-out bonus, cap and points, decision base, synergy bonus, speed bonus cap, vote window, ending tiers). A test validates the schema and the invariants: four rounds, four options each, evidence scores on rounds 1 to 3 only, synergy keys that exist, phone labels of 28 characters or fewer, projector lines of 130 characters or fewer, and a non-empty debrief and projector line on every option of rounds 1 to 3 (round 4 has the endings instead).

## 7. Visual direction

- World layer: virtual resolution 320 × 180, scaled by a whole-number zoom (6× at 1080p, 4× at 1366 × 768) and centred, recomputed on resize, Phaser `pixelArt` mode, no smoothing. Nothing textual is drawn on the canvas except damage numbers and the HP bar label.
- Text layer: an HTML element positioned exactly over the canvas, with a `--zoom` variable so sizes scale with the world. Minimum sizes at 1080p: 24 px for card and debrief copy, 30 px for narration, 42 px for the banner name and titles. The pixel look comes from a pixel-style web font (Pixelify Sans, OFL) for titles and labels, with body copy in the same font at the larger sizes or in a plain sans if a rehearsal from the back row says it is hard to read.
- Palette: a dusk-savanna neutral range (ochre, umber, warm greys) with one accent, geothermal teal, and steam white for highlights. Option colours (red, blue, yellow, green) are muted and appear only where they carry meaning: option cards, bars, the banner, and the striker's flash (section 4.1).
- The phone page uses a plain sans (DM Sans or system) per the anti-vibecode standard.
- Art order: build with placeholder rectangles and text first, swap in sprites last. Tiles, props and party sprites from CC0 packs (Kenney Pixel Platformer and Tiny Dungeon are the defaults). The three bosses are built procedurally from tiles and particles (pylon-chain serpent, carved block golem, number fog), which fits the theme and avoids licensing. A `CREDITS.md` lists every asset and licence.
- Sound: optional, CC0 (Kenney interface and RPG packs). Cut first if time is short.
- Phone page: anti-vibecode. Flat buttons with dim strokes, one tier, labels never wrap, generous spacing, 17 px base type, no gradients. The four option buttons use the muted option colours as fills with the letter and shape; this is the one place colour is used for meaning on that page.

## 8. Risks and rehearsal

- Classroom network. Phones and the host both use the deployed URL, so the campus Wi-Fi only has to reach the internet; students on cellular are fine. Test from the actual room or an equivalent UNC network a week before.
- Server or Wi-Fi failure mid-session: offline mode with hand counts (section 6.4). Rehearse the switch once.
- Projector and laptop: integer scaling handles any resolution; run `caffeinate` so the laptop never sleeps; fullscreen with F; close everything else.
- Join friction: the QR must be large, the code and URL printed under it, and the join page must load in under two seconds on a phone (the player bundle stays under 100 KB).
- Trolling names: names are required and will be read aloud on a call-out, which is its own deterrent; 16-character cap, H hides names on the lobby and leaderboard, kick from the host.
- Shy students: the call-out is random among voters, so no one is singled out for being wrong, and the facilitator can press N or skip the call-out entirely. The phone shows "You're up" so the student knows before their name is read.
- Timing: every sequence skippable with Space; the facilitator decides when to lock; travel can be skipped with N.
- Content disagreement: the team signs off on scores and debrief text in `content/case.json` before the case document deadline.
- Load: a script simulates 60 phones voting; run it against the deployed room before class.
- Rubric fit: the final screen asks the class what Microsoft should do and why; the facilitator must say it out loud too.

Rehearsal checklist lives in `RUNBOOK.md` in the repo: deploy, create room, five teammates join on phones, full run in 12 minutes, switch to offline mode once, full run with 60 simulated clients.

## 9. Open questions for Caleb

Most important first. The build can start under the stated defaults; these change copy or scope, not architecture.

1. Presentation date and section. The plan is ordered so the first demoable slice is early; the art pass and sound are the first cuts if the date is close.
2. Game as the spine of the 30 minutes (default) or a 12-minute segment?
3. The evidence scores in section 5. Does the team agree with them? They are the "answers" the game teaches.
4. Round 4 option D: the tenant model (default) or an open "Something else, tell us" button that scores a flat 50?
5. Which Cloudflare account hosts it: Caleb's personal account (default) or SPARK's?
6. Art: procedural bosses plus CC0 packs (default), or hand-drawn sprites if someone on the team draws?

## 10. Calls I made

- Microsoft's deal team is the party; the Deadlock with three heads is the boss; Kenya appears as characters, never as the enemy.
- Four party members map to the four buttons and voice the options each round.
- Scoring: evidence scores on rounds 1 to 3, synergy-based scores on round 4, a +15 focus bonus at 60%, +5 per exhibit, ending tiers at 260 and 180 of 400.
- Round 4's fourth option is the tenant model from section 6 of the case.
- 30-second votes; the first vote locks; late joiners can vote in later rounds.
- Call-outs (Caleb's mechanic): random among this round's voters, at most two per round, +10 damage each when judged convincing, 30 points to the student when awarded and 10 for speaking, resolved before the attack animation. Names are required at join, capped at 16 characters, shown on the call-out banner even when H hides them elsewhere.
- Host can hide names on the lobby and leaderboard and can kick.
- Phaser 3 on Vite for the host, plain TypeScript for the phone page, Cloudflare Worker plus Durable Objects for the room, content in one JSON file.
- Text lives in an HTML layer over the canvas, not in canvas text; the canvas stays at 320 × 180 with whole-number zoom. Projector debriefs are one line per option; the full debrief goes to each phone for the option its owner chose.
- Colour is bound to the letter, never to the party member. Arrow keys only in travel (A is auto-run). R reopens a locked vote or extends an open one and does nothing else; a reveal is final. A host reload resumes at the saved phase and round, and a saved `reveal` resumes at the debrief without replaying the strike.
- Offline mode and hand-count keys are in scope from the first build, not an afterthought.
- Placeholder art first, procedural bosses, CC0 packs, sound last.
