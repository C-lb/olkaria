// The projector's text layer: an HTML element laid exactly over the 320 x 180 game canvas. Every word on the
// projector is drawn here, never on the canvas (spec 7), so it wraps, stays crisp, and scales with --zoom. One method
// per screen, each building its screen from its arguments alone. Nothing from the room or a player goes through
// innerHTML. Layers, bottom to top: the screen, the flash, the menu on its scrim or the how-to on its full-bleed
// dialog (host/hud/HowTo.ts), the banner with the toasts under it.
import { figureSvg } from '../../shared/figures';
import { OPTION_SHAPE, SHAPE_MARKUP } from '../../shared/shapes';
import { OPTION_IDS, ROLES, type OptionId, type Role, type Tally } from '../../shared/types';
import type { QuestionArgs } from '../strikers';
import { howToPanel, type HowToArgs } from './HowTo';

/** The option colours, bound to the letters everywhere: badges, bars and the banner letter (spec 7). */
export const OPTION_COLORS: Record<OptionId, string> = { A: '#b5473d', B: '#3f6fa3', C: '#c9a227' };

export interface LobbyArgs {
  /** The join QR as a data URL; null while it is being drawn, and offline. */
  qrDataUrl: string | null;
  /** The address phones join at; empty until the room is known (the lobby says it is connecting), and offline. */
  joinUrl: string;
  count: number;
  roleCounts: Record<Role, number>;
  /** Each role's name from the content ("Satya Nadella"); the tiles read "Satya Nadella 2". */
  roleNames: Record<Role, string>;
  /** The last eight joiners as "Ann, Citizen", newest first; empty when names are hidden. */
  recent: string[];
  offline: boolean;
}

export interface OptionsArgs {
  /** "Question 2 of 5: Demand". */
  eyebrow: string;
  question: string;
  options: { letter: OptionId; text: string }[];
  timerText: string;
  votedText: string;
  /** Null while the vote is open. Once locked: each option's share and count, one bar per card. */
  split: { shares: Record<OptionId, number>; counts: Tally } | null;
  footer: string;
  /** The call-outs judged a valid point this round ("Valid point: Ann"), listed small under the cards. */
  called?: string[];
}

/** The two parts of the options' status line that change while the cards stay: the clock and the vote count. */
export interface OptionsStatus { timerText: string; votedText: string }

/** The call-out. No name is a hand call-out: the facilitator picks someone in the room. */
export interface BannerArgs { name: string | null; letter: OptionId | null; footer: string }

/**
 * The ending: the title and the line under it, the last question, and one column per option with its full text, how
 * many picked it, and the names of those who did (at most a screenful, then "and N more").
 */
export interface EndingArgs { title: string; text: string; question: string; columns: { letter: OptionId; text: string; count: number; names: string[]; more: number }[] }

/** One of the menu's buttons. An armed one reads "Sure?" until it is pressed again or the arming lapses (host/menu.ts). */
export interface MenuButton { id: string; label: string; hint?: string; enabled: boolean; armed: boolean }

/** The menu's two rows, the line under the stages, and what a press on a button or a click on the scrim does. */
export interface MenuArgs { actions: MenuButton[]; stages: MenuButton[]; stagesHint: string; onPick: (id: string) => void; onClose: () => void }

/** The game's name and the rest of its title, which the lobby sets on two lines; TITLE joins them for the heading's label. */
const NAME = 'Olkaria';
const SUBTITLE = 'the Deadlock';
const TITLE = `${NAME}: ${SUBTITLE}`;

/** How long a toast stays when no time is given. */
const TOAST_MS = 4000;
/** How long a flash stays when no time is given. */
const FLASH_MS = 2500;

/** The facilitator's keys (spec 6.5), for the key map in the menu: exactly the ones that work. */
const KEYS: readonly (readonly [string, string])[] = [
  ['Space', 'Advance: start, open the vote, lock, strike, next'],
  ['1 to 3', 'Add a hand vote for A to C'],
  ['Shift+1 to 3', 'Add ten hand votes'],
  ['B', 'Add 30 bot votes'],
  ['C', 'Call a student out, once the vote is locked'],
  ['Y or N', 'Judge the call-out: valid point or move on'],
  ['R', 'Reopen a locked vote, or extend an open one'],
  ['H', 'Hide or show names'],
  ['F', 'Fullscreen'],
  ['S', 'Sound off or on'],
  ['Shift+R twice', 'Reset to the lobby'],
  ['?', 'How to play'],
  ['M or Esc', 'This menu'],
];

// ---- Builders ---------------------------------------------------------------------------------------

export type Kid = Node | string | false | null | undefined;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
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

const clampShare = (share: number): number => (Number.isFinite(share) ? Math.min(1, Math.max(0, share)) : 0);

/** A share from 0 to 1 as a CSS width, exact to one decimal: "33.3%". */
const pct = (share: number): string => `${num(clampShare(share) * 100)}%`;

/** A share in figures for the room to read: whole percentages, "33%". */
const pctText = (share: number): string => `${Math.round(clampShare(share) * 100)}%`;

/** The text with its first letter in capitals: the room's refusals are stored lowercase. */
export const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** Marks `el` as option `letter`: its colour as --option, and data-option, from which the stylesheet takes the ink. */
export function tint<E extends HTMLElement>(el: E, letter: OptionId): E {
  el.setAttribute('data-option', letter);
  el.style.setProperty('--option', OPTION_COLORS[letter]);
  return el;
}

/** The shape bound to `letter` (shared/shapes.ts), as an inline SVG in the ink of the badge it sits in. The markup is a constant. */
function shape(letter: OptionId): Element {
  const holder = document.createElement('span');
  const name = OPTION_SHAPE[letter];
  holder.innerHTML = `<svg class="badge-shape" viewBox="0 0 24 24" aria-hidden="true" focusable="false" data-shape="${name}">${SHAPE_MARKUP[name]}</svg>`;
  return holder.firstElementChild as Element;
}

/** The letter, then its shape, on its colour. */
export function badge(letter: OptionId, size = ''): HTMLElement {
  return tint(h('span', { class: size === '' ? 'badge' : `badge ${size}` }, letter, shape(letter)), letter);
}

/** One class figure as an element: figureSvg(role, scale) through a holder, the first element. The markup is a constant. */
export function figure(role: Role, scale: number): Element {
  const holder = document.createElement('span');
  holder.innerHTML = figureSvg(role, scale);
  return holder.firstElementChild as Element;
}

/** A flat slate panel, the surface every screen is built on. */
function panel(cls: string, ...kids: Kid[]): HTMLElement {
  return h('section', { class: `panel ${cls}` }, ...kids);
}

/** A card's one bar: a track filled to the option's share, the share in whole percent, and the count. */
function bar(share: number, count: number): HTMLElement {
  const fill = h('span', { class: 'bar-fill' });
  fill.style.width = pct(share);
  return h('div', { class: 'bar' },
    h('span', { class: 'bar-track' }, fill),
    h('span', { class: 'bar-value' }, pctText(share)),
    h('span', { class: 'bar-count' }, String(Number.isFinite(count) ? Math.max(0, Math.round(count)) : 0)));
}

/** One of the menu's buttons: its label, or "Sure?" while it is armed, then its hint if it has one. */
function menuButton(b: MenuButton, onPick: (id: string) => void): HTMLButtonElement {
  const attrs: Record<string, string> = { class: 'menu-btn', type: 'button', 'data-menu-item': b.id };
  if (b.armed) Object.assign(attrs, { 'data-armed': '', 'aria-label': `Sure? ${b.label}` });
  const el = h('button', attrs, h('span', { class: 'menu-label' }, b.armed ? 'Sure?' : b.label), b.hint ? h('span', { class: 'menu-hint' }, b.hint) : null);
  el.disabled = !b.enabled;
  el.addEventListener('click', () => onPick(b.id));
  return el;
}

/** An eyebrow over a row of buttons, and the note under the row if there is one. */
function menuGroup(eyebrow: string, buttons: MenuButton[], onPick: (id: string) => void, note = ''): HTMLElement {
  return h('section', { class: 'menu-group' },
    h('p', { class: 'eyebrow' }, eyebrow),
    h('div', { class: 'menu-row' }, ...buttons.map((b) => menuButton(b, onPick))),
    note ? h('p', { class: 'hint menu-note' }, note) : null);
}

/** The menu on its scrim: the title, the actions, the stages and the line under them, a rule, then the key map. */
function menuPanel(a: MenuArgs): HTMLElement {
  const scrim = h('div', { class: 'hud-menu', role: 'dialog', 'aria-label': 'Menu' },
    h('section', { class: 'menu' },
      h('h2', { class: 'title' }, 'Menu'),
      menuGroup('Actions', a.actions, a.onPick),
      menuGroup('Go to', a.stages, a.onPick, a.stagesHint),
      h('div', { class: 'sep' }),
      h('ul', { class: 'keys' }, ...KEYS.map(([key, what]) => h('li', { class: 'key-row' }, h('span', { class: 'key' }, key), h('span', {}, what))))));
  // Only a click on the scrim itself closes: a click on the panel or a button has its own element as the target.
  scrim.addEventListener('click', (event) => {
    if (event.target === scrim) a.onClose();
  });
  return scrim;
}

// ---- The HUD ----------------------------------------------------------------------------------------

export class Hud {
  private readonly screen = h('div', { class: 'hud-screen' });
  private readonly flash = h('div', { class: 'hud-flash' });
  private readonly banner = h('div', { class: 'banner', role: 'status' });
  private readonly toasts = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  /** The menu on its scrim while it is up (showMenu). */
  private menu: HTMLElement | null = null;
  /** The how-to on its dialog while it is up (showHowTo). */
  private howto: HTMLElement | null = null;
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

  /**
   * The lobby: the title on two lines and the keycaps; the QR, or in its square the offline notice or a line while
   * there is no QR; the address on two lines, the count and a tile per role; the newest names. No room code and no
   * quote (spec 7).
   */
  showLobby(a: LobbyArgs): void {
    const connecting = !a.offline && a.joinUrl === '';
    let join: HTMLElement;
    if (a.offline) {
      join = h('div', { class: 'join' },
        h('p', { class: 'join-title' }, 'Offline mode'),
        h('p', {}, 'Phones cannot join. 1 to 3 add a vote, Shift adds ten, B adds 30 bots.'));
    } else if (a.qrDataUrl !== null) {
      join = this.qrImage(a.qrDataUrl);
    } else {
      join = h('div', { class: 'join' }, h('p', { class: 'hint' }, connecting ? 'Connecting to the room' : 'Join at the address'));
    }
    // The address without its scheme, split at the first slash: the host, then the path, which ends in the room code.
    const bare = a.joinUrl.replace(/^https?:\/\//, '');
    const slash = bare.indexOf('/');
    const address = a.offline || connecting ? [] : [
      h('p', { class: 'eyebrow' }, 'Scan, or go to'),
      h('p', { class: 'join-url' },
        h('span', { class: 'join-host' }, slash === -1 ? bare : bare.slice(0, slash)),
        h('span', { class: 'join-path' }, slash === -1 ? '' : bare.slice(slash))),
    ];
    const joined = h('p', { class: 'joined' }, h('b', { class: 'joined-n' }, String(a.count)), h('span', { class: 'joined-word' }, ' joined'));
    // A tile per role: its figure, its name, its count. The space keeps the text reading "Citizen 2"; a grid draws no
    // white space between its items, so it takes no column.
    const counts = h('ul', { class: 'counts' }, ...ROLES.map((role) => h('li', { class: 'count' },
      figure(role, 1), h('span', { class: 'count-name' }, a.roleNames[role]), ' ', h('b', {}, String(a.roleCounts[role])))));
    const recent = h('div', { class: 'stack' },
      h('p', { class: 'eyebrow' }, 'Just joined'),
      a.recent.length > 0
        ? h('ol', { class: 'recent' }, ...a.recent.map((who) => h('li', {}, who)))
        // Players but no names means the names are hidden (H); the caller empties the list then.
        : h('p', { class: 'muted' }, a.count > 0 ? 'Names hidden' : 'No one yet'));
    const keycap = (key: string, label: string): HTMLElement => h('li', { class: 'lobby-key' }, h('kbd', { class: 'key' }, key), h('span', {}, label));
    this.show(panel('lobby',
      h('header', { class: 'lobby-head' },
        h('h1', { class: 'title lobby-title', 'aria-label': TITLE }, h('span', { class: 'lobby-name' }, NAME), h('span', { class: 'lobby-sub' }, SUBTITLE)),
        // M opens the menu, as Esc does; the lobby names M, since in fullscreen Chrome takes Esc to leave it (spec 3.1).
        h('ul', { class: 'lobby-keys' }, keycap('Space', 'Start'), keycap('M', 'Shows hotkeys'), keycap('?', 'How to play'))),
      h('div', { class: 'lobby-body' }, join, h('div', { class: 'stack lobby-info' }, ...address, joined, counts), recent)));
  }

  /** The boss's arrival, before the vote: "Question 2 of 5: Demand", the boss, the question in full, what Space does. */
  showQuestion(a: QuestionArgs): void {
    this.show(panel('question',
      h('p', { class: 'eyebrow' }, a.eyebrow),
      h('h1', { class: 'title' }, a.boss),
      h('p', { class: 'question-text' }, a.question),
      a.footer ? h('p', { class: 'hint' }, a.footer) : null));
  }

  /**
   * The vote: a status line (the eyebrow, the clock, the count, the hint), the question, then the three cards in one
   * row, in letter order, each with its full text and never cut. Once locked each card gets one bar: its share and its
   * count. The valid points, if any, go in one small line under the cards. Leaves a call-out banner up.
   */
  showOptions(a: OptionsArgs): void {
    const cards = [...a.options]
      .sort((x, y) => OPTION_IDS.indexOf(x.letter) - OPTION_IDS.indexOf(y.letter))
      .map((o) => tint(h('article', { class: 'card', 'data-card': o.letter },
        h('div', { class: 'card-head' }, badge(o.letter), a.split !== null ? bar(a.split.shares[o.letter], a.split.counts[o.letter]) : null),
        h('p', { class: 'card-text' }, o.text)), o.letter));
    // The clock and the count are always there, hidden while empty, so updateOptionsStatus() can fill them in later.
    const timer = h('span', { class: 'timer' });
    const voted = h('span', { class: 'voted' });
    const called = a.called ?? [];
    this.show(h('div', { class: 'options' },
      h('div', { class: 'panel options-head' },
        h('div', { class: 'status' },
          h('span', { class: 'options-eyebrow' }, a.eyebrow),
          timer,
          voted,
          a.footer ? h('span', { class: 'hint status-hint' }, a.footer) : null),
        h('p', { class: 'options-question' }, a.question)),
      h('div', { class: 'cards' }, ...cards),
      called.length > 0 ? h('ul', { class: 'called' }, ...called.map((note) => h('li', {}, note))) : null), true);
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

  /** The call-out banner: "Ann, defend B" with the letter's badge, a student with no letter, or a hand call-out. Null hides it. */
  showBanner(a: BannerArgs | null): void {
    if (a === null) {
      this.banner.hidden = true;
      this.banner.replaceChildren();
      return;
    }
    let line: Kid[];
    if (a.name !== null && a.letter !== null) line = [`${a.name}, defend `, badge(a.letter, 'is-inline')];
    else if (a.name !== null) line = [`${a.name}, defend your choice`];
    else line = ['Hand call-out. Who defends their choice?'];
    this.banner.replaceChildren(h('p', { class: 'banner-line' }, ...line));
    if (a.footer) this.banner.append(h('p', { class: 'hint' }, a.footer));
    this.banner.hidden = false;
  }

  /** A short flash between the party and the boss, in the accent: "Valid point, Ann!". */
  showFlash(text: string, ms = FLASH_MS): void {
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flash.replaceChildren(h('p', { class: 'flash' }, text));
    this.flashTimer = setTimeout(() => {
      this.flash.replaceChildren();
      this.flashTimer = null;
    }, ms);
  }

  /**
   * The ending: the title and its line at the top (the party hops on the canvas under them), then the last question
   * and a column per option: its badge and count, its full text, and the names of those who picked it in a wrapping
   * flow, then "and N more". A column with no names has no list.
   */
  showEnding(a: EndingArgs): void {
    const columns = [...a.columns]
      .sort((x, y) => OPTION_IDS.indexOf(x.letter) - OPTION_IDS.indexOf(y.letter))
      .map((col) => tint(h('section', { class: 'column', 'data-column': col.letter },
        h('div', { class: 'column-head' }, badge(col.letter), h('b', { class: 'column-count' }, String(col.count))),
        h('p', { class: 'column-text' }, col.text),
        col.names.length > 0 ? h('ul', { class: 'names' }, ...col.names.map((name) => h('li', {}, name))) : null,
        col.more > 0 ? h('p', { class: 'names-more' }, `and ${col.more} more`) : null), col.letter));
    this.show(h('div', { class: 'ending' },
      h('header', { class: 'ending-head' },
        h('h1', { class: 'title ending-title' }, a.title),
        a.text ? h('p', { class: 'ending-text' }, a.text) : null),
      h('div', { class: 'panel ending-body' },
        h('p', { class: 'ending-question' }, a.question),
        h('div', { class: 'columns' }, ...columns))));
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

  /** Takes down the timed toast, if one is up, before its time. The sticky one stays. */
  clearTimedToast(): void {
    this.dropTimed();
  }

  /**
   * The facilitator's menu (host/menu.ts), on a scrim over the screen and the flash. The banner and the toasts
   * stay above the scrim, and the panel sits low so they seldom cover it. Each call draws the menu afresh and keeps
   * the focus on the item that had it, if that item is still enabled; null takes the menu down. clear() leaves it.
   */
  showMenu(a: MenuArgs | null): void {
    const focused = this.focusedMenuItem();
    this.menu?.remove();
    this.menu = a === null ? null : menuPanel(a);
    if (this.menu === null) return;
    this.root.append(this.menu);
    if (focused !== null) this.menuButtons().find((b) => !b.disabled && b.getAttribute('data-menu-item') === focused)?.focus();
  }

  /** Moves the focus through the menu's enabled buttons in reading order, wrapping; with none focused, 1 goes to the first and -1 to the last. */
  moveMenuFocus(step: 1 | -1): void {
    const buttons = this.menuButtons().filter((b) => !b.disabled);
    if (buttons.length === 0) return;
    const at = buttons.findIndex((b) => b === document.activeElement);
    const next = at === -1 ? (step === 1 ? 0 : buttons.length - 1) : (at + step + buttons.length) % buttons.length;
    buttons[next].focus();
  }

  /** The id of the menu item that has the focus; null when none has, or the menu is down. */
  focusedMenuItem(): string | null {
    const el = document.activeElement;
    if (this.menu === null || el === null || !this.menu.contains(el)) return null;
    return el.getAttribute('data-menu-item');
  }

  /** Whether the menu is up. */
  menuOpen(): boolean {
    return this.menu !== null;
  }

  /**
   * The how-to on its full-bleed dialog (host/howto.ts). Each call draws the slide afresh so its motion restarts; null
   * takes it down. clear() leaves it. It sits over the screen and the flash, at the menu's layer, and under the
   * banner and the toasts; a sibling of the screen, so a new screen drawn under it leaves it up.
   */
  showHowTo(a: HowToArgs | null): void {
    this.howto?.remove();
    this.howto = a === null ? null : howToPanel(a);
    if (this.howto !== null) this.root.append(this.howto);
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

  private menuButtons(): HTMLButtonElement[] {
    return this.menu === null ? [] : [...this.menu.querySelectorAll<HTMLButtonElement>('button[data-menu-item]')];
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
