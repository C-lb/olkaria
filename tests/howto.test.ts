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

// These tests are about the slides and the keys. The markup is host/hud/HowTo.ts's, drawn here by a stand-in with the
// same dialog, slide and dots, so a test of the keys does not hang on how a slide looks.
vi.mock('../host/hud/HowTo', () => ({
  howToPanel: (a: { slide: { title: string; lines: string[] }; index: number; count: number; onNext: () => void }): HTMLElement => {
    const panel = document.createElement('div');
    panel.className = 'hud-howto';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'How to play');
    const slide = document.createElement('section');
    slide.className = 'howto-slide';
    slide.textContent = [a.slide.title, ...a.slide.lines].join(' ');
    slide.addEventListener('click', () => a.onNext());
    const dots = document.createElement('ol');
    for (let i = 0; i < a.count; i++) {
      const dot = document.createElement('li');
      dot.className = 'howto-dot';
      if (i === a.index) dot.setAttribute('aria-current', 'step');
      dots.append(dot);
    }
    panel.append(slide, dots);
    return panel;
  },
}));
/** The sound facade, silent: the menu and the keys take one. */
const sound: Sound = { music: vi.fn(), tension: vi.fn(), sfx: vi.fn(), hit: vi.fn(), join: vi.fn(), toggle: vi.fn(() => true), enabled: true };

it('five slides, each a title and one or two lines, with the vote time read from the settings', () => {
  expect(howtoSlides(c)).toEqual([
    { title: 'Join', lines: ['Scan the code. Pick your name, your role and your team.'] },
    { title: 'Five bosses', lines: ['Power, Demand, Competition, Risk, and the Deadlock. Each one guards a question.'] },
    { title: 'Vote', lines: ['Read the question on your phone and pick A, B or C. You have 2:00.'] },
    { title: 'Defend', lines: ['Then look at the screen. You may be called to defend your pick.'] },
    { title: 'The ending', lines: ['The last vote decides how it ends.'] },
  ]);
  const quick = howtoSlides({ ...c, settings: { ...c.settings, voteSeconds: 90 } });
  expect(quick[2].lines).toEqual(['Read the question on your phone and pick A, B or C. You have 1:30.']);
  for (const slide of howtoSlides(c)) expect(slide.lines.length).toBeGreaterThanOrEqual(1);
  for (const slide of howtoSlides(c)) expect(slide.lines.length).toBeLessThanOrEqual(2);
});

it('says nothing about points, scores, damage, a leaderboard or the old classes, and has no dashes', () => {
  for (const text of howtoSlides(c).flatMap((s) => [s.title, ...s.lines])) {
    expect(text).not.toMatch(/points|score|damage|leaderboard|Rogue|Knight|Bard|Wizard/i);
    expect(text).not.toMatch(/[\u2013\u2014]/);
  }
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
  for (let i = 0; i < 4; i++) press(' ');
  expect(root.querySelector('.howto-dot[aria-current]')).toBe(root.querySelectorAll('.howto-dot')[4]);
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
