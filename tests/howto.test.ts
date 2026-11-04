// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import raw from '../content/case.json';
import type { Sound } from '../host/audio/sound';
import { installHotkeys } from '../host/hotkeys';
import { howtoSlides, installHowTo } from '../host/howto';
import { Hud } from '../host/hud/Hud';
import { installMenu } from '../host/menu';
import type { RoomClient } from '../host/net';
import { loadContent } from '../shared/content';

const c = loadContent(raw);
/** The sound facade, silent: the menu and the keys take one. */
const sound: Sound = { music: vi.fn(), tension: vi.fn(), sfx: vi.fn(), hit: vi.fn(), join: vi.fn(), toggle: vi.fn(() => true), enabled: true };

it('eight slides from the case: the first boss, its question and options, the lead class, the constants', () => {
  const s = howtoSlides(c);
  expect(s.map((x) => x.kind)).toEqual(['title', 'join', 'round', 'lead', 'points', 'damage', 'ending', 'awards']);
  const [title, join, round, lead, points, damage, ending, awards] = s;
  if (title.kind !== 'title' || join.kind !== 'join' || round.kind !== 'round' || lead.kind !== 'lead' || points.kind !== 'points' || damage.kind !== 'damage' || ending.kind !== 'ending' || awards.kind !== 'awards') throw new Error('kinds');
  expect([title.name, title.sub]).toEqual(['Olkaria', 'the Deadlock']);
  expect(title.party.map((p) => [p.role, p.className, p.stakeholder])).toEqual([['citizen', 'Rogue', 'Citizen'], ['government', 'Knight', 'Kenyan Government'], ['business', 'Bard', 'Local Businesses'], ['microsoft', 'Wizard', 'Microsoft']]);
  expect(join.steps).toEqual(['Scan the code on the screen', 'Pick your class', 'Type your name']);
  expect(round).toMatchObject({ boss: 'Grid Wyrm', question: 'What will Kenyans accept on power?', hp: 100, clock: '2:00', hit: 62 });
  expect(round.options.map((o) => o.letter)).toEqual(['A', 'B', 'C', 'D']);
  expect(round.options[1].label).toBe('Yes to 60 to 100 MW, tied');
  expect(round.lines).toEqual(['Talk at your table. Vote on your phone.', 'The clock stops when everyone has voted.']);
  expect(lead.lead).toBe('citizen');
  expect(lead.halves).toEqual(['Lead class', 'The rest of the party']);
  expect(points.chips.map((ch) => ch.value)).toEqual(['0 to 100', 'up to +20', '+10', '+10', '+30']);
  expect(damage.chunks.map((ch) => ch.width)).toEqual([50, 15, 10, 15, 10]);
  expect(damage.chunks.map((ch) => ch.note)).toEqual(['0 to 100', '+15', '+10', '+5 each, up to 3', '+10 each, up to 4']);
  expect(damage.chunks[1].label).toBe('Focus: 60% or more of you on one option');
  expect(damage.line).toBe('Four bosses, 100 each. 400 in all.');
  expect(ending).toMatchObject({ max: 400, fragile: 180, decisive: 260, fill: 260, holds: 'Under 180, the Deadlock holds.' });
  expect(ending.lines[0]).toBe('Microsoft decides.');
  expect(awards.items).toEqual(['Top five players', 'Most consistent strategist', 'Top table']);
});

it('no slide gives away an option score by letter, a debrief, a projector line or an ending title', () => {
  const text = JSON.stringify(howtoSlides(c));
  for (const r of c.rounds.slice(0, 3)) for (const o of r.options) {
    expect(text).not.toContain(o.debrief);
    expect(text).not.toContain(o.projector);
    expect(text).not.toContain(`${o.id} ${o.score}`);
  }
  for (const [key, e] of Object.entries(c.endings)) if (key !== 'holds') expect(text).not.toContain(e.title);
  expect(text).not.toMatch(/[\u2013\u2014]/);
});
it('the damage track never holds more than the HP of one boss, however large the content makes the bonuses', () => {
  const widths = (roundHp: number): number[] => {
    const damage = howtoSlides({ ...c, scoring: { ...c.scoring, roundHp } }).find((s) => s.kind === 'damage');
    if (damage?.kind !== 'damage') throw new Error('no damage slide');
    return damage.chunks.map((ch) => ch.width);
  };
  const sum = (ws: number[]): number => ws.reduce((a, b) => a + b, 0);
  expect(widths(100)).toEqual([50, 15, 10, 15, 10]);   // the case: the evidence fills what the bonuses leave
  expect(widths(40)).toEqual([0, 15, 10, 15, 0]);      // bonuses past the HP: the track fills in order and stops full
  expect(sum(widths(40))).toBe(40);
  for (const hp of [1, 25, 49, 50, 51]) {
    expect(sum(widths(hp))).toBe(hp);
    expect(widths(hp).every((w) => w >= 0)).toBe(true);
  }
});
it('every line that counts the bosses reads the count from the rounds, in sentence case', () => {
  const lines = (content: typeof c): string[] => howtoSlides(content).flatMap((s) => ('line' in s ? [s.line] : []));
  expect(lines(c)).toEqual(['Four classes. One party. Four bosses.', 'Points add up over four bosses. Top five at the end.', 'Four bosses, 100 each. 400 in all.']);
  expect(lines({ ...c, rounds: c.rounds.slice(0, 3) })).toEqual(['Four classes. One party. Three bosses.', 'Points add up over three bosses. Top five at the end.', 'Three bosses, 100 each. 300 in all.']);
});

// ---- The keys: ? opens the how-to over any screen, and while it is up no key gets past it but M ------------------

let root: HTMLElement;
let hud: Hud;
let dispose: () => void = () => {};

beforeEach(() => {
  root = document.createElement('div');
  document.body.append(root);
  hud = new Hud(root);
  dispose = installHowTo(hud, c).dispose;
});
afterEach(() => {
  dispose();
  root.remove();
});

function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

it('? opens the how-to at the first slide; Space, the arrows and Esc walk and close it; the last slide closes on Space', () => {
  press('?', { shiftKey: true });
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  press(' ');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);
  press('ArrowRight');
  press('PageDown');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[3]);
  press('ArrowLeft');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[2]);
  press('Escape');
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  for (let i = 0; i < 7; i++) press(' ');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[7]);
  press(' ');
  expect(root.querySelector('.hud-howto')).toBeNull();
});
it('the first slide stays on back, a held key does nothing, and a click on the slide goes on', () => {
  press('?', { shiftKey: true });
  press('ArrowLeft');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  press(' ', { repeat: true });
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  (root.querySelector('.howto-slide') as HTMLElement).click();
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);
});
it('while open it stops every key before a bubble listener, chords included but never prevented, and M closes it and passes on', () => {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  press(' ');
  expect(heard).toHaveBeenCalledTimes(1);   // closed: Space passes
  press('?', { shiftKey: true });
  expect(heard).toHaveBeenCalledTimes(1);   // the opening press is stopped
  press(' ');
  press('x');
  expect(heard).toHaveBeenCalledTimes(1);
  for (const flag of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    const chord = new KeyboardEvent('keydown', { key: ' ', [flag]: true, bubbles: true, cancelable: true });
    window.dispatchEvent(chord);
    expect(heard).toHaveBeenCalledTimes(1);   // a chord is stopped on its way to the scenes
    expect(chord.defaultPrevented).toBe(false);   // but never prevented: Cmd+R still reloads
  }
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[1]);   // chorded Space did not advance
  press('m');
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(heard).toHaveBeenCalledTimes(2);   // M went on to the next listener
  const closedChord = new KeyboardEvent('keydown', { key: '?', shiftKey: true, metaKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(closedChord);
  expect(root.querySelector('.hud-howto')).toBeNull();   // closed, a chord never opens it
  expect(heard).toHaveBeenCalledTimes(3);   // and passes untouched
  window.removeEventListener('keydown', heard);
});
it('? does nothing while typing, while the menu is up, or when held; dispose takes it all down', () => {
  const input = document.createElement('input');
  document.body.append(input);
  input.focus();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  input.remove();
  hud.showMenu({ actions: [], stages: [], stagesHint: '', onPick: () => {}, onClose: () => {} });
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  hud.showMenu(null);
  press('?', { shiftKey: true, repeat: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).not.toBeNull();
  dispose();
  expect(root.querySelector('.hud-howto')).toBeNull();
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
});

// ---- Beyond the brief: the tests above are its code unchanged -----------------------------------------------------

it('installed before the menu, as main.ts does: Esc closes the how-to and leaves the menu shut, a walk key is prevented, and M opens the menu on the same press', () => {
  const game = { registry: { get: () => null, events: { on: () => {}, off: () => {} } } } as unknown as Phaser.Game;
  const client = { send: vi.fn(), mode: 'offline', onStatus: () => () => {} } as unknown as RoomClient;
  const disposeMenu = installMenu(game, client, hud, c, sound);
  press('?', { shiftKey: true });
  press('Escape');
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(hud.menuOpen()).toBe(false);   // the menu's listener never heard the Esc
  press('?', { shiftKey: true });
  const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
  window.dispatchEvent(space);
  expect(space.defaultPrevented).toBe(true);
  press('m');
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(hud.menuOpen()).toBe(true);
  press('?', { shiftKey: true });   // with the menu up, ? does nothing
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(client.send).not.toHaveBeenCalled();
  disposeMenu();
});
it('opening the how-to calls off a Shift+R that waits for its second press, as any other key does', () => {
  const send = vi.fn();
  const game = { registry: { get: () => null } } as unknown as Phaser.Game;
  const offHotkeys = installHotkeys(game, { send } as unknown as RoomClient, hud, sound);
  const shiftR = (): void => press('R', { code: 'KeyR', shiftKey: true });
  shiftR();
  press('?', { shiftKey: true });
  press('?', { shiftKey: true });
  shiftR();
  expect(send).not.toHaveBeenCalled();
  shiftR();
  expect(send).toHaveBeenCalledWith({ k: 'reset' });
  offHotkeys();
});
it('? closes it again, Enter and ArrowDown go on, and ArrowUp and PageUp go back', () => {
  const at = (): number => [...root.querySelectorAll('.howto-dot')].findIndex((d) => d.hasAttribute('aria-current'));
  press('?', { shiftKey: true });
  press('Enter');
  press('ArrowDown');
  expect(at()).toBe(2);
  press('ArrowUp');
  expect(at()).toBe(1);
  press('PageUp');
  expect(at()).toBe(0);
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
});
it('Tab does nothing while it is up: it is stopped and prevented, so the focus never leaves the page', () => {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  press('?', { shiftKey: true });
  for (const shiftKey of [false, true]) {
    const tab = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    window.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
  }
  expect(heard).not.toHaveBeenCalled();
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[0]);
  window.removeEventListener('keydown', heard);
});
it('a key it does not name is stopped but never prevented, and M held down or in a chord leaves it up', () => {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  press('?', { shiftKey: true });
  const other = new KeyboardEvent('keydown', { key: 'x', bubbles: true, cancelable: true });
  window.dispatchEvent(other);
  expect(other.defaultPrevented).toBe(false);
  press('m', { repeat: true });
  for (const flag of ['ctrlKey', 'metaKey', 'altKey'] as const) press('m', { [flag]: true });
  expect(root.querySelector('.hud-howto')).not.toBeNull();
  expect(heard).not.toHaveBeenCalled();
  window.removeEventListener('keydown', heard);
});
it('installing again takes down the earlier install, so one press opens one how-to', () => {
  const second = document.createElement('div');
  document.body.append(second);
  const again = installHowTo(new Hud(second), c);
  press('?', { shiftKey: true });
  expect(root.querySelector('.hud-howto')).toBeNull();
  expect(second.querySelector('.hud-howto')).not.toBeNull();
  again.dispose();
  second.remove();
});
it('main.ts installs the how-to before the menu, the order that lets the how-to stop every key first', () => {
  const main = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'host', 'main.ts'), 'utf8');
  const howto = main.indexOf('installHowTo(');
  const menu = main.indexOf('installMenu(');
  expect(howto).toBeGreaterThan(-1);
  expect(menu).toBeGreaterThan(howto);
});
