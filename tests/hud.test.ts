// @vitest-environment happy-dom
// tests/hud.test.ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import raw from '../content/case.json';
import { howtoSlides } from '../host/howto';
import { capitalise, Hud, OPTION_COLORS, type EndingArgs, type LobbyArgs, type MenuArgs, type MenuButton, type OptionsArgs } from '../host/hud/Hud';
import { loadContent } from '../shared/content';
import type { OptionId } from '../shared/types';

const c = loadContent(raw);
const q2 = c.rounds[1];

const fresh = (): { root: HTMLElement; hud: Hud } => {
  const root = document.createElement('div');
  return { root, hud: new Hud(root) };
};
const text = (root: ParentNode, selector: string) => root.querySelector(selector)?.textContent ?? null;
// The path is joined by hand: in this environment Vite turns new URL(path, import.meta.url) into a dev-server address.
const css = (path: string): string => readFileSync(join(dirname(fileURLToPath(import.meta.url)), path), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

afterEach(() => { vi.useRealTimers(); });

// ---- The brief's tests --------------------------------------------------------------------------------------

describe('the question over three cards', () => {
  const q = q2.question;
  const options = q2.options.map((o) => ({ letter: o.id, text: o.text }));
  const args: OptionsArgs = {
    eyebrow: 'Question 2 of 5: Demand', question: q, options, timerText: '1:59', votedText: '3 still to vote', split: null, footer: 'Space locks the vote',
  };

  it('shows the question and the three options in full, with no bar while the vote is open', () => {
    const { root, hud } = fresh();
    hud.showOptions(args);
    expect(root.querySelector('.options-question')?.textContent).toBe(q);
    expect(root.querySelectorAll('[data-card]').length).toBe(3);
    expect(root.querySelector('[data-card="C"] .card-text')?.textContent).toBe(options[2].text);
    expect(options[2].text.length).toBeGreaterThanOrEqual(149);   // the longest option, whole
    expect(root.querySelector('.bar')).toBeNull();
    expect(text(root, '.options-eyebrow')).toBe('Question 2 of 5: Demand');
  });

  it('draws one bar a card once locked, with no NaN on an empty tally', () => {
    const { root, hud } = fresh();
    hud.showOptions({ ...args, split: { shares: { A: 0, B: 0, C: 0 }, counts: { A: 0, B: 0, C: 0 } } });
    expect(root.textContent).not.toContain('NaN');
    expect(root.querySelectorAll('.bar').length).toBe(3);
    expect([...root.querySelectorAll('[data-card]')].map((card) => card.querySelectorAll('.bar').length)).toEqual([1, 1, 1]);
  });

  it('reads each card\'s count and share: with counts 2, 5 and 1 card B reads "5" and "63%"', () => {
    const { root, hud } = fresh();
    const counts = { A: 2, B: 5, C: 1 };
    hud.showOptions({ ...args, split: { shares: { A: 2 / 8, B: 5 / 8, C: 1 / 8 }, counts } });
    const b = root.querySelector('[data-card="B"]')!;
    expect(text(b, '.bar-count')).toBe('5');
    expect(text(b, '.bar-value')).toBe('63%');
    expect((b.querySelector('.bar-fill') as HTMLElement).style.width).toBe('62.5%');
    expect(text(root.querySelector('[data-card="A"]')!, '.bar-value')).toBe('25%');
  });

  it('sorts the cards into letter order, whatever order they arrive in, each tinted with its letter', () => {
    const { root, hud } = fresh();
    hud.showOptions({ ...args, options: [options[2], options[0], options[1]] });
    const cards = [...root.querySelectorAll<HTMLElement>('[data-card]')];
    expect(cards.map((card) => card.getAttribute('data-card'))).toEqual(['A', 'B', 'C']);
    expect(cards.map((card) => card.style.getPropertyValue('--option'))).toEqual([OPTION_COLORS.A, OPTION_COLORS.B, OPTION_COLORS.C]);
  });

  it('draws the shape bound to each letter inside its badge, after the letter', () => {
    const { root, hud } = fresh();
    hud.showOptions(args);
    const badges = [...root.querySelectorAll<HTMLElement>('[data-card] .badge')];
    expect(badges.map((b) => b.querySelector('svg')?.getAttribute('data-shape'))).toEqual(['triangle', 'diamond', 'circle']);
    expect(badges.map((b) => [b.firstChild?.textContent, b.textContent])).toEqual([['A', 'A'], ['B', 'B'], ['C', 'C']]);
  });

  it('puts the clock, the count and the hint on the line over the question, and patches them in place', () => {
    const { root, hud } = fresh();
    hud.showOptions(args);
    expect(text(root, '.status')).toBe('Question 2 of 5: Demand1:593 still to voteSpace locks the vote');
    const card = root.querySelector('[data-card=A]');
    hud.updateOptionsStatus({ timerText: '1:58', votedText: '2 still to vote' });
    expect(text(root, '.status')).toBe('Question 2 of 5: Demand1:582 still to voteSpace locks the vote');
    expect(root.querySelector('[data-card=A]')).toBe(card);
    hud.updateOptionsStatus({ timerText: '', votedText: '9 of 9 voted' });
    expect((root.querySelector('.timer') as HTMLElement).hidden).toBe(true);
  });

  it('updateOptionsStatus does nothing when the options are not up', () => {
    const { root, hud } = fresh();
    hud.updateOptionsStatus({ timerText: '0:09', votedText: '1 voted' });
    expect(root.querySelector('.hud-screen')!.childElementCount).toBe(0);
    hud.showOptions(args);
    const timer = root.querySelector('.timer')!;
    hud.showQuestion({ eyebrow: 'e', boss: 'b', question: 'q', footer: '' });
    hud.updateOptionsStatus({ timerText: '0:09', votedText: '1 voted' });
    expect(root.textContent).not.toContain('0:09');
    expect(timer.textContent).toBe('1:59');
  });

  it('lists the valid points under the cards as text, and nothing when there are none', () => {
    const { root, hud } = fresh();
    hud.showOptions(args);
    expect(root.querySelector('.called')).toBeNull();
    hud.showOptions({ ...args, called: [] });
    expect(root.querySelector('.called')).toBeNull();
    hud.showOptions({ ...args, called: ['Valid point: Ann', 'Valid point: <b>Ben</b>'] });
    expect([...root.querySelectorAll('.called li')].map((li) => li.textContent)).toEqual(['Valid point: Ann', 'Valid point: <b>Ben</b>']);
    expect(root.querySelector('.called b')).toBeNull();
  });
});

describe('the question on the boss\'s arrival', () => {
  it('shows the eyebrow, the boss, the question and the footer, in that order', () => {
    const { root, hud } = fresh();
    hud.showQuestion({ eyebrow: 'Question 2 of 5: Demand', boss: 'Fog of Demand', question: q2.question, footer: 'Space opens the vote' });
    expect([...root.querySelector('.question')!.children].map((el) => el.textContent)).toEqual([
      'Question 2 of 5: Demand', 'Fog of Demand', q2.question, 'Space opens the vote',
    ]);
  });
});

describe('the banner and the flash', () => {
  it('reads "Ann, defend B" with no option text, a name alone or a hand call-out, and null takes it down', () => {
    const { root, hud } = fresh();
    hud.showBanner({ name: 'Ann', letter: 'B', footer: 'Y: valid point, N: move on' });
    expect(text(root, '.banner-line')).toBe('Ann, defend B');
    expect(root.querySelector('.banner .badge svg')?.getAttribute('data-shape')).toBe('diamond');
    expect(text(root, '.banner .hint')).toBe('Y: valid point, N: move on');
    hud.showBanner({ name: 'Ann', letter: null, footer: '' });
    expect(text(root, '.banner-line')).toBe('Ann, defend your choice');
    hud.showBanner({ name: null, letter: null, footer: '' });
    expect(text(root, '.banner-line')).toBe('Hand call-out. Who defends their choice?');
    hud.showBanner(null);
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
    expect(root.querySelector('.banner')!.childElementCount).toBe(0);
  });

  it('keeps the banner up when the cards are redrawn, and takes it down for any other screen', () => {
    const { root, hud } = fresh();
    hud.showBanner({ name: 'Ann', letter: 'B', footer: '' });
    hud.showOptions({ eyebrow: '', question: 'q', options: [], timerText: '', votedText: '', split: null, footer: '' });
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(false);
    hud.showQuestion({ eyebrow: 'e', boss: 'b', question: 'q', footer: '' });
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
  });

  it('flashes in the one accent, whatever it says, then clears', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.showFlash('Valid point, Ann!');
    expect(text(root, '.flash')).toBe('Valid point, Ann!');
    hud.showFlash('Valid point!', 500);
    expect(root.querySelectorAll('.flash')).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('.flash')).toBeNull();
  });
});

describe('the ending', () => {
  const column = (letter: OptionId, names: string[], count: number, more = 0) => ({ letter, text: `option ${letter}`, count, names, more });
  const ending = (over: Partial<EndingArgs> = {}): EndingArgs => ({
    title: 'Congratulations!', text: 'The Deadlock is broken.', question: c.rounds[4].question,
    columns: [column('A', ['Ann'], 1), column('B', ['Ben', 'Cy', 'Dee'], 7, 4), column('C', [], 2)], ...over,
  });

  it('says "Congratulations!" over its line, then the question and three columns', () => {
    const { root, hud } = fresh();
    hud.showEnding(ending());
    expect(text(root, 'h1')).toBe('Congratulations!');
    expect(text(root, '.ending-text')).toBe('The Deadlock is broken.');
    expect(text(root, '.ending-question')).toBe(c.rounds[4].question);
    expect(root.querySelectorAll('[data-column]')).toHaveLength(3);
    expect([...root.querySelectorAll('[data-column]')].map((col) => col.getAttribute('data-column'))).toEqual(['A', 'B', 'C']);
  });

  it('lists a column\'s names in order and reads "and 4 more" when more is 4', () => {
    const { root, hud } = fresh();
    hud.showEnding(ending());
    const b = root.querySelector('[data-column="B"]')!;
    expect(text(b, '.column-text')).toBe('option B');
    expect(text(b, '.column-count')).toBe('7');
    expect([...b.querySelectorAll('.names li')].map((li) => li.textContent)).toEqual(['Ben', 'Cy', 'Dee']);
    expect(text(b, '.names-more')).toBe('and 4 more');
    expect(root.querySelector('[data-column="A"] .names-more')).toBeNull();
  });

  it('shows a column with no names as its count, with no empty list', () => {
    const { root, hud } = fresh();
    hud.showEnding(ending());
    const col = root.querySelector('[data-column="C"]')!;
    expect(text(col, '.column-count')).toBe('2');
    expect(col.querySelector('.names')).toBeNull();
    expect(col.querySelector('.names-more')).toBeNull();
  });

  it('puts names in as text, never as markup', () => {
    const { root, hud } = fresh();
    hud.showEnding(ending({ columns: [column('A', ['<img src=x onerror=alert(1)>'], 1), column('B', [], 0), column('C', [], 0)] }));
    expect(root.querySelector('.names img')).toBeNull();
    expect(text(root, '.names li')).toBe('<img src=x onerror=alert(1)>');
  });
});

describe('what is gone', () => {
  it('has no debrief, leaderboard or narration screen, and only the colours of A, B and C', () => {
    const proto = Hud.prototype as unknown as Record<string, unknown>;
    expect(proto.showDebrief).toBeUndefined();
    expect(proto.showLeaderboard).toBeUndefined();
    expect(proto.showNarration).toBeUndefined();
    expect(proto.flashRally).toBeUndefined();
    expect(Object.keys(OPTION_COLORS)).toEqual(['A', 'B', 'C']);
  });

  it('never cuts a role name or a joiner\'s row in the lobby', () => {
    const sheet = css('../host/hud/hud.css');
    for (const name of ['.count-name', '.recent li']) {
      const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => selector.split(',').some((s) => s.trim() === name));
      expect(rules.length, name).toBeGreaterThan(0);
      for (const [, , body] of rules) expect(body, name).not.toMatch(/text-overflow|nowrap|overflow:\s*hidden/);
    }
  });

  it('flashes on a solid panel, never the see-through one', () => {
    const rule = [...css('../host/hud/hud.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(([, selector]) => selector.trim() === '.flash');
    expect(rule?.[2]).toMatch(/background: var\(--surface-1\)/);
    expect(rule?.[2]).toMatch(/color: var\(--accent-bright\)/);
  });

  it('never clamps an option\'s text in the stylesheet', () => {
    const sheet = css('../host/hud/hud.css');
    const rules = [...sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, selector]) => selector.includes('.card-text'));
    expect(rules.length).toBeGreaterThan(0);
    for (const [, , body] of rules) {
      expect(body).not.toMatch(/line-clamp|text-overflow|-webkit-box/);
    }
  });
});

// ---- The lobby ------------------------------------------------------------------------------------------------

const lobby = (over: Partial<LobbyArgs> = {}): LobbyArgs => ({
  qrDataUrl: null, joinUrl: 'https://olkaria.example.dev/j/ABCD', count: 0,
  roleCounts: { citizen: 0, government: 0, business: 0, microsoft: 0 },
  roleNames: { citizen: 'Citizen', government: 'Government', business: 'Local Businessman', microsoft: 'Satya Nadella' },
  recent: [], offline: false, ...over,
});

describe('lobby', () => {
  it('shows the QR and the address without its scheme online, with no offline notice', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ qrDataUrl: 'data:image/png;base64,AAAA' }));
    expect(root.querySelector('img.qr')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(text(root, '.join-url')).toBe('olkaria.example.dev/j/ABCD');
    expect(root.textContent).not.toContain('Offline mode');
  });

  it('keeps the same QR image across refreshes, so a new joiner does not make it decode again', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ qrDataUrl: 'data:image/png;base64,AAAA' }));
    const first = root.querySelector('img.qr');
    hud.showLobby(lobby({ qrDataUrl: 'data:image/png;base64,AAAA', count: 1 }));
    expect(root.querySelector('img.qr')).toBe(first);
  });

  it('says it is connecting until the room is known, and shows no code or address meanwhile', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ joinUrl: '' }));
    expect(root.textContent).toContain('Connecting to the room');
    expect(root.querySelector('.code')).toBeNull();
    expect(root.querySelector('.join-url')).toBeNull();
  });

  it('names each role\'s tile from the content with its count, and says names are hidden when the list is empty', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ count: 5, roleCounts: { citizen: 1, government: 2, business: 1, microsoft: 1 } }));
    expect([...root.querySelectorAll('.count')].map((li) => [li.querySelector('.count-name')!.textContent, li.querySelector('b')!.textContent]))
      .toEqual([['Citizen', '1'], ['Government', '2'], ['Local Businessman', '1'], ['Satya Nadella', '1']]);
    expect([...root.querySelectorAll('.count svg.figure')].map((f) => f.getAttribute('data-role'))).toEqual(['citizen', 'government', 'business', 'microsoft']);
    expect(root.textContent).toContain('5 joined');
    expect(root.textContent).toContain('Names hidden');
    hud.showLobby(lobby());
    expect(root.textContent).toContain('No one yet');
  });

  it('puts names in as text, never as markup', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ count: 1, recent: ['<img src=x onerror=alert(1)>, Citizen'] }));
    expect(root.querySelector('.recent img')).toBeNull();
    expect(text(root, '.recent li')).toBe('<img src=x onerror=alert(1)>, Citizen');
  });

  it('the lobby hint is three keycaps: Space to start, M for the hotkeys, ? for how to play', () => {
    // M, not Esc: in fullscreen Chrome takes Esc to leave fullscreen, so the key the lobby names must be M.
    const { root, hud } = fresh();
    hud.showLobby(lobby());
    expect([...root.querySelectorAll('.lobby-key')].map((li) => [li.querySelector('kbd.key')!.textContent, li.querySelector('span')!.textContent]))
      .toEqual([['Space', 'Start'], ['M', 'Shows hotkeys'], ['?', 'How to play']]);
  });

  it('shows the address in two lines, the count as a hero, and the title on two lines with no room code', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ joinUrl: 'https://olkaria.example.dev/j/ABCD', count: 12 }));
    expect(root.querySelector('.join-host')!.textContent).toBe('olkaria.example.dev');
    expect(root.querySelector('.join-path')!.textContent).toBe('/j/ABCD');
    expect(root.querySelector('.joined-n')!.textContent).toBe('12');
    expect(root.querySelector('.code')).toBeNull();
    expect(root.querySelector('.lobby-title .lobby-name')!.textContent).toBe('Olkaria');
    expect(root.querySelector('.lobby-title .lobby-sub')!.textContent).toBe('the Deadlock');
    expect(root.querySelector('h1.lobby-title')!.getAttribute('aria-label')).toBe('Olkaria: the Deadlock');
  });

  it('splits an address with a port at the slash after the host', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ joinUrl: 'http://localhost:5173/j/ABCD' }));
    expect([text(root, '.join-host'), text(root, '.join-path')]).toEqual(['localhost:5173', '/j/ABCD']);
  });

  it('offline: the notice names keys 1 to 3, the tiles stay and there is no address', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ offline: true }));
    expect(root.querySelector('.join-url')).toBeNull();
    expect(root.querySelectorAll('.count')).toHaveLength(4);
    expect(root.textContent).toContain('Offline mode');
    expect(root.textContent).toContain('1 to 3');
    expect(root.textContent).not.toContain('1 to 4');
  });
});

// ---- Toasts and clear ---------------------------------------------------------------------------------------------

describe('toasts and clear', () => {
  it('keeps one sticky toast and one timed toast, each replacing only its own kind', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    const toasts = () => [...root.querySelectorAll('.toast')].map((t) => t.textContent);
    hud.showToast('Bad phase', 2000);
    hud.showToast('Reconnecting to the room', 0);
    expect(toasts()).toEqual(['Reconnecting to the room', 'Bad phase']);   // sticky above timed
    vi.advanceTimersByTime(2000);
    expect(toasts()).toEqual(['Reconnecting to the room']);
    hud.showToast('One');
    hud.showToast('Two');
    expect(toasts()).toEqual(['Reconnecting to the room', 'Two']);
    vi.advanceTimersByTime(4000);
    expect(toasts()).toEqual(['Reconnecting to the room']);
    hud.showToast('Reconnecting to the room', Infinity);   // the same sticky text again changes nothing
    expect(toasts()).toEqual(['Reconnecting to the room']);
    hud.showToast('Connected', 1500);
    hud.clear();
    expect(toasts()).toEqual([]);
  });

  it('clearToast() takes down the sticky toast and clearTimedToast() the timed one, each leaving the other', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.showToast('Reconnecting to the room', 0);
    hud.showToast('Press Shift+R again to reset', 3000);
    hud.clearToast();
    expect([...root.querySelectorAll('.toast')].map((t) => t.textContent)).toEqual(['Press Shift+R again to reset']);
    hud.showToast('Reconnecting to the room', 0);
    hud.clearTimedToast();
    expect([...root.querySelectorAll('.toast')].map((t) => t.textContent)).toEqual(['Reconnecting to the room']);
  });

  it('keeps a repeated toast up from the repeat instead of stacking a copy', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.showToast('Bad phase', 2000);
    vi.advanceTimersByTime(1500);
    hud.showToast('Bad phase', 2000);
    expect(root.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(1500);
    expect(root.querySelectorAll('.toast')).toHaveLength(1);
    vi.advanceTimersByTime(500);
    expect(root.querySelectorAll('.toast')).toHaveLength(0);
  });

  it('capitalises the first letter of a message and nothing else', () => {
    expect(capitalise('bad phase')).toBe('Bad phase');
    expect(capitalise('')).toBe('');
  });

  it('clear() empties the screen and takes the banner down', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby());
    hud.showBanner({ name: null, letter: null, footer: '' });
    hud.clear();
    expect(root.querySelector('.hud-screen')!.childElementCount).toBe(0);
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
  });
});

// ---- Facilitator menu: the panel, its buttons and the key map under them, and the focus ------------------------

describe('menu', () => {
  const button = (id: string, label: string, over: Partial<MenuButton> = {}): MenuButton => ({ id, label, enabled: true, armed: false, ...over });
  const stagesHint = 'Earlier questions stay. The one you go to, and the ones after it, start over.';
  /** Restart and the second stage disabled, the lobby armed. */
  const menu = (over: Partial<MenuArgs> = {}): MenuArgs => ({
    actions: [
      button('restart', 'Restart question 1', { hint: 'This question again. Its votes go.', enabled: false }),
      button('lobby', 'Back to the lobby', { hint: 'Players stay; votes go.', armed: true }),
      button('reload', 'Reload the page', { hint: 'The same room and screen come back.' }),
    ],
    stages: [button('stage-0', 'Q1 Power'), button('stage-1', 'Q2 Demand', { enabled: false }), button('stage-5', 'Ending')],
    stagesHint,
    onPick: () => {},
    onClose: () => {},
    ...over,
  });
  const ids = (buttons: Iterable<Element>) => [...buttons].map((b) => b.getAttribute('data-menu-item'));
  const focused = () => document.activeElement?.getAttribute('data-menu-item') ?? null;

  it('draws a button for every item, the armed one asking "Sure?", the stages hint and the key rows; null takes it down', () => {
    const { root, hud } = fresh();
    hud.showMenu(menu());
    expect(root.querySelector('.hud-menu[role=dialog][aria-label=Menu] > .menu > h2.title')?.textContent).toBe('Menu');
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button.menu-btn[type=button][data-menu-item]')];
    expect(ids(buttons)).toEqual(['restart', 'lobby', 'reload', 'stage-0', 'stage-1', 'stage-5']);
    expect(ids(buttons.filter((b) => b.disabled))).toEqual(['restart', 'stage-1']);
    const lobbyButton = root.querySelector('[data-menu-item=lobby]')!;
    expect(lobbyButton.querySelector('.menu-label')!.textContent).toBe('Sure?');
    expect(lobbyButton.getAttribute('aria-label')).toBe('Sure? Back to the lobby');
    expect(text(root, '.menu-group + .menu-group > p.hint.menu-note')).toBe(stagesHint);
    hud.showMenu(null);
    expect(root.querySelector('.hud-menu')).toBeNull();
  });

  it('lists exactly the keys that work, and none that went with the road or option D', () => {
    const { root, hud } = fresh();
    hud.showMenu(menu());
    const keys = [...root.querySelectorAll('.menu > .sep + ul.keys > .key-row')].map((row) => row.querySelector('.key')!.textContent);
    expect(keys).toEqual(['Space', '1 to 3', 'Shift+1 to 3', 'B', 'C', 'Y or N', 'R', 'H', 'F', 'S', 'Shift+R twice', '?', 'M or Esc']);
    const rows = root.querySelector('ul.keys')!.textContent!;
    expect(rows).not.toMatch(/\bD\b|1 to 4|Arrows|walk|road|travel/i);
    expect(rows).toContain('valid point');
  });

  it('puts the labels and hints in as text, never as markup', () => {
    const { root, hud } = fresh();
    hud.showMenu(menu({ stages: [button('stage-0', 'Q1 <b>Power</b>')], stagesHint: '<i>x</i>' }));
    expect(text(root, '[data-menu-item=stage-0] .menu-label')).toBe('Q1 <b>Power</b>');
    expect(text(root, '.menu-note')).toBe('<i>x</i>');
    expect(root.querySelector('.menu b, .menu i')).toBeNull();
  });

  it('walks the focus through the enabled buttons, wrapping both ways, and a redraw keeps the focused item', () => {
    const { root, hud } = fresh();
    document.body.append(root);   // in the page, so its buttons can take the focus
    hud.showMenu(menu());
    expect(hud.focusedMenuItem()).toBeNull();
    hud.moveMenuFocus(-1);
    expect(focused()).toBe('stage-5');
    hud.moveMenuFocus(1);
    expect(focused()).toBe('lobby');
    hud.moveMenuFocus(-1);
    hud.moveMenuFocus(-1);
    expect(focused()).toBe('stage-0');   // the disabled second stage is skipped
    hud.showMenu(menu({ stages: [button('stage-0', 'Q1 Power', { armed: true }), button('stage-1', 'Q2 Demand'), button('stage-5', 'Ending')] }));
    expect(focused()).toBe('stage-0');
    hud.showMenu(null);
    expect(hud.focusedMenuItem()).toBeNull();
    root.remove();
  });

  it('picks a clicked button, closes on a click on the scrim but not on the panel, and clear() leaves it up', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const { root, hud } = fresh();
    hud.showMenu(menu({ onPick, onClose }));
    (root.querySelector('[data-menu-item=reload] .menu-hint') as HTMLElement).click();
    expect(onPick.mock.calls).toEqual([['reload']]);
    (root.querySelector('.menu .title') as HTMLElement).click();
    expect(onClose).not.toHaveBeenCalled();
    (root.querySelector('.hud-menu') as HTMLElement).click();
    expect(onClose).toHaveBeenCalledTimes(1);
    hud.clear();
    expect(root.querySelector('.hud-menu')).not.toBeNull();
  });

  it('menuOpen says whether the menu is up', () => {
    const { hud } = fresh();
    expect(hud.menuOpen()).toBe(false);
    hud.showMenu(menu());
    expect(hud.menuOpen()).toBe(true);
    hud.showMenu(null);
    expect(hud.menuOpen()).toBe(false);
  });
});

// ---- How to play: one slide at a time on a full-bleed dialog -------------------------------------------------------

describe('how to play', () => {
  it('draws a slide as its step number over its sentence and note, on a full-bleed dialog with the dots and the keycaps; null takes it down', () => {
    const { root, hud } = fresh();
    const slides = howtoSlides(c); const onNext = vi.fn();
    hud.showHowTo({ slide: slides[3], index: 3, count: slides.length, onNext });
    const dialog = root.querySelector('.hud-howto')!;
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-label')).toBe('How to play');
    expect(dialog.parentElement).toBe(root);
    expect([...dialog.querySelector('.howto-slide')!.children].map((el) => [el.className.split(' ')[0], el.textContent])).toEqual([
      ['howto-step', '4'],
      ['howto-text', 'The purpose of the game is for you to get to a team consensus, BUT KEEP YOUR INTERESTS IN MIND!!'],
      ['howto-note', "You'll have 2 minutes to discuss within your team"],
    ]);
    expect(dialog.querySelectorAll('.howto-dot')).toHaveLength(7);
    expect(dialog.querySelector('.howto-dot[aria-current]')).toBe(dialog.querySelectorAll('.howto-dot')[3]);
    expect([...dialog.querySelectorAll('.howto-key')].map((k) => [k.querySelector('kbd')!.textContent, k.querySelector('span')!.textContent])).toEqual([['Space', 'Next'], ['?', 'Close']]);
    (dialog.querySelector('.howto-slide') as HTMLElement).click();
    expect(onNext).toHaveBeenCalledTimes(1);
    hud.showHowTo({ slide: slides[6], index: 6, count: slides.length, onNext });
    expect(root.querySelectorAll('.hud-howto')).toHaveLength(1);
    expect(dialog.isConnected).toBe(false);
    // The closing slide has no number and no note.
    expect([...root.querySelector('.howto-slide')!.children].map((el) => el.className.split(' ')[0])).toEqual(['howto-text']);
    expect([...root.querySelectorAll('.howto-key')].map((k) => k.querySelector('span')!.textContent)).toEqual(['Close', 'Close']);
    hud.showLobby(lobby());   // a screen change under the dialog
    expect(root.querySelector('.hud-howto')).not.toBeNull();
    hud.clear();
    expect(root.querySelector('.hud-howto')).not.toBeNull();
    hud.showHowTo(null);
    expect(root.querySelector('.hud-howto')).toBeNull();
  });

  it('every slide draws its own sentence in full, as text', () => {
    const { root, hud } = fresh();
    const slides = howtoSlides(c);
    for (const [i, slide] of slides.entries()) {
      hud.showHowTo({ slide, index: i, count: slides.length, onNext: () => {} });
      expect(text(root, '.howto-text')).toBe(slide.text);
      expect(text(root, '.howto-step')).toBe(slide.step === null ? null : String(slide.step));
    }
  });
});

// ---- The pixel face: no ligatures anywhere it is set ---------------------------------------------------------

describe('the pixel face', () => {
  it('turns ligatures off in every rule that sets it, after the font, since Pixelify Sans lacks the glyph its "fi" stands for', () => {
    const rules = [...css('../host/hud/hud.css').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([, , body]) => body.includes('var(--font-title)'));
    expect(rules.length).toBeGreaterThanOrEqual(6);
    for (const [, selector, body] of rules) {
      const at = body.indexOf('var(--font-title)');
      expect({ selector: selector.trim(), off: body.indexOf('font-variant-ligatures: none') > at && body.indexOf('font-feature-settings: "liga" 0') > at })
        .toEqual({ selector: selector.trim(), off: true });
    }
  });
  it('is not on the phone', () => {
    expect(css('../player/styles.css')).not.toMatch(/Pixelify|--font-title/);
  });
});
