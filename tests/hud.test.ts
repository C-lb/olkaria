// @vitest-environment happy-dom
// tests/hud.test.ts
import { it, expect } from 'vitest';
import { Hud, OPTION_COLORS } from '../host/hud/Hud';
const sh = (A: number, B: number, C: number, D: number) => ({ A, B, C, D });
it('draws four cards in letter order with letter colours and two bars each', () => {
  const root = document.createElement('div'); document.body.appendChild(root);
  const hud = new Hud(root);
  hud.showOptions({ options: [{ letter: 'A', screen: 'a' }, { letter: 'B', screen: 'b' }, { letter: 'C', screen: 'c' }, { letter: 'D', screen: 'd' }],
    leadLabel: 'Rogues', timerText: '30 s', votedText: '0 of 3 voted', leadShares: sh(0.1, 0.6, 0.1, 0.2), supportShares: sh(0.2, 0.5, 0.1, 0.2), footer: 'Space locks' });
  const cards = [...root.querySelectorAll('[data-card]')];
  expect(cards.map(c => c.getAttribute('data-card'))).toEqual(['A', 'B', 'C', 'D']);
  expect((cards[0] as HTMLElement).style.getPropertyValue('--option')).toBe(OPTION_COLORS.A);
  expect((cards[1].querySelector('[data-bar=lead]') as HTMLElement).style.width).toBe('60%');
  expect((cards[1].querySelector('[data-bar=support]') as HTMLElement).style.width).toBe('50%');
  expect(root.textContent).toContain('Rogues');
});
it('shows the lobby counts, the banner and the debrief lines', () => {
  const root = document.createElement('div'); const hud = new Hud(root);
  hud.showLobby({ qrDataUrl: null, code: 'ABCD', joinUrl: 'https://x/j/ABCD', count: 3, roleCounts: { citizen: 1, government: 2, business: 0, microsoft: 0 }, classNames: { citizen: 'Rogue', government: 'Knight', business: 'Bard', microsoft: 'Wizard' }, recent: ['Ann, Knight', 'Cy, Rogue'], offline: true, smith: 's', tanui: 't' });
  expect(root.textContent).toContain('Knights 2'); expect(root.textContent).toContain('Offline mode'); expect(root.textContent).toContain('Ann, Knight');
  hud.showBanner({ name: 'Sarah', letter: 'B', phone: 'Yes to 60 to 100 MW, tied', footer: 'Y convincing, N not' });
  expect(root.textContent).toContain('Sarah, defend B: Yes to 60 to 100 MW, tied');
  hud.showBanner({ name: null, letter: null, phone: null, footer: '' });
  expect(root.textContent).toContain('Hand call-out');
  hud.showDebrief({ lines: [{ letter: 'A', damage: 6, text: 'line a' }, { letter: 'B', damage: 44, text: 'line b' }], breakdown: { base: 62.5, focus: 0, alignment: 10, exhibit: 10, rally: 10, total: 93, capped: false, cap: 100 }, alignment: 'The party stood with the Rogues: both chose B', rally: 'Rally: Sarah +10', discuss: 'Why?' });
  expect(root.querySelectorAll('[data-debrief-line]')).toHaveLength(2);
  expect(root.textContent).toContain('Rally: Sarah +10'); expect(root.textContent).toContain('stood with the Rogues');
  expect(root.textContent).toContain('Base 62.5, Focus 0, Party aligned +10, Exhibits +10, Rally +10. Total 93');
  hud.showDebrief({ lines: [], breakdown: { base: 80, focus: 15, alignment: 0, exhibit: 15, rally: 20, total: 100, capped: true, cap: 100 }, alignment: '', rally: null, discuss: '' });
  expect(root.textContent).toContain('Total 100 (capped at 100)');
});

// ---- Beyond the brief: the tests above are its code unchanged ----------------------------------------------
import { afterEach, describe, vi } from 'vitest';
import { capitalise, type LobbyArgs } from '../host/hud/Hud';

const lobby = (over: Partial<LobbyArgs> = {}): LobbyArgs => ({
  qrDataUrl: null, code: 'ABCD', joinUrl: 'https://olkaria.example.dev/j/ABCD', count: 0,
  roleCounts: { citizen: 0, government: 0, business: 0, microsoft: 0 },
  classNames: { citizen: 'Rogue', government: 'Knight', business: 'Bard', microsoft: 'Wizard' },
  recent: [], offline: false, smith: 'single biggest step', tanui: 'not failed or withdrawn', ...over,
});
const fresh = (): { root: HTMLElement; hud: Hud } => {
  const root = document.createElement('div');
  return { root, hud: new Hud(root) };
};
const options = (letters: ('A' | 'B' | 'C' | 'D')[]) => letters.map((letter) => ({ letter, screen: `option ${letter}` }));
const text = (root: HTMLElement, selector: string) => root.querySelector(selector)?.textContent ?? null;

afterEach(() => { vi.useRealTimers(); });

describe('lobby', () => {
  it('shows the QR, the address without its scheme and the code online, with no offline notice', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ qrDataUrl: 'data:image/png;base64,AAAA' }));
    expect(root.querySelector('img.qr')?.getAttribute('src')).toBe('data:image/png;base64,AAAA');
    expect(text(root, '.join-url')).toBe('olkaria.example.dev/j/ABCD');
    expect(text(root, '.code')).toBe('ABCD');
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
    hud.showLobby(lobby({ code: '', joinUrl: '' }));
    expect(root.textContent).toContain('Connecting to the room');
    expect(root.querySelector('.code')).toBeNull();
    expect(root.querySelector('.join-url')).toBeNull();
  });

  it('frames the bare quotes with their speakers and citations', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby());
    expect(root.textContent).toContain('“single biggest step” Brad Smith, Microsoft (Vimal, 2026)');
    expect(root.textContent).toContain('“not failed or withdrawn” PS John Tanui (James, 2026; Vimal, 2026)');
  });

  it('lists every class count, and says names are hidden when players have joined but the list is empty', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ count: 4, roleCounts: { citizen: 1, government: 1, business: 1, microsoft: 1 } }));
    expect([...root.querySelectorAll('.counts li')].map((li) => li.textContent)).toEqual(['Rogues 1', 'Knights 1', 'Bards 1', 'Wizards 1']);
    expect(root.textContent).toContain('4 joined');
    expect(root.textContent).toContain('Names hidden');
    hud.showLobby(lobby());
    expect(root.textContent).toContain('No one yet');
  });

  it('puts names in as text, never as markup', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby({ count: 1, recent: ['<img src=x onerror=alert(1)>, Rogue'] }));
    expect(root.querySelector('.recent img')).toBeNull();
    expect(text(root, '.recent li')).toBe('<img src=x onerror=alert(1)>, Rogue');
  });
});

describe('options and banner', () => {
  it('sorts the cards into letter order, whatever order they arrive in', () => {
    const { root, hud } = fresh();
    hud.showOptions({ options: options(['D', 'B', 'A', 'C']), leadLabel: 'Bards', timerText: '', votedText: '', leadShares: null, supportShares: null, footer: '' });
    expect([...root.querySelectorAll('[data-card]')].map((c) => c.getAttribute('data-card'))).toEqual(['A', 'B', 'C', 'D']);
  });

  it('hides the split while the vote is open, but still names the leading class and the clock', () => {
    const { root, hud } = fresh();
    hud.showOptions({ options: options(['A', 'B', 'C', 'D']), leadLabel: 'Rogues', timerText: '23 s', votedText: '5 of 9 voted', leadShares: null, supportShares: null, footer: 'Space locks the vote' });
    expect(root.querySelectorAll('[data-bar]')).toHaveLength(0);
    expect(root.querySelector('.card.has-bars')).toBeNull();
    expect(text(root, '.status')).toBe('Rogues lead23 s5 of 9 votedSpace locks the vote');
  });

  it('labels each card bar, sizes it to one decimal and prints its share in whole percent', () => {
    const { root, hud } = fresh();
    const third = { A: 1 / 3, B: 2 / 3, C: 0, D: 0 };
    hud.showOptions({ options: options(['A', 'B', 'C', 'D']), leadLabel: 'Knights', timerText: '', votedText: '', leadShares: third, supportShares: third, footer: '' });
    const a = root.querySelector('[data-card=A]')!;
    expect([...a.querySelectorAll('.bar-label')].map((l) => l.textContent)).toEqual(['Knights', 'Party']);
    expect((a.querySelector('[data-bar=lead]') as HTMLElement).style.width).toBe('33.3%');
    expect(text(a as HTMLElement, '.bar-value')).toBe('33%');
    expect(text(root.querySelector('[data-card=B]') as HTMLElement, '.bar-value')).toBe('67%');
    expect(a.classList.contains('has-bars')).toBe(true);
  });

  it('marks every badge with its letter, so the stylesheet can put dark ink on C', () => {
    const { root, hud } = fresh();
    hud.showOptions({ options: options(['A', 'B', 'C', 'D']), leadLabel: 'Rogues', timerText: '', votedText: '', leadShares: null, supportShares: null, footer: '' });
    const badges = [...root.querySelectorAll<HTMLElement>('.badge')];
    expect(badges.map((b) => b.getAttribute('data-option'))).toEqual(['A', 'B', 'C', 'D']);
    expect(badges.map((b) => b.style.getPropertyValue('--option'))).toEqual(['A', 'B', 'C', 'D'].map((o) => OPTION_COLORS[o as 'A']));
  });

  it('draws the shape bound to each letter inside its badge, after the letter, on the cards, the banner and the debrief', () => {
    const { root, hud } = fresh();
    hud.showOptions({ options: options(['A', 'B', 'C', 'D']), leadLabel: 'Rogues', timerText: '', votedText: '', leadShares: null, supportShares: null, footer: '' });
    const badges = [...root.querySelectorAll<HTMLElement>('[data-card] > .badge')];
    expect(badges.map((b) => b.querySelector('svg')?.getAttribute('data-shape'))).toEqual(['triangle', 'diamond', 'circle', 'square']);
    expect(badges.map((b) => b.querySelector('svg > *')?.tagName.toLowerCase())).toEqual(['path', 'path', 'circle', 'rect']);
    expect(badges.map((b) => b.querySelector('svg')?.getAttribute('aria-hidden'))).toEqual(['true', 'true', 'true', 'true']);
    expect(badges.map((b) => [b.firstChild?.textContent, b.textContent])).toEqual([['A', 'A'], ['B', 'B'], ['C', 'C'], ['D', 'D']]);
    hud.showBanner({ name: 'Sarah', letter: 'C', phone: 'Wait, compare providers', footer: '' });
    expect(root.querySelector('.banner .badge svg')?.getAttribute('data-shape')).toBe('circle');
    expect(text(root, '.banner-line')).toBe('Sarah, defend C: Wait, compare providers');
    hud.showDebrief({ lines: [{ letter: 'D', damage: 9, text: 'd' }], breakdown: { base: 9, focus: 0, alignment: 0, exhibit: 0, rally: 0, total: 9, capped: false, cap: 100 }, alignment: '', rally: null, discuss: '' });
    expect(root.querySelector('[data-debrief-line=D] .badge svg')?.getAttribute('data-shape')).toBe('square');
  });

  it('keeps the banner up when the cards are redrawn, and takes it down for any other screen', () => {
    const { root, hud } = fresh();
    hud.showBanner({ name: 'Sarah', letter: 'B', phone: 'Yes to 60 to 100 MW, tied', footer: 'Y convincing, N not' });
    hud.showOptions({ options: options(['A', 'B', 'C', 'D']), leadLabel: 'Rogues', timerText: '', votedText: '', leadShares: null, supportShares: null, footer: '' });
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(false);
    expect(text(root, '.banner')).toBe('Sarah, defend B: Yes to 60 to 100 MW, tiedY convincing, N not');
    hud.showNarration({ boss: 'Grid Wyrm', title: 't', narration: 'n', footer: '' });
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
  });

  it('names a called student with no recorded choice, and null takes the banner down', () => {
    const { root, hud } = fresh();
    hud.showBanner({ name: 'Ann', letter: null, phone: null, footer: '' });
    expect(text(root, '.banner-line')).toBe('Ann, defend your choice');
    hud.showBanner(null);
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
    expect(root.querySelector('.banner')!.childElementCount).toBe(0);
  });
});

describe('narration, debrief, ending and leaderboard', () => {
  it('shows the boss, the question, the situation, the quote as given and the footer', () => {
    const { root, hud } = fresh();
    hud.showNarration({ boss: 'Grid Wyrm', title: 'What will Kenyans accept on power?', narration: 'Olkaria steam fields.', quote: '“shut off power for half the country” President Ruto', footer: 'Space opens the vote' });
    expect([...root.querySelector('.narration')!.children].map((el) => el.textContent)).toEqual([
      'Grid Wyrm', 'What will Kenyans accept on power?', 'Olkaria steam fields.', '“shut off power for half the country” President Ruto', 'Space opens the vote',
    ]);
  });

  it('prints damage with one decimal, the breakdown without trailing zeros, and the discuss line apart', () => {
    const { root, hud } = fresh();
    hud.showDebrief({ lines: [{ letter: 'C', damage: 1.5, text: 'line c' }], breakdown: { base: 73.333, focus: 15, alignment: 0, exhibit: 0, rally: 10, total: 98, capped: false, cap: 100 }, alignment: '', rally: null, discuss: 'What should Microsoft do, and why?' });
    expect(text(root, '.debrief-damage')).toBe('1.5');
    expect(text(root, '.breakdown')).toBe('Base 73.3, Focus +15, Party aligned 0, Exhibits 0, Rally +10. Total 98');
    expect(text(root, '.discuss')).toBe('Discuss: What should Microsoft do, and why?');
    hud.showDebrief({ lines: [{ letter: 'A', damage: 6, text: 'a' }], breakdown: { base: 0, focus: 0, alignment: 0, exhibit: 0, rally: 0, total: 0, capped: false, cap: 100 }, alignment: '', rally: null, discuss: '' });
    expect(text(root, '.debrief-damage')).toBe('6.0');
    expect(root.querySelector('.discuss')).toBeNull();
  });

  it('capitalises the ending bullets and lists what each round needed when the Deadlock holds', () => {
    const { root, hud } = fresh();
    hud.showEnding({ title: 'The Seed Plant', tier: 'decisive', split: { A: 1, B: 6, C: 1, D: 2 }, mustBeTrue: ['the expansion option stays open'], risk: ['weak early returns'], holds: null });
    expect(root.textContent).toContain('Decisive');
    expect([...root.querySelectorAll('.bullets li')].map((li) => li.textContent)).toEqual(['The expansion option stays open', 'Weak early returns']);
    expect([...root.querySelectorAll('.split .bar-value')].map((v) => v.textContent)).toEqual(['10%', '60%', '10%', '20%']);
    hud.showEnding({ title: 'The Deadlock holds', tier: '', split: { A: 0, B: 0, C: 0, D: 0 }, mustBeTrue: [], risk: [], holds: [{ round: 'Round 1', chose: 'Rogues chose B', needed: 'B or D' }] });
    expect(text(root, '.holds-row')).toBe('Round 1Rogues chose BNeeded: B or D');
    expect(root.querySelector('.bullets')).toBeNull();
    expect([...root.querySelectorAll('.split .bar-value')].map((v) => v.textContent)).toEqual(['0%', '0%', '0%', '0%']);
  });

  it('puts a tied ending\'s tier in the eyebrow with its first letter in capitals', () => {
    const { root, hud } = fresh();
    hud.showEnding({ title: 'The Tenant', tier: 'decisive, tied with C', split: { A: 4, B: 0, C: 4, D: 0 }, mustBeTrue: ['x'], risk: ['y'], holds: null });
    expect(text(root, '.ending .eyebrow')).toBe('Decisive, tied with C');
  });

  it('opens the Deadlock holding on its title with no tier over it, then its sentence above the rows, and no sentence without text', () => {
    const { root, hud } = fresh();
    const split = { A: 0, B: 2, C: 0, D: 0 };
    hud.showEnding({ title: 'The Deadlock holds', tier: '', text: 'Your board sends the party back to Nairobi.', split, mustBeTrue: [], risk: [], holds: [{ round: 'Round 1', chose: 'Rogues chose C: Full 1 GW for the hub', needed: 'B or D' }] });
    const parts = [...root.querySelector('.ending')!.children];
    expect(parts.map((el) => el.tagName)).toEqual(['H1', 'P', 'DIV']);
    expect(parts.slice(0, 2).map((el) => el.textContent)).toEqual(['The Deadlock holds', 'Your board sends the party back to Nairobi.']);
    expect(parts[2].querySelector('.holds-row')?.textContent).toBe('Round 1Rogues chose C: Full 1 GW for the hubNeeded: B or D');
    hud.showEnding({ title: 'The Seed Plant', tier: 'decisive', split, mustBeTrue: ['the expansion option stays open'], risk: ['weak early returns'], holds: null });
    expect([...root.querySelector('.ending')!.children].map((el) => el.tagName)).toEqual(['P', 'H1', 'DIV']);
  });

  it('ranks the leaderboard and closes on the question over the split', () => {
    const { root, hud } = fresh();
    hud.showLeaderboard({ rows: [{ name: 'Ann', className: 'Knight', score: 212.4 }, { name: 'Cy', className: 'Rogue', score: 198 }], consistent: 'Most consistent strategist: Ann', table: null, split: { A: 0, B: 3, C: 0, D: 1 }, question: 'What should Microsoft do, and why?' });
    expect([...root.querySelectorAll('.board-row')].map((r) => r.textContent)).toEqual(['1AnnKnight212', '2CyRogue198']);
    expect(root.textContent).toContain('Most consistent strategist: Ann');
    expect(text(root, 'h1')).toBe('What should Microsoft do, and why?');
    expect(text(root, '.eyebrow')).toBe('Top 2');
    hud.showLeaderboard({ rows: [], consistent: 'No one voted in all four rounds', table: null, split: { A: 0, B: 0, C: 0, D: 0 }, question: 'q' });
    expect(text(root, '.eyebrow')).toBe('Top players');
    expect(root.textContent).toContain('No scores yet');
  });

  it('names the cap it is given, never a number of its own', () => {
    const { root, hud } = fresh();
    hud.showDebrief({ lines: [], breakdown: { base: 90, focus: 15, alignment: 10, exhibit: 5, rally: 0, total: 120, capped: true, cap: 120 }, alignment: '', rally: null, discuss: '' });
    expect(text(root, '.breakdown')).toBe('Base 90, Focus +15, Party aligned +10, Exhibits +5, Rally 0. Total 120 (capped at 120)');
  });
});

describe('toasts, flash, key map and clear', () => {
  it('keeps one sticky toast and one timed toast, each replacing only its own kind', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    const toasts = () => [...root.querySelectorAll('.toast')].map((t) => t.textContent);
    hud.showToast('Bad phase', 2000);
    hud.showToast('Travel 1: Grid Wyrm ahead. Rogues lead.', 0);
    expect(toasts()).toEqual(['Travel 1: Grid Wyrm ahead. Rogues lead.', 'Bad phase']);   // sticky above timed
    hud.showToast('Reconnecting to the room', 0);
    expect(toasts()).toEqual(['Reconnecting to the room', 'Bad phase']);
    vi.advanceTimersByTime(2000);
    expect(toasts()).toEqual(['Reconnecting to the room']);   // the timed toast goes on its own and leaves the sticky one
    hud.showToast('Olkaria generates about 950 MW (James, 2026)');
    hud.showToast('Record peak demand 2,444 MW, January 2026 (James, 2026)');
    expect(toasts()).toEqual(['Reconnecting to the room', 'Record peak demand 2,444 MW, January 2026 (James, 2026)']);
    vi.advanceTimersByTime(3999);
    expect(toasts()).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(toasts()).toEqual(['Reconnecting to the room']);
    hud.showToast('Reconnecting to the room', Infinity);   // the same sticky text again changes nothing
    expect(toasts()).toEqual(['Reconnecting to the room']);
    hud.showToast('Connected', 1500);
    hud.clear();
    expect(toasts()).toEqual([]);
  });

  it('clearToast() takes down the sticky toast and leaves the timed one', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.showToast('Reconnecting to the room', 0);
    hud.showToast('Press Shift+R again to reset', 3000);
    hud.clearToast();
    expect([...root.querySelectorAll('.toast')].map((t) => t.textContent)).toEqual(['Press Shift+R again to reset']);
    hud.clearToast();
    expect(root.querySelectorAll('.toast')).toHaveLength(1);
  });

  it('capitalises the first letter of a message and nothing else', () => {
    expect(capitalise('bad phase')).toBe('Bad phase');
    expect(capitalise('')).toBe('');
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

  it('flashes a bonus in the accent and anything else muted, then clears', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.flashRally('+10 rally');
    expect(root.querySelector('.flash')?.classList.contains('is-bonus')).toBe(true);
    hud.flashRally('no bonus', 500);
    expect(root.querySelector('.flash')?.classList.contains('is-bonus')).toBe(false);
    vi.advanceTimersByTime(500);
    expect(root.querySelector('.flash')).toBeNull();
  });

  it('toggles the key map, which clear() leaves alone', () => {
    const { root, hud } = fresh();
    expect(root.querySelector('.hud-keymap')).toBeNull();
    hud.showKeymap(true);
    const map = root.querySelector('.hud-keymap') as HTMLElement;
    expect(map.hidden).toBe(false);
    expect(map.textContent).toContain('Shift+R twice');
    hud.clear();
    expect(map.hidden).toBe(false);
    hud.showKeymap(false);
    expect(map.hidden).toBe(true);
  });

  it('clear() empties the screen and takes the banner down', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby());
    hud.showBanner({ name: null, letter: null, phone: null, footer: '' });
    hud.clear();
    expect(root.querySelector('.hud-screen')!.childElementCount).toBe(0);
    expect((root.querySelector('.banner') as HTMLElement).hidden).toBe(true);
  });
});

// ---- Task 8: the countdown patched in place, and the judged call-outs under the cards ------------------------
describe('options status and judged call-outs', () => {
  const vote = { options: options(['A', 'B', 'C', 'D']), leadLabel: 'Rogues', leadShares: null, supportShares: null, footer: 'Space locks the vote' };

  it('patches the timer and the vote count in place, without rebuilding the cards', () => {
    const { root, hud } = fresh();
    hud.showOptions({ ...vote, timerText: '30 s', votedText: '0 of 9 voted' });
    const card = root.querySelector('[data-card=A]');
    hud.updateOptionsStatus({ timerText: '29 s', votedText: '3 of 9 voted' });
    expect(text(root, '.status')).toBe('Rogues lead29 s3 of 9 votedSpace locks the vote');
    expect(root.querySelector('[data-card=A]')).toBe(card);
    hud.updateOptionsStatus({ timerText: '', votedText: '3 of 9 voted' });
    expect((root.querySelector('.timer') as HTMLElement).hidden).toBe(true);
    expect(text(root, '.status')).toBe('Rogues lead3 of 9 votedSpace locks the vote');
  });

  it('can show a timer the cards were drawn without', () => {
    const { root, hud } = fresh();
    hud.showOptions({ ...vote, timerText: '', votedText: '' });
    expect(text(root, '.status')).toBe('Rogues leadSpace locks the vote');
    hud.updateOptionsStatus({ timerText: '12 s', votedText: '12 voted' });
    expect((root.querySelector('.timer') as HTMLElement).hidden).toBe(false);
    expect(text(root, '.status')).toBe('Rogues lead12 s12 votedSpace locks the vote');
  });

  it('does nothing when the options are not up', () => {
    const { root, hud } = fresh();
    hud.updateOptionsStatus({ timerText: '9 s', votedText: '1 voted' });
    expect(root.querySelector('.hud-screen')!.childElementCount).toBe(0);
    hud.showOptions({ ...vote, timerText: '30 s', votedText: '0 voted' });
    let timer = root.querySelector('.timer')!;
    hud.showNarration({ boss: 'Grid Wyrm', title: 't', narration: 'n', footer: '' });
    hud.updateOptionsStatus({ timerText: '9 s', votedText: '1 voted' });
    expect(root.textContent).not.toContain('9 s');
    expect(timer.textContent).toBe('30 s');   // the status line that went with the cards is left alone too
    hud.showOptions({ ...vote, timerText: '30 s', votedText: '0 voted' });
    timer = root.querySelector('.timer')!;
    hud.clear();
    hud.updateOptionsStatus({ timerText: '9 s', votedText: '1 voted' });
    expect(timer.textContent).toBe('30 s');
  });

  it('lists the judged call-outs small under the cards, as text, and nothing when there are none', () => {
    const { root, hud } = fresh();
    hud.showOptions({ ...vote, timerText: '', votedText: '' });
    expect(root.querySelector('.resolved')).toBeNull();
    expect(root.querySelector('.options')!.classList.contains('has-resolved')).toBe(false);
    hud.showOptions({ ...vote, timerText: '', votedText: '', resolved: [] });
    expect(root.querySelector('.resolved')).toBeNull();
    hud.showOptions({ ...vote, timerText: '', votedText: '', resolved: ['Sarah: +10 rally', '<b>Ann</b>: no bonus'] });
    expect([...root.querySelectorAll('.resolved li')].map((li) => li.textContent)).toEqual(['Sarah: +10 rally', '<b>Ann</b>: no bonus']);
    expect(root.querySelector('.resolved b')).toBeNull();
    expect(root.querySelector('.options')!.classList.contains('has-resolved')).toBe(true);
    expect(root.querySelector('.cards + .resolved')).not.toBeNull();   // after the cards, so it sits under them
  });
});

// ---- Task 8 fix round 1: the timed toast taken down at a skip, and the quotes attributed from one place ---------
import { SPEAKERS } from '../host/quotes';

describe('timed toast and quote attributions', () => {
  it('clearTimedToast() takes down the timed toast and leaves the sticky one', () => {
    vi.useFakeTimers();
    const { root, hud } = fresh();
    hud.showToast('Reconnecting to the room', 0);
    hud.showToast('No Rogues voted this round', 3100);
    hud.clearTimedToast();
    expect([...root.querySelectorAll('.toast')].map((t) => t.textContent)).toEqual(['Reconnecting to the room']);
    hud.clearTimedToast();   // nothing left to take down
    vi.advanceTimersByTime(4000);
    expect([...root.querySelectorAll('.toast')].map((t) => t.textContent)).toEqual(['Reconnecting to the room']);
  });

  it('frames the lobby quotes with the speakers and citations from host/quotes.ts', () => {
    const { root, hud } = fresh();
    hud.showLobby(lobby());
    const quotes = [...root.querySelectorAll('.quote')].map((q) => q.textContent);
    expect(quotes).toEqual([`“single biggest step” ${SPEAKERS.smith}`, `“not failed or withdrawn” ${SPEAKERS.tanui}`]);
  });
});
