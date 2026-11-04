# Olkaria: the Deadlock. Design for the BUSI611 case engagement game

Date: 2 November 2026, revision 2 (after Caleb's answers). Status: for Caleb's review.

Case source: "Should Microsoft Build Its US$1 Billion Data Centre in Kenya?" (BUSI611 case write-up by Caleb, Sarah, Anabelle, Prathiti and Adithi, November 2026), file `~/Downloads/BUSI611 Case Planning.pdf`. Every fact, figure and quote in the game content comes from that document. Section and exhibit numbers below refer to it.

Assignment source: the Canvas case project brief (pasted into `~/Desktop/BUSI611/BUSI611 Module 3 - Sessions 16-20 (Canvas).md`). The group leads a 30 to 35 minute in-class case discussion. The rubric gives 4 points for facilitation (substantive, well paced, thoughtful questions, broad participation, competing views, ends at a clear decision point) and 1 point for creativity and interactivity (at least one interactive element such as a poll, role-play or stakeholder exercise; close by asking the class what the company should do and why).

## 1. Intent

This game is the interactive element: an 18-minute segment inside the 30 to 35 minute slot. It is a poll, a role-play and a stakeholder exercise at once.

The class forms tables of four. At each table, every student takes one stakeholder role, and each role is a character class in a dark-fantasy party: the Citizen is the Rogue, the Kenyan Government is the Knight, Local Businesses are the Bard, Microsoft (with its partner G42 folded in) is the Wizard. The party faces the Deadlock: the stall that has frozen the US$1 billion data centre since May 2026. It has three heads, matching the three constraints in the case's central question (electricity supply, public finances, current demand), and a core, the decision itself. Each head is a round. In each round one class leads a special attack, and the special attack is that stakeholder's decision: what Kenyans will accept on power, what the Government offers instead of a guarantee, what Kenya's businesses commit on demand, and finally what Microsoft does. Everyone votes on their phone; the lead class's votes carry half the attack, the rest of the party the other half; the damage reflects how well the chosen move fits the evidence in the case. Before the party strikes, the facilitators can call out a voter by name to defend their choice for a bonus strike. The class majority on the last round picks the ending.

Why this shape. The brief says the company must be the primary decision-maker, so Microsoft's decision is the last round and the closing question. The other three stakeholders each own one head of the Deadlock, which is where the case's own stakeholder map (Exhibit 8) puts the conflict. Kenya is never the villain: the Knight is a player class, and the Treasury's refusal is a locked gate the party must find a way around.

## 2. Goals, non-goals, anti-goals

Goals

- Every student picks a stakeholder role, votes four times from their phone, and sees how their stakeholder's choice landed. No app install, no account.
- Every round gives the facilitator up to four call-outs, each for an option the round has not heard yet: a named student defends their vote before the attack lands.
- Each debrief hands the facilitator the discussion material for the rest of the slot: the lead stakeholder's split against the party's split, the damage each option did, and the case fact behind each number.
- The final screen is the class's answer to "what should Microsoft do and why".
- Runs on the projector from a deployed URL and survives a network failure through a keyboard-driven manual mode.
- The team can change every word, score and citation in one JSON file.

Non-goals

- Not a general quiz platform; one case, one room, no persistence past the session.
- Not a full platformer; travel segments are 20 to 30 seconds and skippable.
- Not a grading tool.

Anti-goals

- Framing Kenya or Kenyans as the villain.
- A hidden right answer on Microsoft's decision. The brief says the central question must have no implied right answer; the final round scores conviction and coherence, never correctness.
- Watching animations; nothing non-skippable runs longer than 8 seconds.
- Vibecode UI. The anti-vibecode skill applies to the phone page and the HTML layer on the projector.

## 3. The experience

### 3.1 Run of show (18-minute segment)

| Time | Beat | On the projector | Facilitator |
|---|---|---|---|
| 0:00 to 1:30 | Lobby | QR, URL, counts per class with their figures, avatars dropping in | "Tables of four. Scan, type your name, pick your role: one of each per table." |
| 1:30 to 2:00 | Travel 1 | Party walks toward Olkaria by itself; three exhibit pickups (or N to skip) | Reads the exhibit facts as they pop. |
| 2:00 to 6:00 | Round 1, Grid Wyrm | Rogues' special attack: what Kenyans accept on power | Up to 2 min vote, locks when everyone has voted, up to four call-outs, strike, 45 s debrief |
| 6:00 to 10:00 | Round 2, Debt Golem | Knights' special attack: what the Government offers | Same shape |
| 10:00 to 14:00 | Round 3, Fog of Demand | Bards' special attack: what Kenya's businesses commit | Same shape |
| 14:00 to 17:30 | Round 4, the core | Wizards' special attack with the whole party: Microsoft's decision; ending | "What should Microsoft do, and why?" |
| 17:30 to 18:00 | Leaderboard | Top five, most consistent strategist, top table, the final split | Hands the split to the discussion that follows |

Travel 2 to 4 are skipped with N unless the segment is running early. The times assume every vote runs its full two minutes and each round has one call-out; a vote that locks early pulls them in (if every vote locks at 30 s, the table ends at 12:00) and each further call-out pushes them out. The debrief lines are built to be picked up again in the facilitated discussion after the game. Because the host advances everything manually, the same build also works as the spine of the whole slot if the team changes its mind.

### 3.2 Host screens (projector)

- Lobby. The title on two lines, "Olkaria" over "the Deadlock", with three keycaps beside it: Space "Start", M "Shows hotkeys" and ? "How to play". QR code at least a quarter of the screen height with the join address beside it, "N joined" in large type and the count per class in four class tiles, each the class figure beside its name and count ("Rogues 11, Knights 9, Bards 10, Wizards 12"), a pixel avatar of the right class per joiner dropping onto a gothic Nairobi skyline, and a list of the last eight joiners by name and class ("Ann, Knight") in the text layer. The room code and both quotes are gone from the lobby: the address ends in the code, Tanui's line opens round 2 (section 5.6) and Smith's is shown nowhere (`2026-11-03-olkaria-facilitator-menu-design.md`, section 7). Space starts the game.
- Travel. Side-scrolling platform segment through a dark-fantasy Rift Valley. The lead class of the coming round walks it by itself, the other three trailing; arrows take over, A pauses, N skips (section 4.5). Three exhibit pickups per segment. The arena gate starts the round.
- Battle. Boss with the current head's HP segment and a thin total bar; the narration (the situation and whose special attack this is); four option cards with letter, shape and colour; timer; while the vote is open, who is still to vote ("N still to vote", "Everyone has voted"), and "N of M voted" once it locks. Distribution hidden until lock. After lock: two bars per card, the lead class's split and the rest of the party's split, then the call-out banner (C), judged with Y or N, one at a time and up to four times, each for an option the round has not heard yet. Then the strike. Every number shown adds up to the damage drained: the lead class performs the special attack carrying the lead half of the base damage, flashing in the colour of its majority option; the other three classes strike together carrying the support half; then one flourish per bonus earned, each with its number ("Focus +15", "Party stands together +10", "Exhibit +5" per pickup) and one rally strike per convincing call-out with the student's name and "+10"; the HP drains by the total. When the sum passes 100 the panel says "capped at 100". When no one of the lead class voted, the special attack is skipped ("No Rogues voted this round") and the support strike carries all of the base; the mirror case skips the support strike. Then the debrief panel: per option, its damage contribution and one projector line with citation; a breakdown line ("Base 62.5, Focus 0, Party aligned +10, Exhibits +10, Rally 0. Total 83"); an alignment line in one of four forms ("The party stood with the Rogues: both chose B", "Split: Rogues chose B, the party chose A", "The Rogues were split" or "The party was split" when a group tied, "No Rogues voted this round"); the discuss line.
- Ending. One of five cutscenes (section 4.6) with the final split, "what must be true" and "the risk you accepted".
- Leaderboard. Top five students, most consistent strategist, top table, and the final split under "What should Microsoft do, and why?".

Text on the projector is an HTML layer over the game canvas, not canvas text (section 7), so it wraps and stays crisp.

### 3.3 Player screens (phone)

Join ("Join the game": Name, required, up to 16 characters; Role, required, four tiles each with the class figure, class name and stakeholder; Table, optional, up to 16 characters, placeholder "Optional"; Join, disabled until a name is typed and a role picked), Waiting (the class figure, the name, "Rogue, Citizen" as class then stakeholder, and "Table: 3" when a table was given; the role can change in the lobby only), Vote (four large buttons: letter, shape, short label; countdown; the class figure with "Your class leads this round" when it does), Locked in ("Locked: B. Yes to 60 to 100 MW, tied."), Called out ("You're up. Defend B: …", with one vibration where supported), Someone else called out ("Sarah is defending B."), Round result (points this round, running total, rank, and the full debrief of the option you chose), Ending summary (your four picks, your coherence count, your rank), Removed, Reconnecting.

## 4. Game design

### 4.1 The party: four stakeholders, four classes

| Role | Class | Who they are in the case | Leads |
|---|---|---|---|
| Citizen | Rogue | Households and businesses on the same grid, workers promised skills, startups, the Olkaria communities (sections 4.2, 5) | Round 1, power |
| Kenyan Government | Knight | The Treasury and the ICT ministry, the PPP Act, Parliament after the High Court ruling (sections 4.3, 4.4, 5) | Round 2, finances |
| Local Businesses | Bard | Safaricom and M-Pesa, the banks, the startups of the Silicon Savannah, EcoCloud and the local developers who would build and supply (sections 3.2, 4.2, 5) | Round 3, demand |
| Microsoft | Wizard | Azure and the capital-allocation decision, with G42, the Abu Dhabi partner that was to lead the investment, folded into the same side (sections 3.1 to 3.4) | Round 4, the decision |

Students choose their role when they join; the lobby shows the counts so tables can balance themselves. The game does not enforce one of each per table. Roles are fixed once the game starts. The phone shows the player's class figure on the role buttons, on the waiting card and in the "Your class leads this round" note (3 November amendment, section 6 of `2026-11-03-olkaria-facilitator-menu-design.md`).

Colour belongs to the option letter, never to a class: A is always red, B blue, C yellow, D green, on phones, on the projector's cards and bars, and on the call-out banner. Class sprites keep their own look.

### 4.2 The boss: the Deadlock

Four phases of 100 HP each, 400 in total, drawn in a dark-fantasy register.

1. Grid Wyrm (electricity supply): a serpent of chain and lightning coiled around the Olkaria plants.
2. Debt Golem (public finances): a stone golem bound in chains, 68% and 48.5% carved into its chest.
3. Fog of Demand (demand and competitors): a wraith in a cloud of numbers that never agree (97.5%, 8.7%, 20 MW).
4. The core (the decision): the Deadlock's exposed heart.

### 4.3 Shape of a round

1. Narration: the situation in two to four sentences with one quote from the case, ending with the lead class's call to strike ("Rogues, this is your strike: what will Kenyans accept?").
2. Four options on screen (full text) and on phones (short label). Everyone votes. Two-minute timer; the vote locks itself as soon as every player has voted; Space locks early; the timer locks at 0:00.
3. Lock: two bars per option, the lead class and the rest of the party. Call-out: C picks a random voter whose option the round has not heard yet (any uncalled voter once every voted option has been heard), shows their name and choice; they defend it; Y awards a rally strike, N does not. Up to four per round.
4. Reveal: the special attack by the lead class (the lead half of base), the combined support strike (the support half), a flourish per bonus, rally strikes. The numbers shown sum to the damage drained.
5. Debrief: per option, damage and projector line; the breakdown line; the alignment line; the discuss line. Space moves on.

### 4.4 Scoring

Each option in a round has an effective score from 0 to 100.

- Rounds 1 to 3: the effective score is the evidence score set in content (section 5), a judgement of how well the case's evidence supports the move for the stakeholder making it.
- Round 4: effective score = 50 + 15 × synergy hits, where a hit is an earlier round whose class majority is listed as coherent with this option (table in section 5.4). Maximum 95.

Shares. The lead class's votes and the rest of the party's votes are each tallied. Blended share of an option = half its share among the lead class plus half its share among the rest. If one of the two groups cast no votes, the other group's shares are used alone.

Damage for a round:

- base = Σ over options of (blended share × effective score)
- focus bonus = +15 if the top option holds at least 60% of the blended share
- alignment bonus = +10 if the lead class's majority and the rest of the party's majority are the same option (both groups voted, neither tied)
- exhibit bonus = +5 per exhibit collected in the preceding travel segment, maximum 3
- rally bonus = +10 per call-out the facilitator judged convincing, maximum 4
- damage = round(base + focus + alignment + exhibit + rally), clamped to 0 to 100

Majority of a round = the option with the most blended share; on a tie, the earliest letter, flagged tied.

Ending = the majority option of round 4, in a tier set by total damage over the four rounds (max 400): decisive at 260 or more, fragile from 180 to 259. Below 180 the Deadlock holds and its own ending plays.

Student points per round = effective score of their option + speed bonus + 10 if their class led the round (the caster bonus), where speed bonus = round(20 × (1 − response time ÷ vote window)), clamped to 0 to 20. A called-out student also earns 10 points for speaking, or 30 if the party awards the rally strike. "Most consistent strategist" goes to the player whose own four picks produce the most synergy hits for their own round 4 pick, ties broken by total points. "Top table" is the table name with the highest mean points among tables with at least two members; omitted when no one entered a table name.

Worked example, round 1. Ten Rogues vote A 1, B 6, C 1, D 2 (shares 0.10, 0.60, 0.10, 0.20). Thirty others vote A 6, B 15, C 3, D 6 (0.20, 0.50, 0.10, 0.20). Blended 0.15, 0.55, 0.10, 0.20. With round 1 scores 40, 80, 15, 55: base = 6 + 44 + 1.5 + 11 = 62.5. Focus 0 (B at 55%). Alignment +10 (both groups chose B). Two exhibits, +10. Damage 83. The same votes with every Rogue on B and the rest 2:1 for B over A give base 73.3, focus +15, alignment +10, damage 98. An evenly split room does 48.

Worked example, round 4. Earlier majorities B, C, B. Synergy hits: A 0 (score 50), B 3 (95), C 0 (50), D 3 (95). Wizards vote A 2, B 4, C 1, D 1 and the rest A 8, B 16, C 4, D 4 (both 0.25, 0.50, 0.125, 0.125). Base = 12.5 + 47.5 + 6.25 + 11.875 = 78.1. Focus 0. Alignment +10. Damage 88.

Why this shape: the lead class owns half the attack regardless of how many students chose that role, so the stakeholder exercise is real even with uneven tables; the alignment bonus rewards a party that agrees across stakeholders and makes disagreement visible when it does not, which is the discussion; evidence scores reward reading the case; the final round rewards a strategy that hangs together, which is discussion question 1's "what would need to be true".

### 4.5 Travel and exhibits

Short platform segments between rounds. The party walks by itself along a baked path from one second after the segment starts, resting two seconds at each exhibit, so no key is needed. Arrow keys take over the walk (move and jump; Space also jumps), A pauses the walk and resumes it from where the lead stands, N skips to the arena. Three exhibit pickups per segment, each a case figure shown as a toast for 4 seconds and worth +5 damage next round (section 5.5).

### 4.6 Endings

- A, "Olkaria Colossus". Must be true: Microsoft takes a larger share if G42 turns cautious; dedicated geothermal separate from the grid; demand grows into 1 GW over a long payback. Risk accepted: stranded assets and public opposition over power (section 7, Exhibit 10).
- B, "The Seed Plant". Must be true: KenGen or a commercial anchor signs a smaller commitment; 24 to 60 MW fills within a few years; the expansion option stays open. Risk accepted: weak early returns; competitors build larger first.
- C, "The Long Road South". Must be true: Kenyan demand stays small enough that waiting costs little; the G42 and Kenyan relationships survive the pause. Risk accepted: Oracle, Huawei and Nxtra take the market; the deal lapses.
- D, "The Tenant". Must be true: local partners such as EcoCloud are willing and able to own the asset risk; Kenya still delivers power and land; Azure demand fills the rented capacity. Risk accepted: the demand risk is moved, not solved; the partners' goals diverge from Microsoft's.
- `holds`, "The Deadlock holds". Plays when total damage is under 180. "Your board sends the party back to Nairobi." For rounds 1 to 3 it lists the class's majority next to what the final option needed.

Each ending shows the round 4 split, the slide the facilitator closes on.

## 5. Content: four stakeholders, four decisions

Evidence scores are judgements made from the case document alone; the team should agree with them before class and can change them in `content/case.json`. The phone label is what students see; the screen text is the full option on the projector. The projector line (section 5.7) is what the debrief shows; the full debrief goes to the phones and the facilitator notes.

### 5.1 Round 1, Grid Wyrm. Rogues (Citizens): what will Kenyans accept on power?

Narration. "Olkaria steam fields. The Grid Wyrm coils around the plants that make about 950 MW. President Ruto has told the country that switching on the data centre would mean switching off power for half of it. Some lines already run above 120% of their design capacity. Geothermal expansion here once displaced hundreds of Maasai families. Rogues, this is your strike: what will Kenyans accept?"

A. Screen: "Households first. No data-centre load until household and industrial supply is secure; the deal waits for new generation." Phone: "Households first, deal waits". Score 40.
Debrief: "Protects a grid the case shows is stretched: lines above 120% of design capacity, a 1 GW load worth 31% of installed capacity (The Analyst, 2026a; Exhibit 2). But it forgoes the hub, the skills and the regional position while Oracle, Huawei and Nxtra move (section 3.2)."

B. Screen: "Accept a 60 to 100 MW first phase, about 4% of peak demand, on condition that new generation is tied to every expansion." Phone: "Yes to 60 to 100 MW, tied". Score 80.
Debrief: "100 MW is about 4% of peak demand and a tenth of Olkaria's output (Exhibit 2); EcoCloud talks are already at 60 MW (Vimal, 2026); the 10,000 MW plan becomes the condition for growth rather than the hope behind it (Kizito, 2025; The Star, 2026)."

C. Screen: "Accept the full 1 GW for the jobs, the skills lab and the regional hub." Phone: "Full 1 GW for the hub". Score 15.
Debrief: "1 GW is about 31% of installed capacity and 41% of record peak (Exhibit 2). The development centre that was meant to deliver the skills is closing (Namunwa, 2026). Benefits would be concentrated while the risks are spread widely (Exhibit 9)."

D. Screen: "Only with a community deal: Olkaria communities get compensation and a share of the benefit before any expansion." Phone: "Community deal first". Score 55.
Debrief: "Geothermal expansion displaced hundreds of Maasai families and drew a World Bank Inspection Panel investigation (Krebs, 2022; World Bank Inspection Panel, 2015). The right ask for Olkaria; it decides who benefits more than how much power there is."

Citizens' view. Power is a sizing and conditions problem. The grid can carry 60 to 100 MW and cannot carry 1 GW; the condition that generation grows with the plant is what makes B safe, and D is the condition that makes it fair.

Discuss line: "Why did the full 1 GW do so little damage, and what condition made 60 to 100 MW safe?"

### 5.2 Round 2, Debt Golem. Knights (Kenyan Government): what does the Government offer instead of a guarantee?

Narration. "Nairobi, outside the Treasury. The Debt Golem is built from the numbers: public debt about 68% of GDP, debt service taking 48.5% of ordinary revenue, the IMF asking that commitments like an anchor-tenant guarantee be counted as debt. In June 2024, protests over the Finance Bill left people dead and the bill withdrawn. In September 2026 the High Court ruled that PPP liabilities need Parliament. Microsoft wants a guarantee. Knights, this is your strike: what does the Government offer?"

A. Screen: "Sign the anchor-tenant guarantee. The hub is worth the risk." Phone: "Sign the guarantee". Score 10.
Debrief: "The IMF would count it as debt while 48.5% of revenue already goes to debt service (The Analyst, 2026b; People Daily, 2025). The Finance Bill protests show where the limit is (Al Jazeera, 2024). The High Court says Parliament must approve (Capital FM, 2026). Elections come in 2027."

B. Screen: "No guarantee of any kind. Microsoft can build on market terms or not at all." Phone: "No guarantee, market terms". Score 45.
Debrief: "Protects taxpayers and matches Tanui's line that Kenya cannot guarantee procurement set by markets or other governments (Musau, 2026). But it leaves the deal where it is, stalled, while competitors build (section 3.2)."

C. Screen: "KenGen signs a smaller power and capacity commitment for a 60 MW phase, kept off the national balance sheet." Phone: "KenGen signs, 60 MW". Score 65.
Debrief: "The compromise under discussion (The Analyst, 2026b). KenGen gains a long-term customer (KenGen, 2025). The state still ultimately stands behind KenGen, and the IMF may still count it."

D. Screen: "Be the customer, not the guarantor: move government services to the local region under the Cloud Policy, paid from annual budgets." Phone: "Government as customer". Score 60.
Debrief: "The Cloud Policy and the data-localisation rules already point this way (section 4.4), and it creates demand without a sovereign guarantee. But a multi-year cloud purchase may still face the High Court's PPP review (section 4.4), and implementation of digital plans has been uneven (Exhibit 6)."

Government's view. Structure it, do not guarantee it, which is what Tanui said. C and D are both live and combine; A is politically dead; B is honest but passive.

Discuss line: "Two live offers, one honest refusal, one dead option. Which would you sign, and who carries the risk?"

### 5.3 Round 3, Fog of Demand. Bards (Local Businesses): what do Kenya's businesses commit?

Narration. "The Fog. Microsoft wants proof that Kenyans will pay before it builds. Kenya's entire data-centre market is about 20 MW; iXAfrica's flagship runs 4.5 MW. The market was worth about US$266 million in 2025 and may reach US$805 million by 2031, still below the project's headline. One survey says 97.5% of online Kenyans use AI; Microsoft's own measure says 8.7% of the population. Oracle, Huawei and Nxtra are already selling. Bards, this is your strike: what do Kenya's businesses put on the table?"

A. Screen: "Commit now. Safaricom, the banks and the large startups sign letters of intent to move workloads to a Nairobi region if price and latency beat South Africa." Phone: "Sign letters of intent". Score 70.
Debrief: "This is the predictable demand Microsoft says it needs before it builds (Vimal, 2026). M-Pesa's 40 million monthly users and the data-localisation rules make local workloads real (sections 3.2, 4.4). But the case says demand outside government is limited and today's market is 20 MW (section 4.2), so the letters have to be conditional and staged."

B. Screen: "Partner, don't just buy. EcoCloud and local developers co-build a 60 MW first phase and sell capacity to Kenyan firms as they migrate." Phone: "Co-build 60 MW with EcoCloud". Score 80.
Debrief: "The 60 MW EcoCloud talks already exist (Vimal, 2026), local partners stand to win construction, power and connectivity contracts (section 5), and 60 MW is a size the market can grow into. It turns local business from a hoped-for customer into a builder with its own money at stake."

C. Screen: "Wait and compare. Keep workloads with Oracle at iXAfrica, Huawei and South Africa until Azure's local pricing is known." Phone: "Wait, compare providers". Score 40.
Debrief: "Rational for any single buyer: Oracle's region through iXAfrica, Huawei's 100-plus clients and Nxtra's 44 MW are already here (section 3.2). But it leaves the fog exactly as thick as Microsoft found it, and hands the first-mover position to the others."

D. Screen: "Skills first. No commitments until the innovation lab and training promised in 2024 replace the development centre that is closing." Phone: "Skills lab before contracts". Score 35.
Debrief: "The development centre employed about 500 people and was meant to feed the innovation lab (Namunwa, 2026; Otieno, 2026), so the grievance is real. But it ties demand to a different problem and gives Microsoft no reason to build."

Local Businesses' view. Demand is the thing hidden in the fog, and only the buyers can make it visible (A) or build it themselves (B). Waiting (C) and bargaining (D) leave the fog where it is.

Discuss line: "What would Kenya's businesses need to see before they sign, and what would Microsoft need to see before it builds?"

### 5.4 Round 4, the core. Wizards (Microsoft), the whole party: what should Microsoft do?

Narration. "The Deadlock's core is exposed. Kenya's Treasury will not guarantee demand. The Nairobi development centre is closing. Competitors are building. Microsoft must decide how much risk to take, and when. Wizards, this is your strike, and the whole party casts with you: what should Microsoft do?"

A. Screen: "Proceed with the full 1 GW build, taking a larger stake and securing dedicated generation." Phone: "Full 1 GW build".
B. Screen: "Build a 24 to 60 MW facility now and expand in stages as contracts and power arrive." Phone: "Build small, expand later".
C. Screen: "Pause Kenya. Put the capital into South Africa and return when power, finances and demand improve." Phone: "Wait, invest elsewhere".
D. Screen: "Become the tenant. Local partners such as EcoCloud build and own the facility; Microsoft anchors it with Azure capacity." Phone: "Partners build, we rent".

No evidence scores. Synergy table (earlier-round majorities coherent with each final option):

| Final option | Round 1 (Rogues) | Round 2 (Knights) | Round 3 (Bards) |
|---|---|---|---|
| A, full build | C | A, D | A |
| B, build small | B, D | C, D | A, B |
| C, wait | A | B | C, D |
| D, tenant | B, C | C, D | B |

Microsoft's view, for the facilitator only and never shown as a right answer. If the class follows the evidence in rounds 1 to 3, the coherent decision is B, possibly structured as D. The case's own Decision section says every option has significant drawbacks; the point of round 4 is that the class owns the trade-off it picks and can say what must be true for it to work.

Discuss line: "What should Microsoft do, and why?" On the phone, the round 4 result shows how many of the three earlier class decisions the student's own pick fits, instead of a debrief.

### 5.5 Exhibit pickups (travel segments)

Three per segment, each +5 damage in the next round, shown as a toast with the figure and source.

- Travel 1: "Olkaria generates about 950 MW (James, 2026)"; "Record peak demand 2,444 MW, January 2026 (James, 2026)"; "1 GW = about 31% of installed capacity (Exhibit 2)".
- Travel 2: "Public debt about 68% of GDP, June 2025 (Ecofin Agency, 2025)"; "48.5% of ordinary revenue goes to debt service (People Daily, 2025)"; "PPP liabilities need Parliament's approval, September 2026 (Capital FM, 2026)".
- Travel 3: "Kenya's data-centre market is about 20 MW (The Analyst, 2026b)"; "Market worth US$266 million in 2025, US$805 million by 2031 (Semafor, 2026)"; "97.5% of online Kenyans vs 8.7% of all Kenyans used AI (Whitehead, 2026)".
- Travel 4: "US$1 billion is 0.6% of Microsoft's FY2027 capex (Exhibit 4)"; "Nairobi development centre closing, October 2026 (Namunwa, 2026)"; "Microsoft committed US$329 million more to South Africa, April 2026 (Kamau, 2026)".

### 5.6 Characters who speak

- The narrator voice is the game's; the facilitator reads it.
- PS John Tanui appears before round 2 only: the project is "not failed or withdrawn" but its scale "requires some structuring" (James, 2026; Vimal, 2026).
- President Ruto's "shut off power for half the country" (Semafor, 2026) is the Grid Wyrm's taunt.
- Brad Smith's "single biggest step to advance the availability of digital technology" (Vimal, 2026) is shown nowhere; it stays in `content/case.json`.

### 5.7 Projector lines

One line per option on the debrief panel, 130 characters or fewer.

Round 1: A "Protects a stretched grid (lines above 120%), but forgoes the hub while Oracle and Huawei move (The Analyst, 2026a; 3.2)." B "100 MW is about 4% of peak demand; 60 MW EcoCloud talks already exist; growth tied to new generation (Exhibit 2; Vimal, 2026)." C "1 GW is 31% of installed capacity; the skills centre is closing; benefits concentrated, risks spread (Exhibit 2; Exhibit 9)." D "Olkaria expansion displaced Maasai families; the right ask for who benefits, not for how much power (Krebs, 2022)."

Round 2: A "IMF counts it as debt, 48.5% of revenue already services debt, Parliament must approve, elections 2027 (The Analyst, 2026b)." B "Protects taxpayers and matches Tanui's line, but leaves the deal stalled while competitors build (Musau, 2026; 3.2)." C "The compromise on the table; KenGen gains a customer, but the state still stands behind it (The Analyst, 2026b)." D "Cloud Policy demand without a guarantee, but multi-year purchases may face the PPP review (4.4; Capital FM, 2026)."

Round 3: A "The demand Microsoft wants; M-Pesa's 40m users and localisation rules make it real, but today's market is 20 MW (4.2)." B "The 60 MW EcoCloud talks exist; local partners win the contracts and become builders, not hoped-for customers (Vimal, 2026)." C "Rational for one buyer, but Oracle, Huawei and Nxtra are already here and the fog stays as thick as before (3.2)." D "The closing development centre makes the grievance real, but it ties demand to a different problem (Namunwa, 2026)."

## 6. Technical design

### 6.1 Shape

One repository, `~/olkaria`, TypeScript throughout.

- `host/`: the projector game. Phaser 3 with Vite for the world layer (boss, party, platforms, HP bar); an HTML layer over the canvas for everything textual (narration, cards, banner, debrief, QR, toasts, key map). Scenes: Boot, Lobby, Travel, Battle, Ending, Leaderboard. A router starts the right scene for the saved phase and round on load or reconnect.
- `player/`: the phone page. Plain TypeScript and CSS, no framework. The states in section 3.3.
- `worker/`: a Cloudflare Worker that serves both pages as static assets and hosts a Durable Object per room over WebSockets.
- `shared/`: types, the content schema, scoring, the room reducer. Pure functions, unit tested, used by the Durable Object (authoritative) and by the host's offline mode.
- `content/case.json`: everything in section 5, the roles, the lead role per round, endings, exhibit pickups, synergy table, quotes and scoring constants.

Why this stack. Phaser 3 is the standard browser engine for pixel platformers with a pixel-art render mode and arcade physics. Cloudflare Workers with Durable Objects gives one deploy, one URL, server-side tallies that survive a host reload, no idle pause, and the free plan includes SQLite-backed Durable Objects. It deploys to the Cloudflare account this Mac's wrangler is logged into, the one spark-bot uses (Caleb's decision). Supabase Realtime was the alternative; Caleb's free-tier projects pause when idle, the wrong failure mode for a class slot.

### 6.2 Room state machine (authoritative, in `shared/room-logic.ts`)

Phases: `lobby`, `travel`, `vote`, `locked`, `reveal`, `ending`, `leaderboard`. Round index runs 0 to 3; -1 in the lobby. Each round has a lead role from content (`citizen`, `government`, `business`, `microsoft`).

The state also counts `trips`, the roads the room has set off on (`start`, a `next` into a travel and a `goto` to a road each add one; `reset` keeps it), so a jump to the round already on the projector starts its road again. A vote is stored as `{ option, at }` and gains `points` at the reveal: what that vote earned in its round, call-out points included, which is what a `goto` takes back.

Transitions

- `lobby` → `travel` on host `start` (round 0).
- `travel` → `vote` on host `openVote` with a window in seconds (default 120). Sets the deadline and schedules an alarm.
- `vote` → `locked` on host `closeVote`, when the alarm fires, or at once when a vote leaves every player in the room with a vote for this round (the early lock: the same transition as `closeVote`, clearing the alarm; it needs at least one player, and synthetic votes never trigger it).
- In `locked`, host `callout` picks a random player who voted this round and has not been called this round, from those whose option the round has not heard yet, or from any uncalled voter once every voted option has been heard (the command carries the random number so the reducer stays pure), and records a pending call-out; at most 4 per round; with no eligible player it records a call-out with no player so the facilitator can cold-call by hand. Host `judge` resolves the pending call-out (30 points awarded, 10 declined). A second `callout` while one is pending, or outside `locked`, is an error.
- `locked` → `reveal` on host `reveal`. Tallies the lead role and the rest separately, computes damage and bonuses, applies damage, awards points (vote points, caster bonus, call-out points), records the majority. A still-pending call-out counts as declined.
- `locked` → `vote` on host `reopen` with a fresh deadline; existing votes stand and the opening time stays. In `vote`, `reopen` extends the deadline. Elsewhere it is an error; a reveal is final.
- `reveal` → `travel` (round + 1) on host `next` while round < 3; `reveal` → `ending` after round 3. `ending` → `leaderboard` on `next`.
- Any phase → `lobby` on host `reset` (players kept, scores, tallies, call-outs and damage cleared, bans kept).
- Any phase → `travel` (round s) or `ending` on host `goto` with stage 0 to 4: stages 0 to 3 are the road of that round, stage 4 is the ending, and any other stage is refused with "bad stage". A jump keeps the rounds revealed before the stage it goes to and clears the rest (an unrevealed current round included), so scores and the boss's HP stay honest; players, bans and `hideNames` stay. A jump to a road adds one to `trips`.
- Host `exhibit` during `travel` adds a pickup for the current round (max 3). Host `injectVotes` during `vote` or `locked` adds synthetic votes to the current round's support tally (manual mode and bots); synthetic voters never appear as players. Host `kick` removes a player and bans their client id: the phone is told it was removed and stops reconnecting, and any later `join` from that id is refused, so a kick sticks. Host `hideNames` toggles names on the lobby list and the leaderboard.

Player events

- `join` with a client id, a name, a role and an optional table name. A repeat `join` with a known client id is a rejoin and keeps everything. Names and table names are trimmed, stripped of control characters and cut to 16 characters; a role outside the four is rejected; an empty name gets a generated one so the room never shows a blank.
- `vote` with round and option. Rejected unless the phase is `vote`, the round is current, the player exists and has not voted this round. The first vote locks.

Reducer signature: `reduce(state, event, content) → { state, effects }` with effects `setAlarm`, `clearAlarm`, `error`. The Durable Object runs the effects; the offline mode uses a timer.

### 6.3 Transport (Cloudflare Worker and Durable Object)

- `POST /api/rooms` creates a room: a 4-letter code from A to Z without I and O, and a random host key. Returns `{ code, hostKey, joinUrl }`.
- `GET /ws/:code?role=host&key=…` and `GET /ws/:code?role=player&clientId=…` upgrade to WebSockets handled by the room's Durable Object (hibernation API). The Durable Object stores the state after every reduce, broadcasts a host view and per-player views after every change, uses a storage alarm for the deadline, and deletes itself after 6 hours of silence.
- `GET /j/:code` serves the player page; `GET /` redirects to `/host/`; everything else is static assets.
- Host commands carry the host key; player messages carry the client id. No other auth.

Views. The host view is the full state minus the host key, plus the current round's lead tally, support tally and combined tally. The player view has: phase, round, the lead role, whether this player's class leads, their role and table, their vote this round and picks for every round so far, points for the last round, running score, rank, player count, server time, the pending call-out (name, option, whether it is them), and the tallies only once the phase is `reveal` or later.

Reconnect. The host page remembers its room for the tab and resumes at the saved phase: `lobby` the Lobby; `travel` the start of that segment; `vote` and `locked` the Battle at that state; `reveal` the debrief directly without replaying the strike; `ending` and `leaderboard` those screens.

### 6.4 Offline and manual mode

`?mode=offline` on the host runs the same reducer in the browser with no network. Keys 1 to 4 add one support vote each to the current round, Shift+1 to Shift+4 add ten, B adds 30 bot votes weighted toward the strongest option. The same keys work online (they call `injectVotes`). With no real players there is no lead class; the blended share falls back to the support share, so rehearsal numbers are the plain evidence-weighted ones.

### 6.5 Host keyboard

Space: advance (start, open the vote, lock, reveal, next). On the leaderboard Space does nothing, so the closing screen survives a stray press. Shift+R twice within 3 seconds: reset to the lobby (the first press shows "Press Shift+R again to reset"). C: call out (locked only). Y or N: judge the pending call-out. R: reopen a locked vote or extend an open one. Arrows and Space in travel: move and jump. A: pause or resume the walk. N in travel: skip. H: hide names on the lobby list and the leaderboard (the banner still names the called student). F: fullscreen. ?: How to play, eight slides over any screen (Space next, ? closes, Esc too outside fullscreen). M or Esc: the menu (actions and the key map). 1 to 4, Shift+1 to Shift+4, B: tallies.

### 6.6 Content file

`content/case.json` holds: roles (id, stakeholder name, class name, one-line description), four rounds (id `grid`, `debt`, `fog`, `core`; boss name; lead role; narration; options with letter, screen text, phone label, evidence score or null, full debrief, projector line; discuss line), the synergy table, five endings, four exhibit sets, the quotes, and the scoring constants (round HP, focus threshold and bonus, alignment bonus, caster bonus, exhibit bonus and cap, call-out bonus, cap and points, decision base, synergy bonus, speed bonus cap, vote window, ending tiers). A test validates the schema and invariants: four rounds, four options each, each round's lead role distinct and in the order above, evidence scores on rounds 1 to 3 only, synergy keys that exist, phone labels of 28 characters or fewer, projector lines of 130 or fewer, non-empty debrief and projector line on every option of rounds 1 to 3.

## 7. Visual direction: dark-fantasy medieval platformer

- World layer: 320 × 180 at a whole-number zoom (6× at 1080p), Phaser `pixelArt`, no smoothing. Only damage numbers and the HP label are drawn on the canvas.
- Text layer: an HTML element over the canvas with a `--zoom` variable. Minimum sizes at 1080p: 24 px card and debrief copy, 30 px narration, 42 px banner name and titles. Titles and labels in a medieval pixel face (Alagard if its licence checks out, else Pixelify Sans); body copy in the same face at the larger sizes, or a plain sans if a rehearsal from the back row says so.
- Palette: cold stone (near-black blue-grey background, slate panels), one accent, torch amber, and bone white for highlights. Option colours (muted red, blue, yellow, green) appear only where they carry meaning: cards, bars, banner, and the flash on a strike.
- Classes: Rogue hooded with daggers, Knight in plate with a shield, Bard with a lute and a coin purse, Wizard with a staff and a tome. Bosses as in section 4.2, drawn with chains, carved numerals and particle fog.
- Assets: GitHub first, author pages second, every file's licence recorded in `CREDITS.md` before it is copied. The one sizeable licensed pixel-art repository on GitHub is `sparklinlabs/superpowers-asset-packs` (CC0); `Siilwyn/awesome-pixel-art` is the index for finding more. The dark-fantasy platformer packs that fit this brief (ansimuz's Gothicvania series, 0x72's Dungeon Tileset II, brullov's Oak Woods, LuizMelo's medieval packs) are published on itch.io under free-use licences and only mirrored on GitHub inside other people's game projects without their licences, so they are taken from the author's page with the licence text copied. Procedural bosses from tiles and particles remain the fallback.
- Build with placeholder rectangles first; swap in sprites last. Sound is optional (CC0 from the same sources) and the first cut if time is short.
- The phone page follows the anti-vibecode standard: plain sans, flat buttons, one accent, option colours as fills only on the four vote buttons and the four role buttons carry class figures, not colour.

## 8. Risks and rehearsal

- Classroom network: phones and host use the deployed URL; cellular works; test from the room or an equivalent UNC network a week before.
- Failure mid-session: offline mode and hand counts; rehearse the switch once.
- Role imbalance: the lobby shows counts and the lead class always carries half the attack, so a class with three Bards still works; a class with zero of the lead role falls back to the party's votes and the debrief says so.
- Projector and laptop: whole-number zoom handles any resolution; `caffeinate`; fullscreen with F.
- Join friction: large QR with the join address beside it, player bundle under 100 KB.
- Names: required and read aloud on a call-out, 16-character cap, H hides them elsewhere, kick from the host.
- Shy students: the call-out is random, the facilitator can press N or skip, and the phone shows "You're up" before the name is read.
- Timing: everything skippable with Space; travel skippable with N; the 18-minute table in section 3.1 assumes N on travel 2 to 4.
- Content disagreement: the team signs off on scores and debriefs in `content/case.json` before the case document deadline.
- Load: a script simulates 60 phones with roles; run it against the deployed room before class.
- Rubric: the final screen asks what Microsoft should do and why; the facilitator says it aloud too.

`RUNBOOK.md` carries the checklist: deploy, create the room, five teammates join with roles, a full 18-minute run, one switch to offline mode, a run with 60 simulated clients.

Schedule for a 5 November presentation. Build on 2 and 3 November in plan order, which puts the content, scoring, room, phone page and battle screen first (plan tasks 1 to 8, 10, 12). Cuts, in this order, if time runs out: sound; the art pass (placeholder sprites and procedural bosses are acceptable on the day); the travel platformer (replace with a 3-second walk-in to each arena, keep the exhibit bonus as three facts the facilitator reads). Deploy and rehearse with the team's phones on 4 November. The fallback on the day is the offline mode with hand counts, which is in the first build.

## 9. Open questions for Caleb

1. Presentation date: 5 November 2026 (answered 2 November), so the case document is due 3 November and the build has 4 November for rehearsal. Schedule in section 8.
2. The evidence scores in section 5, now written from each stakeholder's side. Does the team agree with them?
3. Round 4 option D: the tenant model (default) or an open "Something else, tell us" button scoring a flat 50?
4. Role choice: free with counts shown (default), or should the join page also take a table number so the leaderboard can rank tables? The optional table name covers this if people fill it in.

Answered on 2 November: Cloudflare account is the one spark-bot uses; 12-minute segment (now 18, see the last note); party of four stakeholder roles as classes chosen at join; one class leads each round's special attack; G42 folded into Microsoft and the fourth role is Local Businesses; dark-fantasy medieval art sourced from GitHub where a licensed copy exists.

## 10. Calls I made

- Roles map to classes as Citizen Rogue, Government Knight, Local Businesses Bard, Microsoft Wizard, and lead the rounds in that order so Microsoft's decision closes the segment as the rubric asks. Bard for Local Businesses is my pick (trade, networks, deals); it is one word in the content file to change.
- Round 3 is written from the buyers' side: with G42 folded into Microsoft, the demand head belongs to the businesses who would buy or build the capacity.
- Every number shown during a strike adds up to the damage drained, bonuses included; a kick bans the client id so it sticks; Space never resets, Shift+R twice does; the lobby shows names in a text-layer list rather than on the sprites; the discuss lines are content and live in section 5 for the team's sign-off.
- The lead class carries half the attack regardless of headcount; the alignment bonus is +10; the caster bonus is 10 points.
- Rounds 1 to 3 are written from the lead stakeholder's side with evidence scores; round 4 keeps Microsoft's four options and the synergy table.
- Call-outs: random among voters of an option not yet heard this round, then anyone uncalled, at most four per round, +10 damage when convincing, 30 points to the student when awarded and 10 for speaking.
- Names and roles are required; table name optional; 16-character caps; generated fallback name only on the server.
- Colour is bound to the option letter, never to a class. Arrow keys only in travel. R reopens or extends only. A reveal is final. Host reload resumes at the saved phase; a saved reveal resumes at the debrief.
- Text in an HTML layer over a 320 × 180 canvas at whole-number zoom; projector debriefs are one line per option; full debriefs go to the phones.
- Phaser 3 on Vite, plain TypeScript phone page, Cloudflare Worker plus Durable Objects, content in one JSON file, offline mode from the first build.
- Assets from GitHub where a licensed copy exists, otherwise from the author's page with the licence copied; placeholder art first, procedural bosses as the fallback, sound last.

Amended on 3 Nov 2026 at Caleb's request: sections 4.3, 4.4 and 6.2 and the call-outs line in section 10 now carry the two-minute vote, the early lock and the four call-outs, one voice per option. The change is specified in `2026-11-03-olkaria-vote-window-and-callouts-design.md`.

Amended again on 3 Nov 2026 at Caleb's request: sections 3.2, 3.3, 4.1, 4.5, 5.6, 6.2, 6.5 and 7 now carry the facilitator menu, the automatic walk, the class figures on the phone, the leaner lobby and the leaner phone onboarding. The change is specified in `2026-11-03-olkaria-facilitator-menu-design.md`; section 6.5 also lists the ? key for How to play (`2026-11-03-olkaria-how-to-play-design.md`). Sections 1, 2, 3.1, 3.2, 6.2 and 8 also follow the vote-window change: up to four call-outs, and a run of show re-timed to 18 minutes for votes at their full two minutes.
