#!/usr/bin/env python3
"""Build the character sheet for Olkaria: the Deadlock, as a printable PDF and as an editable artifact page.

One data model, built from content/case.json plus the sheet's own copy (the briefing and the rules in plain words),
feeds one HTML page that renders itself from embedded JSON. Headless Chrome prints that page to Letter for the PDF;
the same page, published as an artifact with the `artifact` capability, lets Caleb edit every line in place and save
the result as `data/sheet.json` next to the page. `--data` rebuilds the PDF from such a saved file. No evidence
scores, debriefs, discuss lines or endings appear: those are the reveal.

Run from anywhere:
  python3 docs/character-sheet/build.py                      # the PDF beside this script
  python3 docs/character-sheet/build.py --data sheet.json    # the PDF from an edited data file
  python3 docs/character-sheet/build.py --artifact DIR       # DIR/index.html and DIR/data/sheet.json to publish
"""
import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROLE_ORDER = ["citizen", "government", "business", "microsoft"]
LETTERS = "ABCD"

# The class figures, 12 by 16, copied from shared/figures.ts, with their colours from shared/palette.ts:
# [x, y, w, h, palette key], drawn in order.
PALETTE = {
    "night": "#15141c", "outline": "#0c0b10", "stoneDeep": "#1f2230", "stoneDark": "#2a2e3a", "stone": "#3d4352",
    "stoneLight": "#59606f", "stonePale": "#7d8494", "bone": "#ddd7c7", "boneDim": "#b0aa9a", "steel": "#a4abb8",
    "steelDark": "#6f7686", "clothDark": "#2e2b38", "cloth": "#4a4556", "leather": "#6b4f3a", "wood": "#7a5a3a",
    "skin": "#b8957a", "ember": "#a8682c", "amber": "#eda34f",
    # Option colours A and B from host/hud/Hud.ts, used here by the stat icons only.
    "rose": "#b5473d", "sky": "#3f6fa3",
}
FIGURES = {
    "citizen": [  # Rogue: hood and cloak, a dagger in each hand
        [5, 0, 2, 1, "cloth"], [4, 1, 4, 1, "cloth"], [3, 2, 6, 5, "cloth"],
        [4, 4, 4, 2, "outline"], [5, 5, 1, 1, "bone"], [7, 5, 1, 1, "bone"],
        [3, 7, 6, 5, "clothDark"], [2, 10, 8, 2, "clothDark"], [3, 9, 6, 1, "leather"],
        [4, 12, 1, 3, "cloth"], [7, 12, 1, 3, "cloth"], [3, 15, 2, 1, "leather"], [7, 15, 2, 1, "leather"],
        [1, 6, 1, 4, "steel"], [0, 10, 3, 1, "leather"], [1, 11, 1, 1, "leather"],
        [10, 6, 1, 4, "steel"], [9, 10, 3, 1, "leather"], [10, 11, 1, 1, "leather"],
    ],
    "government": [  # Knight: plumed helmet with a visor, plate, a shield on the left arm, a sword in the right
        [5, 0, 2, 1, "bone"], [4, 1, 4, 1, "steel"], [3, 2, 6, 5, "steel"], [4, 4, 4, 1, "outline"],
        [4, 7, 4, 1, "steelDark"], [3, 8, 6, 4, "steel"], [3, 10, 6, 1, "steelDark"],
        [4, 12, 2, 3, "steelDark"], [6, 12, 2, 3, "steelDark"], [3, 15, 3, 1, "stone"], [6, 15, 3, 1, "stone"],
        [0, 7, 4, 6, "stonePale"], [0, 7, 4, 1, "bone"], [1, 9, 2, 2, "bone"], [1, 12, 2, 1, "stoneLight"],
        [10, 3, 1, 8, "steel"], [9, 11, 3, 1, "leather"], [10, 12, 1, 1, "leather"],
    ],
    "business": [  # Bard: feathered cap, tunic, a lute across the body and a coin purse at the belt
        [3, 1, 6, 2, "cloth"], [8, 0, 3, 1, "bone"], [10, 1, 1, 1, "bone"],
        [4, 3, 4, 3, "skin"], [5, 4, 1, 1, "outline"], [7, 4, 1, 1, "outline"],
        [3, 6, 6, 6, "cloth"], [4, 6, 4, 1, "boneDim"], [3, 10, 6, 1, "leather"],
        [4, 12, 1, 3, "clothDark"], [7, 12, 1, 3, "clothDark"], [3, 15, 2, 1, "leather"], [7, 15, 2, 1, "leather"],
        [6, 8, 4, 4, "wood"], [7, 9, 1, 1, "outline"], [9, 5, 1, 3, "leather"], [10, 4, 1, 1, "leather"],
        [10, 3, 2, 1, "wood"], [1, 10, 2, 2, "ember"], [1, 9, 2, 1, "leather"],
    ],
    "microsoft": [  # Wizard: pointed hat, beard, robe to the ground, a staff with a lit stone and a tome
        [5, 0, 2, 1, "cloth"], [4, 1, 4, 2, "cloth"], [3, 3, 6, 1, "cloth"], [2, 4, 8, 1, "clothDark"],
        [4, 5, 4, 2, "skin"], [5, 5, 1, 1, "outline"], [7, 5, 1, 1, "outline"], [4, 7, 4, 2, "bone"],
        [3, 9, 6, 2, "cloth"], [2, 11, 8, 4, "cloth"], [2, 15, 8, 1, "clothDark"],
        [9, 8, 1, 2, "skin"], [10, 2, 1, 14, "wood"], [10, 1, 1, 1, "amber"], [9, 1, 1, 1, "ember"], [11, 1, 1, 1, "ember"],
        [1, 9, 3, 3, "leather"], [1, 9, 1, 3, "bone"],
    ],
}


def plural(class_name: str) -> str:
    return class_name + "s"

# Stat and special icons, 8 by 8 pixel grids in the palette, drawn on a dark tile so they read in both themes.
ICONS = {
    "health": [[1, 1, 2, 1, "rose"], [4, 1, 2, 1, "rose"], [0, 2, 7, 2, "rose"], [1, 4, 5, 1, "rose"], [2, 5, 3, 1, "rose"],
               [3, 6, 1, 1, "rose"], [1, 2, 1, 1, "bone"]],
    "attack": [[3, 0, 2, 1, "bone"], [3, 1, 2, 4, "steel"], [1, 5, 6, 1, "leather"], [3, 6, 2, 1, "wood"], [3, 7, 2, 1, "amber"]],
    "defense": [[0, 0, 8, 1, "steel"], [0, 1, 8, 3, "sky"], [1, 4, 6, 1, "sky"], [2, 5, 4, 1, "sky"], [3, 6, 2, 1, "sky"],
                [3, 1, 2, 4, "bone"]],
    "community": [[1, 0, 2, 3, "skin"], [0, 3, 4, 3, "amber"], [0, 6, 1, 2, "ember"], [3, 6, 1, 2, "ember"],
                  [5, 0, 2, 3, "skin"], [4, 3, 4, 3, "steel"], [4, 6, 1, 2, "steelDark"], [7, 6, 1, 2, "steelDark"]],
    "wall": [[0, 0, 3, 2, "boneDim"], [4, 0, 4, 2, "boneDim"], [0, 2, 1, 2, "stonePale"], [2, 2, 3, 2, "stonePale"],
             [6, 2, 2, 2, "stonePale"], [0, 4, 3, 2, "boneDim"], [4, 4, 4, 2, "boneDim"], [0, 6, 1, 2, "stonePale"],
             [2, 6, 3, 2, "stonePale"], [6, 6, 2, 2, "stonePale"]],
    "song": [[2, 5, 3, 2, "amber"], [4, 0, 1, 6, "bone"], [5, 0, 2, 1, "bone"], [6, 1, 1, 2, "bone"]],
    "fireball": [[2, 2, 4, 1, "steel"], [1, 3, 6, 4, "sky"], [2, 7, 4, 1, "sky"], [3, 4, 2, 2, "bone"], [6, 1, 1, 1, "amber"],
                 [7, 0, 1, 1, "amber"], [7, 2, 1, 1, "amber"]],
}

# Card stats, flavour only: the game never reads them. The special sits between the stakeholder and the class
# (Caleb, 3 November): the citizens' Rogue rallies the community, the Government's Knight holds a sovereign wall,
# the businesses' Bard sings up trade, Microsoft's Wizard throws an Azure fireball.
STATS = {
    "citizen": {"health": 90, "attack": 95, "defense": 80, "special": ("Community", "community", 95)},
    "government": {"health": 95, "attack": 85, "defense": 100, "special": ("Sovereign wall", "wall", 95)},
    "business": {"health": 85, "attack": 90, "defense": 85, "special": ("Trade song", "song", 95)},
    "microsoft": {"health": 85, "attack": 100, "defense": 80, "special": ("Azure fireball", "fireball", 100)},
}


def stats_of(rid: str) -> list:
    s = STATS[rid]
    return [{"k": "Health", "icon": "health", "v": str(s["health"])},
            {"k": "Attack", "icon": "attack", "v": str(s["attack"])},
            {"k": "Defense", "icon": "defense", "v": str(s["defense"])}]


def special_of(rid: str) -> dict:
    name, icon, v = STATS[rid]["special"]
    return {"k": "Special", "icon": icon, "name": name, "v": str(v)}


def model(content: dict) -> dict:
    """The sheet as data: every line the page shows, composed once here so the page only renders."""
    roles = {r["id"]: r for r in content["roles"]}
    rounds = content["rounds"]
    s = content["scoring"]
    total_hp = s["roundHp"] * len(rounds)
    focus_pct = round(s["focusThreshold"] * 100)
    tiers = s.get("tiers")
    nums = [v for v in tiers.values() if isinstance(v, (int, float))] if isinstance(tiers, dict) else []
    holds = f" Below {min(nums)} in total, the Deadlock holds." if nums else ""
    lead_round = {rd["lead"]: i for i, rd in enumerate(rounds)}
    last_i = len(rounds) - 1
    wizards = plural(roles["microsoft"]["className"])

    role_cards = []
    for rid in ROLE_ORDER:
        r = roles[rid]
        i = lead_round[rid]
        rd = rounds[i]
        strike = f"Round {i + 1}, {rd['boss']}: {rd['title']}" + ("" if rd["title"].endswith("?") else ".")
        if i == last_i:
            strike += " The whole party casts with you, and Microsoft is the case's decision maker, so it decides last."
        role_cards.append({"id": rid, "stakeholder": r["stakeholder"], "className": r["className"],
                           "who": r["blurb"] + ".", "stats": stats_of(rid), "special": special_of(rid), "strike": strike})

    q = content["quotes"]
    briefing = [
        "Microsoft, with G42 of Abu Dhabi on the same side, wants to build a US$1 billion data centre at Olkaria, "
        "Kenya's geothermal steam fields, with a headline of 1 GW. Brad Smith called it the "
        f"“{q['smith']}”. Today the project is deadlocked. President Ruto has said that switching it on "
        f"would “{q['ruto']}”, and some lines already run above 120% of their design capacity. The "
        "Treasury will not sign the anchor-tenant guarantee Microsoft wants: the IMF would count it as debt, and the "
        "High Court has ruled that PPP liabilities need Parliament. Kenya's whole data-centre market is about 20 MW, "
        "and Oracle, Huawei and Nxtra are already selling. Microsoft's Nairobi development centre is closing, and "
        "the company has committed US$329 million more to South Africa.",
        "PS John Tanui says the project is “not failed or withdrawn” but “requires some "
        "structuring”. Your party's job is to find that structure. In rounds 1 to 3 one stakeholder sets its "
        "terms; in round 4 Microsoft decides.",
    ]
    secs = s["voteSeconds"]
    window = f"{secs // 60} minute{'s' if secs // 60 != 1 else ''}" if secs % 60 == 0 else f"{secs} seconds"
    steps = [
        "The narration sets the scene and names the lead class.",
        f"Everyone votes on their phone within {window}. The vote closes as soon as everyone has voted. The lead "
        "class's votes are half the attack; the rest of the party's are the other half.",
        f"The vote locks. The facilitator calls out up to {s['maxCallouts']} voters, each for an option the round has "
        "not heard yet, to defend their pick in one breath. A defence the room finds convincing earns a rally strike.",
        "The party strikes. The damage shows on the boss, number by number.",
        "The debrief shows what each option did, then one question to argue over at your table.",
    ]
    scoring = [
        {"k": "Damage.", "text": "How well the case's evidence supports the options the party chose, plus bonuses: "
         f"focus ({focus_pct}% or more of the blended vote on one option), alignment (the lead class and the rest of "
         f"the party pick the same option), exhibits collected on the road before the round (up to "
         f"{s['maxExhibits']}), and rally strikes (up to {s['maxCallouts']}). Each boss has {s['roundHp']} HP, "
         f"{total_hp} in all.{holds}"},
        {"k": f"Round {len(rounds)}.", "text": f"The whole party casts with the {wizards}. Its options score on how "
         f"well they fit what the party chose in rounds 1 to {last_i}. The majority option decides the ending."},
        {"k": "Your points.", "text": "Your option's evidence weight, a speed bonus for voting early, "
         f"{s['casterBonus']} more when your class leads the round, and {s['calloutPointsSpoke']} for answering a "
         f"call-out ({s['calloutPointsAwarded']} if you win the rally). The leaderboard names the top five, the most "
         "consistent strategist and the top table."},
    ]
    round_blocks = []
    for i, rd in enumerate(rounds):
        lead = roles[rd["lead"]]
        who = f"{plural(lead['className'])} ({lead['stakeholder']}) lead"
        who += ", and the whole party casts with them." if i == last_i else "; the rest of the party supports."
        round_blocks.append({
            "label": f"Round {i + 1}: {rd['boss']}. {who}",
            "question": rd["title"],
            "narration": rd["narration"],
            "optionsLabel": "The options",
            "options": [{"letter": LETTERS[k], "screen": o["screen"], "phone": "On your phone: " + o["phone"]}
                        for k, o in enumerate(rd["options"])],
            "factsLabel": "Facts in play, the three exhibits on the road to this boss",
            "facts": [{"text": x["text"], "source": x["source"]} for x in content["exhibits"][i]],
        })
    return {
        "eyebrow": "BUSI611 case game",
        "title": content["title"],
        "lead": "Character sheet. One sheet per table: four players, one of each class. You vote on your phone; "
                "the sheet is for the argument in between.",
        "partyHeading": "Your party",
        "roles": role_cards,
        "briefHeading": "The case in brief",
        "briefing": briefing,
        "stepsHeading": "How a round plays",
        "steps": steps,
        "scoringHeading": "How it is scored",
        "scoring": scoring,
        "strikesHeading": "The four strikes",
        "strikesIntro": "The same questions and options that will come up on the projector, in order. The option "
                        "text is what the screen shows; the shorter line is the button on your phone.",
        "rounds": round_blocks,
        "planHeading": "Your table's plan",
        "planIntro": "Before each vote, agree what your stakeholder needs to be true and what you will not accept. "
                     "One line per round; the fourth is Microsoft's call.",
        "planLines": len(rounds),
    }


PAGE = r"""<meta name="claude:viewport-fit-sides" content="cover">
<title>Olkaria character sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
<style>
/* Layout: one reading column; a 2 by 2 party grid, a two-column rules block, each round a stacked block with its
   options in a 2 by 2 grid like the projector's cards and its road facts as a strip. Print collapses to Letter and
   adds the plan's writing lines; on screen there are no blank fields (Caleb, 3 November). */
:root{
  --accent:#2f5bd8;
  --bg:#ffffff; --surface:#ffffff; --surface-2:#f4f3f0; --tile:#e9e7e1; --tile-dark:#2a2e3a; --line:rgba(17,17,19,.10); --rule:rgba(17,17,19,.35);
  --ink:#15151a; --ink-2:#52525b; --ink-3:#8f8f98;
  --font:'Plus Jakarta Sans',-apple-system,system-ui,sans-serif;
  --font-title:'Pixelify Sans',var(--font);
  --fs-base:15px;
  --s1:5px; --s2:10px; --s3:14px; --s4:18px; --s5:28px; --s6:36px; --s7:56px;
  --card-pad:18px; --r-lg:14px; --r-sm:9px;
  --t-cap:calc(var(--fs-base)*.82); --t-body:var(--fs-base); --t-lead:calc(var(--fs-base)*1.12);
  --t-h3:calc(var(--fs-base)*1.3); --t-h2:calc(var(--fs-base)*1.55); --t-h1:calc(var(--fs-base)*3);
  --lh-display:1.0; --lh-h2:1.12; --lh-h3:1.22; --lh-lead:1.42; --lh-body:1.5; --lh-tight:1.3;
  --tr-display:-.01em; --tr-h2:-.024em; --tr-h3:-.018em; --tr-lead:-.008em; --tr-cap:.006em; --tr-eyebrow:.012em;
  --measure:72ch;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --accent:#9db2f3; --bg:#15141c; --surface:#1d1c25; --surface-2:#262530; --tile:#2a2e3a; --tile-dark:#3d4352; --line:rgba(255,255,255,.10); --rule:rgba(255,255,255,.4);
  --ink:#ebe6d9; --ink-2:#a9afbb; --ink-3:#7c8290; color-scheme:dark;
} }
:root[data-theme="dark"]{
  --accent:#9db2f3; --bg:#15141c; --surface:#1d1c25; --surface-2:#262530; --tile:#2a2e3a; --tile-dark:#3d4352; --line:rgba(255,255,255,.10); --rule:rgba(255,255,255,.4);
  --ink:#ebe6d9; --ink-2:#a9afbb; --ink-3:#7c8290; color-scheme:dark;
}
html,body{ margin:0; background:var(--bg); color:var(--ink); font-family:var(--font); font-size:var(--t-body); line-height:var(--lh-body); -webkit-print-color-adjust:exact; print-color-adjust:exact; overflow-x:clip; }
*{ box-sizing:border-box; min-width:0; }
.page{ max-width:900px; margin:0 auto; padding-block:var(--s5) var(--s7); padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px)); }
p{ margin:0; }
p + p{ margin-top:var(--s3); }
.k{ font-weight:600; }
.sub{ font-size:var(--t-cap); line-height:var(--lh-tight); letter-spacing:var(--tr-cap); color:var(--ink-2); margin:0 0 var(--s2); }
.cite{ color:var(--ink-3); font-size:var(--t-cap); }
h1,h2,h3{ text-wrap:balance; }
h1{ font-family:var(--font-title); font-size:var(--t-h1); font-weight:600; line-height:var(--lh-display); letter-spacing:var(--tr-display); margin:0 0 var(--s3); overflow-wrap:anywhere; }
h2{ font-size:var(--t-h2); font-weight:600; line-height:var(--lh-h2); letter-spacing:var(--tr-h2); color:var(--accent); margin:0 0 var(--s3); break-after:avoid; }
h3{ font-size:var(--t-h3); font-weight:600; line-height:var(--lh-h3); letter-spacing:var(--tr-h3); margin:0; break-after:avoid; }

/* Toolbar: only in a viewer that can save; never printed */
.toolbar{ position:sticky; top:env(safe-area-inset-top,0px); z-index:5; display:flex; flex-wrap:wrap; align-items:center; gap:var(--s2); padding:var(--s2) 0; margin-bottom:var(--s4); background:var(--bg); border-bottom:1px solid var(--line); }
.toolbar[hidden]{ display:none; }
.btn{ font:600 var(--t-cap)/1 var(--font); color:var(--ink); background:var(--surface-2); border:1px solid var(--line); border-radius:var(--r-sm); padding:9px 18px; cursor:pointer; white-space:nowrap; }
.btn:hover{ filter:brightness(.97); }
.btn:active{ filter:brightness(.93); }
.btn:focus-visible{ outline:2px solid var(--accent); outline-offset:2px; }
.btn:disabled{ opacity:.45; cursor:default; }
.btn-primary{ background:var(--accent); color:#fff; border-color:transparent; }
:root[data-theme="dark"] .btn-primary{ color:#15141c; }
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .btn-primary{ color:#15141c; } }
.status{ color:var(--ink-2); font-size:var(--t-cap); margin-left:auto; }
.editing [data-path]{ outline:1px dashed var(--rule); outline-offset:3px; border-radius:3px; cursor:text; }
.editing [data-path]:focus{ outline:2px solid var(--accent); outline-offset:3px; }

/* Header */
.hdr{ display:flex; flex-wrap:wrap; align-items:flex-start; justify-content:space-between; gap:var(--s4) var(--s6); padding-bottom:var(--s4); border-bottom:1px solid var(--line); margin-bottom:var(--s5); }
.hdr > div{ flex:1 1 420px; }
.eyebrow{ font-size:var(--t-cap); line-height:var(--lh-tight); letter-spacing:var(--tr-eyebrow); color:var(--ink-2); margin:0 0 var(--s3); }
.lead{ font-size:var(--t-lead); line-height:var(--lh-lead); letter-spacing:var(--tr-lead); color:var(--ink-2); max-width:var(--measure); }

/* Sections */
section{ margin-bottom:var(--s5); }
.grid2{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s3); }
.card{ background:var(--surface); border:1px solid var(--line); border-radius:var(--r-lg); padding:var(--card-pad); break-inside:avoid; }
.role{ display:grid; grid-template-columns:auto minmax(0,1fr); column-gap:var(--s3); align-content:start; }
.role .tile{ grid-row:1 / span 2; width:48px; height:48px; border-radius:var(--r-sm); background:var(--tile); display:grid; place-items:center; }
.role .tile svg{ width:30px; height:40px; shape-rendering:crispEdges; display:block; }
.role .sub{ margin-bottom:2px; min-height:calc(2em * var(--lh-tight)); display:flex; align-items:flex-end; }
.role .body{ grid-column:1 / -1; margin-top:var(--s2); }
.role .who{ color:var(--ink-2); }
.role .strike{ margin-top:var(--s2); }
/* Three stat cells under the blurb, each an icon on a dark tile with its number beside it, then the special as a bar:
   the icon, the number, the move's title. */
.role .stats{ margin-top:var(--s3); display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s2); }
.stat{ display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; column-gap:var(--s2); padding:var(--s2); border-radius:var(--r-sm); background:var(--surface-2); min-width:0; }
.stat .ico{ width:24px; height:24px; border-radius:6px; background:var(--tile-dark); display:grid; place-items:center; }
.stat .ico svg{ width:16px; height:16px; shape-rendering:crispEdges; display:block; }
.stat-v, .stat-n{ font-size:var(--t-h3); line-height:var(--lh-tight); letter-spacing:var(--tr-h3); font-weight:700; font-variant-numeric:tabular-nums; }
.stat.special{ grid-column:1 / -1; grid-template-columns:auto auto minmax(0,1fr); }
.stat.special .stat-title{ font-size:var(--t-body); line-height:var(--lh-tight); font-weight:700; }
.measure{ max-width:var(--measure); }
.rules{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s5); break-inside:avoid; }
.steps{ margin:0; padding-left:var(--s4); }
.steps li{ margin-bottom:var(--s2); padding-left:var(--s1); }
.steps li::marker{ color:var(--ink-3); font-weight:600; }
.strikes{ margin-bottom:var(--s4); }
.intro{ color:var(--ink-2); }

/* Rounds */
.round{ break-inside:avoid; border-top:1px solid var(--line); padding-top:var(--s3); margin-bottom:var(--s4); }
.round-head{ margin-bottom:var(--s2); }
.round-head h2{ color:var(--ink); margin:0; }
.narration{ max-width:84ch; }
.options-sub, .facts-sub{ margin-top:var(--s2); }
.options{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s2) var(--s5); }
.options li{ display:grid; grid-template-columns:auto minmax(0,1fr); column-gap:var(--s2); align-items:start; }
.options p{ margin:0; }
.letter{ display:inline-flex; align-items:center; justify-content:center; width:1.9em; height:1.9em; border-radius:var(--r-sm); background:var(--surface-2); font-weight:700; margin-top:1px; }
.phone{ margin-top:2px !important; font-size:var(--t-cap); line-height:var(--lh-tight); color:var(--ink-2); }
.facts{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s4); }
.facts li p{ margin:0; }
.facts li p + p{ margin-top:2px; }

/* The plan box */
.plan{ break-inside:avoid; border-top:1px solid var(--line); padding-top:var(--s4); }
.lines{ display:none; margin-top:var(--s4); }   /* writing lines are for paper; the screen stays clean */
.line{ display:flex; align-items:flex-end; gap:var(--s2); height:12mm; border-bottom:1px solid var(--rule); }
.line .k{ color:var(--ink-3); font-size:var(--t-cap); padding-bottom:2px; }
.line + .line{ margin-top:0; }

@media (max-width:560px){
  .grid2, .rules, .options, .facts{ grid-template-columns:minmax(0,1fr); }
}
@media (prefers-reduced-motion: reduce){ *{ transition:none !important; } }

/* Print: Letter, the light palette whatever the theme, no toolbar, two rounds to a page */
@page{ size:Letter; margin:13mm 14mm 15mm; }
@media print{
  :root, :root[data-theme="dark"], :root:not([data-theme="light"]){
    --accent:#2f5bd8; --bg:#ffffff; --surface:#ffffff; --surface-2:#f4f3f0; --tile:#e9e7e1; --tile-dark:#2a2e3a; --line:rgba(17,17,19,.10); --rule:rgba(17,17,19,.35);
    --ink:#15151a; --ink-2:#52525b; --ink-3:#8f8f98; color-scheme:light;
    --fs-base:9.5pt; --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px; --card-pad:14px; --r-lg:12px; --r-sm:8px;
  }
  .page{ max-width:none; padding:0; }
  .toolbar{ display:none !important; }
  .role .tile{ width:44px; height:44px; }
  .lines{ display:block; }
}
</style>
<script type="application/json" id="sheet-data">__DATA__</script>
<div class="page">
  <div class="toolbar" id="toolbar" hidden>
    <button class="btn" type="button" id="edit">Edit</button>
    <button class="btn btn-primary" type="button" id="save" hidden>Save</button>
    <button class="btn" type="button" id="discard" hidden>Discard</button>
    <button class="btn" type="button" id="copy">Copy JSON</button>
    <span class="status" id="status"></span>
  </div>
  <div id="app"></div>
</div>
<script>
(function () {
  'use strict';
  var PALETTE = __PALETTE__;
  var FIGURES = __FIGURES__;
  var ICONS = __ICONS__;
  var ROLE_ORDER = ['citizen', 'government', 'business', 'microsoft'];
  var SVG = 'http://www.w3.org/2000/svg';
  var dataNode = document.getElementById('sheet-data');
  var saved = JSON.parse(dataNode.textContent);
  var data = JSON.parse(JSON.stringify(saved));
  var app = document.getElementById('app');
  var toolbar = document.getElementById('toolbar');
  var editBtn = document.getElementById('edit');
  var saveBtn = document.getElementById('save');
  var discardBtn = document.getElementById('discard');
  var copyBtn = document.getElementById('copy');
  var statusEl = document.getElementById('status');
  var editing = false;
  var dirty = false;
  var artifact = null;

  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (attrs[k] === null || attrs[k] === undefined) return;
      el.setAttribute(k, attrs[k]);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c === null || c === undefined) continue;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    }
    return el;
  }
  function get(path) {
    return path.split('.').reduce(function (o, k) { return o[k]; }, data);
  }
  function set(path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var o = keys.reduce(function (o, k) { return o[k]; }, data);
    o[last] = value;
  }
  /** An editable line: one element, text only, bound to a path in the data. */
  function t(tag, attrs, path) {
    var el = h(tag, attrs, String(get(path)));
    el.setAttribute('data-path', path);
    return el;
  }
  function figure(role) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 12 16');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', role + ' figure');
    (FIGURES[role] || []).forEach(function (r) {
      var rect = document.createElementNS(SVG, 'rect');
      rect.setAttribute('x', r[0]); rect.setAttribute('y', r[1]);
      rect.setAttribute('width', r[2]); rect.setAttribute('height', r[3]);
      rect.setAttribute('fill', PALETTE[r[4]]);
      svg.appendChild(rect);
    });
    return svg;
  }
  function icon(name) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 8 8');
    svg.setAttribute('aria-hidden', 'true');
    (ICONS[name] || []).forEach(function (r) {
      var rect = document.createElementNS(SVG, 'rect');
      rect.setAttribute('x', r[0]); rect.setAttribute('y', r[1]);
      rect.setAttribute('width', r[2]); rect.setAttribute('height', r[3]);
      rect.setAttribute('fill', PALETTE[r[4]]);
      svg.appendChild(rect);
    });
    return svg;
  }
  /** One stat cell: the icon on its dark tile with the number beside it. The label is for screen readers only. */
  function stat(name, kPath, vPath) {
    return h('div', { 'class': 'stat', role: 'group', 'aria-label': String(get(kPath)) },
      h('span', { 'class': 'ico' }, icon(name)),
      t('b', { 'class': 'stat-v' }, vPath));
  }
  /** The special, a bar under the three stats: the icon, the number beside it, then the move's title. */
  function special(s, p) {
    return h('div', { 'class': 'stat special', role: 'group', 'aria-label': String(get(p + 'special.k')) },
      h('span', { 'class': 'ico' }, icon(s.icon)),
      t('b', { 'class': 'stat-n' }, p + 'special.v'),
      t('b', { 'class': 'stat-title' }, p + 'special.name'));
  }

  function render() {
    var frag = document.createDocumentFragment();
    frag.appendChild(h('header', { 'class': 'hdr' },
      h('div', null,
        t('p', { 'class': 'eyebrow' }, 'eyebrow'),
        t('h1', null, 'title'),
        t('p', { 'class': 'lead' }, 'lead'))));

    var cards = h('div', { 'class': 'grid2' });
    data.roles.forEach(function (r, i) {
      var p = 'roles.' + i + '.';
      var stats = null;
      if (r.stats && r.special) {
        stats = h('div', { 'class': 'stats' });
        r.stats.forEach(function (s, j) { stats.appendChild(stat(s.icon, p + 'stats.' + j + '.k', p + 'stats.' + j + '.v')); });
        stats.appendChild(special(r.special, p));
      }
      cards.appendChild(h('div', { 'class': 'card role' },
        h('div', { 'class': 'tile' }, figure(r.id)),
        t('p', { 'class': 'sub' }, p + 'stakeholder'),
        t('h3', null, p + 'className'),
        h('div', { 'class': 'body' },
          t('p', { 'class': 'who' }, p + 'who'),
          stats,
          h('p', { 'class': 'strike' }, h('span', { 'class': 'k' }, 'Your strike'), ' ', t('span', null, p + 'strike')))));
    });
    frag.appendChild(h('section', null, t('h2', null, 'partyHeading'), cards));

    var brief = h('div', { 'class': 'measure' });
    data.briefing.forEach(function (_, i) { brief.appendChild(t('p', null, 'briefing.' + i)); });
    frag.appendChild(h('section', null, t('h2', null, 'briefHeading'), brief));

    var steps = h('ol', { 'class': 'steps' });
    data.steps.forEach(function (_, i) { steps.appendChild(t('li', null, 'steps.' + i)); });
    var scoring = h('div', null);
    data.scoring.forEach(function (_, i) {
      scoring.appendChild(h('p', null, t('span', { 'class': 'k' }, 'scoring.' + i + '.k'), ' ', t('span', null, 'scoring.' + i + '.text')));
    });
    frag.appendChild(h('section', { 'class': 'rules' },
      h('div', null, t('h2', null, 'stepsHeading'), steps),
      h('div', null, t('h2', null, 'scoringHeading'), scoring)));

    frag.appendChild(h('section', { 'class': 'strikes' }, t('h2', null, 'strikesHeading'), t('p', { 'class': 'measure intro' }, 'strikesIntro')));

    data.rounds.forEach(function (rd, i) {
      var p = 'rounds.' + i + '.';
      var opts = h('ol', { 'class': 'options' });
      rd.options.forEach(function (o, k) {
        var op = p + 'options.' + k + '.';
        opts.appendChild(h('li', null, t('span', { 'class': 'letter' }, op + 'letter'),
          h('div', null, t('p', null, op + 'screen'), t('p', { 'class': 'phone' }, op + 'phone'))));
      });
      var facts = h('ul', { 'class': 'facts' });
      rd.facts.forEach(function (f, k) {
        var fp = p + 'facts.' + k + '.';
        facts.appendChild(h('li', null, t('p', null, fp + 'text'), t('p', { 'class': 'cite' }, fp + 'source')));
      });
      frag.appendChild(h('section', { 'class': 'round' },
        h('div', { 'class': 'round-head' }, t('p', { 'class': 'sub' }, p + 'label'), t('h2', null, p + 'question')),
        t('p', { 'class': 'narration' }, p + 'narration'),
        t('p', { 'class': 'sub options-sub' }, p + 'optionsLabel'), opts,
        t('p', { 'class': 'sub facts-sub' }, p + 'factsLabel'), facts));
    });

    var lines = h('div', { 'class': 'lines' });
    for (var n = 0; n < data.planLines; n++) lines.appendChild(h('p', { 'class': 'line' }, h('span', { 'class': 'k' }, String(n + 1))));
    frag.appendChild(h('section', { 'class': 'plan' }, t('h2', null, 'planHeading'), t('p', { 'class': 'measure intro' }, 'planIntro'), lines));

    app.textContent = '';
    app.appendChild(frag);
    app.classList.toggle('editing', editing);
    if (editing) bindEditable();
  }

  function bindEditable() {
    var plain = (function () { var d = document.createElement('div'); d.contentEditable = 'plaintext-only'; return d.contentEditable === 'plaintext-only'; })();
    app.querySelectorAll('[data-path]').forEach(function (el) {
      el.contentEditable = plain ? 'plaintext-only' : 'true';
      el.spellcheck = false;
      el.addEventListener('input', function () {
        set(el.getAttribute('data-path'), el.textContent.replace(/\s*\n\s*/g, ' '));
        dirty = true;
        setStatus('Unsaved changes');
      });
      el.addEventListener('paste', function (ev) {
        if (plain) return;
        ev.preventDefault();
        var text = (ev.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*\n\s*/g, ' ');
        document.execCommand('insertText', false, text);
      });
    });
  }

  function setStatus(msg) { statusEl.textContent = msg; }
  function setMode(on) {
    editing = on;
    editBtn.hidden = on;
    saveBtn.hidden = !on;
    discardBtn.hidden = !on;
    render();
    setStatus(on ? 'Click any line to change it, then Save.' : '');
  }

  editBtn.addEventListener('click', function () { setMode(true); });
  discardBtn.addEventListener('click', function () {
    data = JSON.parse(JSON.stringify(saved));
    dirty = false;
    setMode(false);
  });
  saveBtn.addEventListener('click', function () {
    if (!artifact) { setStatus('Saving is not available in this view.'); return; }
    saveBtn.disabled = true;
    setStatus('Saving');
    var body = JSON.stringify(data, null, 2);
    artifact.publish({ 'data/sheet.json': { content: body, contentType: 'application/json' } }).then(function () {
      saved = JSON.parse(body);
      dirty = false;
      saveBtn.disabled = false;
      setMode(false);
      setStatus('Saved');
    }, function (err) {
      saveBtn.disabled = false;
      var code = err && err.code;
      if (code === 'not_writer' || code === 'not_granted' || code === 'not_declared') {
        setStatus('This view is read-only; your changes stay on screen but are not saved.');
      } else if (code === 'conflict') {
        setStatus('Someone saved a newer version; this page is reloading to it.');
      } else if (code === 'capability_disabled') {
        setStatus('Saving is not available here. Copy JSON keeps your changes.');
      } else {
        setStatus('Could not save (' + (code || 'error') + '). Copy JSON keeps your changes.');
      }
    });
  });
  copyBtn.addEventListener('click', function () {
    var body = JSON.stringify(data, null, 2);
    var done = function () { setStatus('Copied the sheet as JSON.'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(body).then(done, function () { fallbackCopy(body); done(); });
    } else { fallbackCopy(body); done(); }
  });
  function fallbackCopy(text) {
    var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-9999px' }, text);
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) {}
    ta.remove();
  }

  render();

  // The saved data file wins over the copy embedded in the page, once it answers.
  fetch('data/sheet.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (fresh) {
    if (!fresh || editing) return;
    var text = JSON.stringify(fresh);
    if (text === JSON.stringify(saved)) return;
    saved = fresh;
    data = JSON.parse(text);
    render();
  }).catch(function () {});

  // Editing lights up only in a viewer that can save this page.
  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('artifact').then(function (ns) {
      if (!ns) return;
      artifact = ns;
      toolbar.hidden = false;
    }).catch(function () {});
  }
})();
</script>
"""


def page_html(m: dict) -> str:
    """The page as the Artifact tool wants it: no doctype, head or body of its own."""
    def embed(obj) -> str:
        return json.dumps(obj, ensure_ascii=False).replace("</", "<\\/")
    return (PAGE.replace("__DATA__", embed(m))
                .replace("__PALETTE__", embed(PALETTE))
                .replace("__FIGURES__", embed(FIGURES))
                .replace("__ICONS__", embed(ICONS)))


def guard(text: str) -> None:
    # The two dashes are built from their code points, so this file holds neither of the characters it bans.
    for bad, name in ((chr(0x2014), "em dash"), (chr(0x2013), "en dash")):
        if bad in text:
            sys.exit(f"{name} in the sheet; the house rule bans it")


def print_pdf(fragment: str, out: pathlib.Path) -> None:
    doc = '<!doctype html><html lang="en"><head><meta charset="utf-8"></head><body>' + fragment + "</body></html>"
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "sheet.html"
        src.write_text(doc)
        r = subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--virtual-time-budget=8000",
                            "--allow-file-access-from-files", "--no-pdf-header-footer",
                            f"--print-to-pdf={out}", src.as_uri()], capture_output=True, text=True)
    if r.returncode != 0 or not out.exists():
        sys.exit("chrome failed: " + r.stderr[-500:])


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "Olkaria character sheet.pdf"))
    ap.add_argument("--data", help="a saved data/sheet.json to build from instead of content/case.json")
    ap.add_argument("--artifact", help="write index.html and data/sheet.json into this directory")
    a = ap.parse_args()
    if a.data:
        m = json.loads(pathlib.Path(a.data).read_text())
    else:
        m = model(json.loads((ROOT / "content/case.json").read_text()))
    fragment = page_html(m)
    guard(fragment)
    if a.artifact:
        d = pathlib.Path(a.artifact)
        (d / "data").mkdir(parents=True, exist_ok=True)
        (d / "index.html").write_text(fragment)
        (d / "data" / "sheet.json").write_text(json.dumps(m, ensure_ascii=False, indent=2) + "\n")
        print(d / "index.html")
    else:
        out = pathlib.Path(a.out)
        print_pdf(fragment, out)
        print(out)


if __name__ == "__main__":
    main()
