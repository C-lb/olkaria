// The projector's text layer: an HTML element laid exactly over the 320 x 180 game canvas. Every word on the
// projector is drawn here, never on the canvas (spec 7), so it wraps, stays crisp, and scales with --zoom. One method
// per screen, each building its screen from its arguments alone. Nothing from the room or a player goes through
// innerHTML. Layers, bottom to top: the screen, the rally flash, the banner with the toasts under it, the key map.
import { OPTION_IDS, ROLES, type OptionId, type Role } from '../../shared/types';

/** The option colours, bound to the letters everywhere: badges, bars, the banner letter, the strike flash (spec 7). */
export const OPTION_COLORS: Record<OptionId, string> = { A: '#b5473d', B: '#3f6fa3', C: '#c9a227', D: '#4f8a5b' };

export interface LobbyArgs {
  /** The join QR as a data URL; null while it is being drawn, and offline. */
  qrDataUrl: string | null;
  /** The room code; empty until the room is known. */
  code: string;
  joinUrl: string;
  count: number;
  roleCounts: Record<Role, number>;
  /** The singular class name of each role ("Knight"); the counts read "Knights 2". */
  classNames: Record<Role, string>;
  /** The last eight joiners as "Ann, Knight", newest first; empty when names are hidden. */
  recent: string[];
  offline: boolean;
  /** The bare quotes; the speakers and citations are fixed here (spec 5.6). */
  smith: string;
  tanui: string;
}

export interface NarrationArgs {
  boss: string;
  title: string;
  narration: string;
  /** Shown as given: the caller passes the quote with its marks, speaker and citation. */
  quote?: string;
  footer: string;
}

export interface OptionsArgs {
  options: { letter: OptionId; screen: string }[];
  /** The lead class in the plural ("Rogues"): the status line and the label of each card's lead bar. */
  leadLabel: string;
  timerText: string;
  votedText: string;
  /** Null while the vote is open: the split stays hidden until the lock (spec 3.2). */
  leadShares: Record<OptionId, number> | null;
  supportShares: Record<OptionId, number> | null;
  footer: string;
  /** The call-outs already judged this round ("Sarah: +10 rally"), listed small under the cards. Absent or empty lists nothing. */
  resolved?: string[];
}

/** The two parts of the options' status line that change while the cards stay: the clock and the vote count. */
export interface OptionsStatus { timerText: string; votedText: string }

/** The call-out. No name is a hand call-out: the facilitator picks someone in the room. */
export interface BannerArgs { name: string | null; letter: OptionId | null; phone: string | null; footer: string }

/** The parts of a round's damage. `cap` is the most one round can drain (`scoring.roundHp`), named when `capped`. */
export interface Breakdown { base: number; focus: number; alignment: number; exhibit: number; rally: number; total: number; capped: boolean; cap: number }

export interface DebriefArgs {
  lines: { letter: OptionId; damage: number; text: string }[];
  breakdown: Breakdown;
  alignment: string;
  rally: string | null;
  discuss: string;
}

export interface EndingArgs {
  title: string;
  tier: string;
  /** Round 4's votes per option, as counts or shares: each bar is the option's part of the whole. */
  split: Record<OptionId, number>;
  /** Stored lowercase in the content; each bullet is capitalised here. */
  mustBeTrue: string[];
  risk: string[];
  /** For "the Deadlock holds": per round, "Round 1", what the class chose, and the letters the final pick needed ("B or D"). */
  holds: { round: string; chose: string; needed: string }[] | null;
}

export interface LeaderboardArgs {
  rows: { name: string; className: string; score: number }[];
  consistent: string;
  table: string | null;
  split: Record<OptionId, number>;
  question: string;
}

const TITLE = 'Olkaria: the Deadlock';
const SMITH = 'Brad Smith, Microsoft (Vimal, 2026)';
const TANUI = 'PS John Tanui (James, 2026; Vimal, 2026)';

/** How long a toast stays when no time is given. */
const TOAST_MS = 4000;
/** How long a rally flash stays when no time is given. */
const FLASH_MS = 1500;

/** The facilitator's keys (spec 6.5), for the key map behind Esc. */
const KEYS: readonly (readonly [string, string])[] = [
  ['Space', 'Advance: start, open the vote, lock, reveal, next'],
  ['1 to 4', 'Add a vote for A to D'],
  ['Shift+1 to 4', 'Add ten votes'],
  ['B', 'Add 30 bot votes'],
  ['C', 'Call a student out, once the vote is locked'],
  ['Y or N', 'Judge the call-out: convincing or not'],
  ['R', 'Reopen a locked vote, or extend an open one'],
  ['H', 'Hide or show names'],
  ['F', 'Fullscreen'],
  ['Arrows', 'Move and jump in travel; Space jumps too'],
  ['A', 'Auto-run in travel'],
  ['N', 'Skip to the arena in travel'],
  ['Shift+R twice', 'Reset to the lobby'],
  ['Esc', 'Show or hide these keys'],
];

// ---- Builders ---------------------------------------------------------------------------------------

type Kid = Node | string | false | null | undefined;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  for (const kid of kids) {
    if (kid !== false && kid !== null && kid !== undefined) el.append(kid);
  }
  return el;
}

/** At most one decimal and no trailing zero: 62.5, 73.3, 10. */
function num(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const r = Math.round(n * 10) / 10;
  return r === 0 ? '0' : String(r);   // also turns -0 into 0
}

/** A bonus: "+10" when there is one, "0" when there is not. */
const plus = (n: number): string => (n > 0 ? `+${num(n)}` : num(n));

const clampShare = (share: number): number => (Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0);

/** A share from 0 to 1 as a CSS width, exact to one decimal: "33.3%". */
const pct = (share: number): string => `${num(clampShare(share) * 100)}%`;

/** A share in figures for the room to read: whole percentages, "33%". */
const pctText = (share: number): string => `${Math.round(clampShare(share) * 100)}%`;

/** The text with its first letter in capitals: the room's refusals and the content's bullets are stored lowercase. */
export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "Base 62.5, Focus 0, Party aligned +10, Exhibits +10, Rally 0. Total 83", the sum the strike just drew (spec 3.2), then " (capped at 100)" if it passed the cap. */
function breakdownText(b: Breakdown): string {
  const parts = [`Base ${num(b.base)}`, `Focus ${plus(b.focus)}`, `Party aligned ${plus(b.alignment)}`, `Exhibits ${plus(b.exhibit)}`, `Rally ${plus(b.rally)}`];
  return `${parts.join(', ')}. Total ${num(b.total)}${b.capped ? ` (capped at ${num(b.cap)})` : ''}`;
}

/** Marks `el` as option `letter`: its colour as --option, and data-option, from which the stylesheet takes the ink. */
function tint<E extends HTMLElement>(el: E, letter: OptionId): E {
  el.setAttribute('data-option', letter);
  el.style.setProperty('--option', OPTION_COLORS[letter]);
  return el;
}

/** The letter on a square of its colour. */
function badge(letter: OptionId, size = ''): HTMLElement {
  return tint(h('span', { class: size === '' ? 'badge' : `badge ${size}` }, letter), letter);
}

/** A flat slate panel, the surface every screen is built on. */
function panel(cls: string, ...kids: Kid[]): HTMLElement {
  return h('section', { class: `panel ${cls}` }, ...kids);
}

/** A track filled to `share` and the share in whole percent. The fill takes the colour of the option it sits under. */
function meter(share: number, kind?: string): [HTMLElement, HTMLElement] {
  const fill = h('span', kind === undefined ? { class: 'bar-fill' } : { class: 'bar-fill', 'data-bar': kind });
  fill.style.width = pct(share);
  return [h('span', { class: 'bar-track' }, fill), h('span', { class: 'bar-value' }, pctText(share))];
}

/** One of a card's two bars: who voted ("Rogues" or "Party"), then the meter. */
function bar(kind: 'lead' | 'support', label: string, share: number): HTMLElement {
  return h('div', { class: 'bar' }, h('span', { class: 'bar-label' }, label), ...meter(share, kind));
}

/** Votes per option, counts or shares, as one row per letter: each option's part of the whole. */
function split(values: Record<OptionId, number>): HTMLElement {
  const part = (o: OptionId): number => (Number.isFinite(values[o]) ? Math.max(0, values[o]) : 0);
  const total = OPTION_IDS.reduce((sum, o) => sum + part(o), 0);
  return h('ul', { class: 'split' }, ...OPTION_IDS.map((o) =>
    tint(h('li', { class: 'split-row' }, badge(o, 'is-row'), ...meter(total > 0 ? part(o) / total : 0)), o)));
}

/** A quote, then who said it. */
function quote(text: string, who: string): HTMLElement {
  return h('p', { class: 'quote' }, `“${text}”`, ' ', h('span', { class: 'cite' }, who));
}

function keymap(): HTMLElement {
  return h('div', { class: 'hud-keymap', role: 'dialog', 'aria-label': 'Keys' },
    h('section', { class: 'keymap' },
      h('h2', { class: 'title' }, 'Keys'),
      h('ul', { class: 'keys' }, ...KEYS.map(([key, what]) => h('li', { class: 'key-row' }, h('span', { class: 'key' }, key), h('span', {}, what))))));
}

// ---- The HUD ----------------------------------------------------------------------------------------

export class Hud {
  private readonly screen = h('div', { class: 'hud-screen' });
  private readonly flash = h('div', { class: 'hud-flash' });
  private readonly banner = h('div', { class: 'banner', role: 'status' });
  private readonly toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  private keys: HTMLElement | null = null;
  /** The two toast slots: one that stays until replaced or cleared, and one that times out. */
  private sticky: HTMLElement | null = null;
  private timed: { el: HTMLElement; timer: ReturnType<typeof setTimeout> } | null = null;
  private flashTimer: ReturnType<typeof setTimeout> | null = null;
  /** The QR image, kept across lobby refreshes so a new joiner does not make it decode again. */
  private qr: HTMLImageElement | null = null;
  /** The clock and the vote count of the options' status line while the options are up, for updateOptionsStatus(). */
  private status: { timer: HTMLElement; voted: HTMLElement } | null = null;

  constructor(private readonly root: HTMLElement) {
    this.banner.hidden = true;
    root.classList.add('hud');
    root.replaceChildren(this.screen, this.flash, h('div', { class: 'hud-top' }, this.banner, this.toasts));
  }

  /** The lobby: title and quotes, the QR (or the offline notice), the code and address, the counts, the newest names. */
  showLobby(a: LobbyArgs): void {
    const connecting = !a.offline && a.code === '';
    let join: HTMLElement;
    if (a.offline) {
      join = h('div', { class: 'join' },
        h('p', { class: 'join-title' }, 'Offline mode'),
        h('p', {}, 'Phones cannot join. 1 to 4 add a vote, Shift adds ten, B adds 30 bots.'));
    } else if (a.qrDataUrl !== null) {
      join = this.qrImage(a.qrDataUrl);
    } else {
      join = h('div', { class: 'join' }, h('p', { class: 'hint' }, connecting ? 'Connecting to the room' : 'Join at the address'));
    }
    const room = a.offline || connecting ? [] : [
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Scan, or go to'), h('p', { class: 'join-url' }, a.joinUrl.replace(/^https?:\/\//, ''))),
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Room'), h('p', { class: 'code' }, a.code)),
    ];
    const counts = h('div', { class: 'stack' },
      h('p', { class: 'joined' }, `${a.count} joined`),
      h('ul', { class: 'counts' }, ...ROLES.map((role) => h('li', {}, `${a.classNames[role]}s `, h('b', {}, String(a.roleCounts[role]))))));
    const recent = h('div', { class: 'stack' },
      h('p', { class: 'eyebrow' }, 'Just joined'),
      a.recent.length > 0
        ? h('ol', { class: 'recent' }, ...a.recent.map((who) => h('li', {}, who)))
        // Players but no names means the names are hidden (H); the caller empties the list then.
        : h('p', { class: 'muted' }, a.count > 0 ? 'Names hidden' : 'No one yet'));
    this.show(panel('lobby',
      h('header', { class: 'lobby-head' },
        h('div', { class: 'stack' }, h('h1', { class: 'title' }, TITLE), quote(a.smith, SMITH)),
        h('p', { class: 'hint lobby-hint' }, 'Space starts the game. Esc shows every key.')),
      h('div', { class: 'lobby-body' }, join, h('div', { class: 'stack lobby-info' }, ...room, counts), recent),
      quote(a.tanui, TANUI)));
  }

  /** Before the vote: the boss, the question, the situation ending in the lead class's call to strike. */
  showNarration(a: NarrationArgs): void {
    this.show(panel('narration',
      h('p', { class: 'eyebrow' }, a.boss),
      h('h1', { class: 'title' }, a.title),
      h('p', { class: 'narration-text' }, a.narration),
      a.quote ? h('p', { class: 'quote' }, a.quote) : null,
      a.footer ? h('p', { class: 'hint' }, a.footer) : null));
  }

  /**
   * The four cards in a 2 x 2 grid over the lower 45% of the screen, in letter order, under a status line with the
   * lead class, the timer and the vote count. After the lock each card gets two bars: the lead class's split and the
   * rest of the party's. The judged call-outs, if any, go in one small line under the cards. Leaves a call-out banner up.
   */
  showOptions(a: OptionsArgs): void {
    const cards = [...a.options]
      .sort((x, y) => OPTION_IDS.indexOf(x.letter) - OPTION_IDS.indexOf(y.letter))
      .map((o) => {
        const bars: HTMLElement[] = [];
        if (a.leadShares !== null) bars.push(bar('lead', a.leadLabel, a.leadShares[o.letter]));
        if (a.supportShares !== null) bars.push(bar('support', 'Party', a.supportShares[o.letter]));
        // A card with bars says so: its text then gets fewer lines before the clamp (hud.css), so it never covers them.
        return tint(h('article', { class: bars.length > 0 ? 'card has-bars' : 'card', 'data-card': o.letter },
          badge(o.letter),
          h('p', { class: 'card-text' }, o.screen),
          bars.length > 0 ? h('div', { class: 'bars' }, ...bars) : null), o.letter);
      });
    // The clock and the count are always there, hidden while empty, so updateOptionsStatus() can fill them in later.
    const timer = h('span', { class: 'timer' });
    const voted = h('span', {});
    const resolved = a.resolved ?? [];
    this.show(h('div', { class: resolved.length > 0 ? 'options has-resolved' : 'options' },
      h('div', { class: 'panel status' },
        a.leadLabel ? h('span', { class: 'status-lead' }, `${a.leadLabel} lead`) : null,
        timer,
        voted,
        a.footer ? h('span', { class: 'hint status-hint' }, a.footer) : null),
      h('div', { class: 'cards' }, ...cards),
      resolved.length > 0 ? h('ul', { class: 'resolved' }, ...resolved.map((note) => h('li', {}, note))) : null), true);
    this.status = { timer, voted };
    this.updateOptionsStatus(a);
  }

  /** Puts a new clock and vote count on the options' status line without rebuilding the cards. Does nothing unless the options are up. */
  updateOptionsStatus(a: OptionsStatus): void {
    if (this.status === null) return;
    for (const [el, value] of [[this.status.timer, a.timerText], [this.status.voted, a.votedText]] as const) {
      el.textContent = value;
      el.hidden = value === '';
    }
  }

  /** The call-out banner at the top: "Sarah, defend B: Yes to 60 to 100 MW, tied", or a hand call-out. Null hides it. */
  showBanner(a: BannerArgs | null): void {
    if (a === null) {
      this.banner.hidden = true;
      this.banner.replaceChildren();
      return;
    }
    let line: Kid[];
    if (a.name !== null && a.letter !== null) line = [`${a.name}, defend `, badge(a.letter, 'is-inline'), a.phone ? `: ${a.phone}` : ''];
    else if (a.name !== null) line = [`${a.name}, defend your choice`];
    else line = ['Hand call-out. Who defends their choice?'];
    this.banner.replaceChildren(h('p', { class: 'banner-line' }, ...line));
    if (a.footer) this.banner.append(h('p', { class: 'hint' }, a.footer));
    this.banner.hidden = false;
  }

  /** A short flash in the middle of the screen: a bonus ("+10 rally") in torch amber, anything else ("no bonus") in grey. */
  flashRally(text: string, ms = FLASH_MS): void {
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flash.replaceChildren(h('p', { class: /\+\s*\d/.test(text) ? 'flash is-bonus' : 'flash' }, text));
    this.flashTimer = setTimeout(() => {
      this.flash.replaceChildren();
      this.flashTimer = null;
    }, ms);
  }

  /** After the strike: what each option did, the breakdown of the damage, the alignment, the rally, the discuss line. */
  showDebrief(a: DebriefArgs): void {
    const lines = a.lines.map((line) => tint(h('li', { class: 'debrief-line', 'data-debrief-line': line.letter },
      badge(line.letter, 'is-row'),
      h('span', { class: 'debrief-damage' }, Number.isFinite(line.damage) ? line.damage.toFixed(1) : '0.0'),
      h('span', { class: 'debrief-text' }, line.text)), line.letter));
    this.show(panel('debrief',
      h('p', { class: 'eyebrow' }, 'Debrief'),
      lines.length > 0 ? h('ol', { class: 'debrief-lines' }, ...lines) : null,
      lines.length > 0 ? h('div', { class: 'sep' }) : null,
      h('p', { class: 'breakdown' }, breakdownText(a.breakdown)),
      a.alignment ? h('p', {}, a.alignment) : null,
      a.rally ? h('p', {}, a.rally) : null,
      a.discuss ? h('p', { class: 'discuss' }, `Discuss: ${a.discuss}`) : null));
  }

  /** The ending: its tier and title, what must be true and the risk accepted (or, if the Deadlock holds, why), the round 4 split. */
  showEnding(a: EndingArgs): void {
    const bullets = (heading: string, items: string[]): HTMLElement | null => (items.length === 0 ? null : h('div', { class: 'stack' },
      h('p', { class: 'eyebrow' }, heading),
      h('ul', { class: 'bullets' }, ...items.map((item) => h('li', {}, capitalise(item))))));
    const holds = a.holds === null || a.holds.length === 0 ? null : h('ol', { class: 'holds' }, ...a.holds.map((row) =>
      h('li', { class: 'holds-row' }, h('span', { class: 'holds-round' }, row.round), h('span', {}, row.chose), h('span', { class: 'holds-needed' }, `Needed: ${row.needed}`))));
    this.show(panel('ending',
      a.tier ? h('p', { class: 'eyebrow' }, capitalise(a.tier)) : null,
      h('h1', { class: 'title' }, a.title),
      h('div', { class: 'ending-body' },
        h('div', { class: 'stack ending-text' }, holds, bullets('What must be true', a.mustBeTrue), bullets('The risk you accepted', a.risk)),
        h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, 'Round 4 split'), split(a.split)))));
  }

  /** The closing screen: the top five, the awards, and the final split under the question the discussion picks up. */
  showLeaderboard(a: LeaderboardArgs): void {
    const rows = a.rows.length === 0 ? h('p', { class: 'muted' }, 'No scores yet') : h('ol', { class: 'board' }, ...a.rows.map((row, i) =>
      h('li', { class: 'board-row' },
        h('span', { class: 'board-rank' }, String(i + 1)),
        h('span', { class: 'board-name' }, row.name),
        h('span', { class: 'board-class' }, row.className),
        h('span', { class: 'board-score' }, String(Math.round(row.score))))));
    this.show(panel('leaderboard',
      h('div', { class: 'stack' }, h('p', { class: 'eyebrow' }, a.rows.length > 0 ? `Top ${a.rows.length}` : 'Top players'), rows, h('p', {}, a.consistent), a.table ? h('p', {}, a.table) : null),
      h('div', { class: 'stack' }, h('h1', { class: 'title' }, a.question), split(a.split))));
  }

  /**
   * A message under the banner, in one of two slots. A timed toast (`ms` defaults to 4 s) replaces the timed one before
   * it and goes by itself; the same text again keeps it up from now. A sticky toast (`ms` of 0, or Infinity) replaces
   * the sticky one before it and stays, above the timed one, until the next sticky toast, clearToast() or clear().
   * Neither kind ever takes down the other.
   */
  showToast(text: string, ms = TOAST_MS): void {
    if (!(Number.isFinite(ms) && ms > 0)) {
      if (this.sticky?.textContent === text) return;
      this.clearToast();
      this.sticky = h('p', { class: 'toast' }, text);
      this.toasts.prepend(this.sticky);
      return;
    }
    let el: HTMLElement;
    if (this.timed !== null && this.timed.el.textContent === text) {
      clearTimeout(this.timed.timer);
      el = this.timed.el;
    } else {
      this.dropTimed();
      el = h('p', { class: 'toast' }, text);
      this.toasts.append(el);
    }
    const timer = setTimeout(() => {
      if (this.timed?.el === el) this.dropTimed();
    }, ms);
    this.timed = { el, timer };
  }

  /** Takes down the sticky toast, if one is up. The timed one stays. */
  clearToast(): void {
    this.sticky?.remove();
    this.sticky = null;
  }

  /**
   * The facilitator's key map, on a scrim over the screen and the rally flash. The banner and the toasts stay above the
   * scrim, and the panel sits low so they do not cover it. clear() leaves the key map as it is.
   */
  showKeymap(show: boolean): void {
    if (show && this.keys === null) {
      this.keys = keymap();
      this.root.append(this.keys);
    }
    if (this.keys !== null) this.keys.hidden = !show;
  }

  /** Empties the screen and takes down the banner, the flash and every toast. */
  clear(): void {
    this.screen.replaceChildren();
    this.status = null;
    this.showBanner(null);
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flashTimer = null;
    this.flash.replaceChildren();
    this.dropTimed();
    this.clearToast();
  }

  /** Puts up a screen. Every screen but the options takes the call-out banner down. */
  private show(node: HTMLElement, keepBanner = false): void {
    this.status = null;   // showOptions() sets it again for its own screen
    this.screen.replaceChildren(node);
    if (!keepBanner) this.showBanner(null);
  }

  private qrImage(src: string): HTMLImageElement {
    if (this.qr === null || this.qr.getAttribute('src') !== src) this.qr = h('img', { class: 'qr', src, alt: 'Scan to join' });
    return this.qr;
  }

  private dropTimed(): void {
    if (this.timed === null) return;
    clearTimeout(this.timed.timer);
    this.timed.el.remove();
    this.timed = null;
  }
}
