#!/usr/bin/env python3
"""Build the character sheet for Olkaria: the Deadlock, as a printable PDF and as an editable artifact page.

One data model, docs/character-sheet/sheet.json (Caleb's own wording, saved back from the artifact), feeds one HTML
page that renders itself from embedded JSON. Headless Chrome prints that page to Letter for the PDF; the same page,
published as an artifact with the `artifact` capability, lets Caleb edit every line in place and save the result as
`data/sheet.json` next to the page. `--data` builds from another such saved file. The role figures are read from
shared/figures.ts and shared/palette.ts at build time, so the sheet draws the same pixels as the game.

Run from anywhere:
  python3 docs/character-sheet/build.py                      # the PDF beside this script, from sheet.json
  python3 docs/character-sheet/build.py --data sheet.json    # the PDF from an edited data file
  python3 docs/character-sheet/build.py --artifact DIR       # DIR/index.html and DIR/data/sheet.json to publish
"""
import argparse
import json
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
HERE = pathlib.Path(__file__).resolve().parent
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def read_palette() -> dict:
    """shared/palette.ts as {name: hex}: every `name: '#rrggbb'` line inside PALETTE."""
    text = (ROOT / "shared/palette.ts").read_text()
    body = text[text.index("export const PALETTE"):]
    body = body[:body.index("} as const")]
    pal = dict(re.findall(r"^\s*(\w+):\s*'(#[0-9a-fA-F]{6})'", body, re.M))
    if not pal:
        sys.exit("no colours found in shared/palette.ts")
    return pal


def read_figures(pal: dict) -> dict:
    """shared/figures.ts as {role: [[x, y, w, h, hex], ...]}, run-length encoded the way its drawn() does it: each
    `const NAME = drawn('skin', [rows])` is FIGURE_H rows of FIGURE_W keys, a key's colour comes from INK (or the
    figure's skin for `k`), `.` is empty, and each run of one key along a row is one rectangle."""
    text = (ROOT / "shared/figures.ts").read_text()
    w = int(re.search(r"FIGURE_W\s*=\s*(\d+)", text).group(1))
    h = int(re.search(r"FIGURE_H\s*=\s*(\d+)", text).group(1))
    ink_src = re.search(r"const INK[^=]*=\s*\{(.*?)\};", text, re.S).group(1)
    ink = dict(re.findall(r"(\w):\s*'(\w+)'", ink_src))
    consts = {}
    for name, skin, rows_src in re.findall(r"const (\w+) = drawn\('(\w+)',\s*\[(.*?)\]\);", text, re.S):
        rows = re.findall(r"'([^']*)'", rows_src)
        if len(rows) != h or any(len(r) != w for r in rows):
            sys.exit(f"figure {name} in shared/figures.ts is not {w} x {h}")
        rects = []
        for y, row in enumerate(rows):
            x = 0
            while x < w:
                key, end = row[x], x + 1
                while end < w and row[end] == key:
                    end += 1
                if key != ".":
                    shade = skin if key == "k" else ink.get(key)
                    if shade not in pal:
                        sys.exit(f"no colour for {key!r} in figure {name}")
                    rects.append([x, y, end - x, 1, pal[shade]])
                x = end
        consts[name] = rects
    table = re.search(r"export const FIGURES[^=]*=\s*\{(.*?)\};", text, re.S).group(1)
    figs = {role: consts[const] for role, const in re.findall(r"(\w+):\s*(\w+)", table)}
    if sorted(figs) != sorted(["citizen", "government", "business", "microsoft"]):
        sys.exit("shared/figures.ts does not give the four role figures")
    return {"w": w, "h": h, "figures": figs}


# The world's palette from shared/palette.ts, plus option colours A and B from host/hud/Hud.ts for the stat icons.
PALETTE = {**read_palette(), "rose": "#b5473d", "sky": "#3f6fa3"}
FIGURES = read_figures(PALETTE)

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

PAGE = r"""<meta name="claude:viewport-fit-sides" content="cover">
<title>Olkaria character sheet</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap">
<style>
/* Layout: one reading column; a 2 by 2 party grid, then each question a stacked block with its three options in a
   grid. Print collapses to Letter and adds the plan's writing lines; on screen there are no blank fields (Caleb,
   3 November). */
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
/* The figure is 16 by 20 pixels, drawn at 2 or 2.5 screen pixels each, inside a tile with room on every side. */
.role .tile{ align-self:center; width:58px; height:58px; border-radius:var(--r-sm); background:var(--tile); display:grid; place-items:center; }
.role .tile svg{ width:40px; height:50px; shape-rendering:crispEdges; display:block; }
/* The eyebrow and title sit centred on the figure. The height fits a two-line eyebrow, so every card's stats line up. */
.role .head{ display:flex; flex-direction:column; justify-content:center; min-height:calc(var(--t-cap) * var(--lh-tight) * 2 + 2px + var(--t-h3) * var(--lh-h3)); }
.role .sub{ margin-bottom:2px; }
.role .body{ grid-column:1 / -1; margin-top:var(--s2); }
.role .who{ color:var(--ink-2); }
/* Three stat cells under the blurb, each an icon on a dark tile with its number beside it, then the special as a bar:
   the icon and the move's title. */
.role .stats{ margin-top:var(--s3); display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s2); }
.stat{ display:grid; grid-template-columns:auto minmax(0,1fr); align-items:center; column-gap:var(--s2); padding:var(--s2); border-radius:var(--r-sm); background:var(--surface-2); min-width:0; }
.stat .ico{ width:24px; height:24px; border-radius:6px; background:var(--tile-dark); display:grid; place-items:center; }
.stat .ico svg{ width:16px; height:16px; shape-rendering:crispEdges; display:block; }
.stat-v{ font-size:var(--t-h3); line-height:var(--lh-tight); letter-spacing:var(--tr-h3); font-weight:700; font-variant-numeric:tabular-nums; }
.stat.special{ grid-column:1 / -1; }
.stat.special .stat-title{ font-size:var(--t-body); line-height:var(--lh-tight); font-weight:700; }
.measure{ max-width:var(--measure); }
.rules{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--s5); break-inside:avoid; }
.steps{ margin:0; padding-left:var(--s4); }
.steps li{ margin-bottom:var(--s2); padding-left:var(--s1); }
.steps li::marker{ color:var(--ink-3); font-weight:600; }
.strikes{ margin-bottom:var(--s4); }
.intro{ color:var(--ink-2); }

/* Questions: three options side by side */
.round{ break-inside:avoid; border-top:1px solid var(--line); padding-top:var(--s3); margin-bottom:var(--s4); }
.round-head{ margin-bottom:var(--s2); }
.round-head .sub:empty{ display:none; }
.round-head h2{ color:var(--ink); margin:0; }
.options-sub{ margin-top:var(--s2); }
.options{ list-style:none; margin:0; padding:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--s2) var(--s4); }
/* A line left empty takes no room on the sheet; while editing it stays visible so it can be filled in. */
#app:not(.editing) [data-path]:empty{ display:none; }
.options li{ display:grid; grid-template-columns:auto minmax(0,1fr); column-gap:var(--s2); align-items:start; }
.options p{ margin:0; }
.letter{ display:inline-flex; align-items:center; justify-content:center; width:1.9em; height:1.9em; border-radius:var(--r-sm); background:var(--surface-2); font-weight:700; margin-top:1px; }

/* The plan box */
.plan{ break-inside:avoid; border-top:1px solid var(--line); padding-top:var(--s4); }
.lines{ display:none; margin-top:var(--s4); }   /* writing lines are for paper; the screen stays clean */
.line{ display:flex; align-items:flex-end; gap:var(--s2); height:12mm; border-bottom:1px solid var(--rule); }
.line .k{ color:var(--ink-3); font-size:var(--t-cap); padding-bottom:2px; }
.line + .line{ margin-top:0; }

@media (max-width:560px){
  .grid2, .rules, .options{ grid-template-columns:minmax(0,1fr); }
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
  .role .tile{ width:48px; height:48px; }
  .role .tile svg{ width:32px; height:40px; }
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
  /** A role's figure from shared/figures.ts: rectangles with their colours already resolved to hex. */
  function figure(role) {
    var svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 ' + FIGURES.w + ' ' + FIGURES.h);
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', role + ' figure');
    (FIGURES.figures[role] || []).forEach(function (r) {
      var rect = document.createElementNS(SVG, 'rect');
      rect.setAttribute('x', r[0]); rect.setAttribute('y', r[1]);
      rect.setAttribute('width', r[2]); rect.setAttribute('height', r[3]);
      rect.setAttribute('fill', r[4]);
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
  /** The special, a bar under the three stats: the icon, then the move's title. */
  function special(s, p) {
    return h('div', { 'class': 'stat special', role: 'group', 'aria-label': String(get(p + 'special.k')) },
      h('span', { 'class': 'ico' }, icon(s.icon)),
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
        h('div', { 'class': 'head' }, t('p', { 'class': 'sub' }, p + 'stakeholder'), t('h3', null, p + 'className')),
        h('div', { 'class': 'body' },
          t('p', { 'class': 'who' }, p + 'who'),
          stats)));
    });
    frag.appendChild(h('section', null, t('h2', null, 'partyHeading'), cards));

    var brief = h('div', { 'class': 'measure' });
    data.briefing.forEach(function (_, i) { brief.appendChild(t('p', null, 'briefing.' + i)); });
    frag.appendChild(h('section', null, t('h2', null, 'briefHeading'), brief));

    frag.appendChild(h('section', { 'class': 'strikes' }, t('h2', null, 'strikesHeading'), t('p', { 'class': 'measure intro' }, 'strikesIntro')));

    data.rounds.forEach(function (rd, i) {
      var p = 'rounds.' + i + '.';
      var opts = h('ol', { 'class': 'options' });
      rd.options.forEach(function (o, k) {
        var op = p + 'options.' + k + '.';
        opts.appendChild(h('li', null, t('span', { 'class': 'letter' }, op + 'letter'),
          h('div', null, t('p', null, op + 'screen'))));
      });
      frag.appendChild(h('section', { 'class': 'round' },
        h('div', { 'class': 'round-head' }, t('p', { 'class': 'sub' }, p + 'label'), t('h2', null, p + 'question')),
        t('p', { 'class': 'sub options-sub' }, p + 'optionsLabel'), opts));
    });

    // The plan section only when it has something to show: lines, a heading or an intro. While editing it stays, so
    // an empty heading or intro can still be filled in.
    var planLines = Number(data.planLines) || 0;
    if (editing || planLines > 0 || String(data.planHeading || '') !== '' || String(data.planIntro || '') !== '') {
      var lines = h('div', { 'class': 'lines' });
      for (var n = 0; n < planLines; n++) lines.appendChild(h('p', { 'class': 'line' }, h('span', { 'class': 'k' }, String(n + 1))));
      frag.appendChild(h('section', { 'class': 'plan' }, t('h2', null, 'planHeading'), t('p', { 'class': 'measure intro' }, 'planIntro'), lines));
    }

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
    ap.add_argument("--data", default=str(HERE / "sheet.json"), help="a saved data/sheet.json to build from")
    ap.add_argument("--artifact", help="write index.html and data/sheet.json into this directory")
    a = ap.parse_args()
    m = json.loads(pathlib.Path(a.data).read_text())
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
