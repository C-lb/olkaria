// @vitest-environment happy-dom
// The facilitator menu: what each item says and does, and the keys and clicks that open, walk and fire it.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import raw from '../content/case.json';
import type { Sound } from '../host/audio/sound';
import { installHotkeys } from '../host/hotkeys';
import { Hud } from '../host/hud/Hud';
import { ARM_MS, DEAD_MS, installMenu, menuItems } from '../host/menu';
import type { ConnectionStatus, RoomClient } from '../host/net';
import { loadContent } from '../shared/content';
import { hostView, initialState } from '../shared/room-logic';
import type { HostView } from '../shared/types';

const c = loadContent(raw);
const T0 = 1_000_000;
const lobbyView: HostView = hostView(initialState('ABCD', 'host', T0, c), T0, c);

let view: HostView | null = lobbyView;
/** The menu's 'changedata-view' listeners, so a test can deliver a new view the way the registry does. */
const viewListeners = new Set<() => void>();
const game = {
  registry: {
    get: (key: string) => (key === 'view' ? view : undefined),
    events: {
      on: vi.fn((name: string, fn: () => void) => { if (name === 'changedata-view') viewListeners.add(fn); }),
      off: vi.fn((name: string, fn: () => void) => { if (name === 'changedata-view') viewListeners.delete(fn); }),
    },
  },
} as unknown as Phaser.Game;
let status: (s: ConnectionStatus) => void = () => {};
const send = vi.fn();
/** What the client's onStatus hands back: the menu calls it to stop listening. */
const offStatus = vi.fn();
const client = { send, mode: 'online', onStatus: vi.fn((cb: (s: ConnectionStatus) => void) => { status = cb; return offStatus; }) } as unknown as RoomClient;
const reload = vi.fn();
/** A stand-in for the sound facade: toggle() flips `soundOn` and returns it, as the real one does. */
let soundOn = true;
const sound = {
  music: vi.fn(), tension: vi.fn(), sfx: vi.fn(), hit: vi.fn(), join: vi.fn(),
  toggle: vi.fn(() => { soundOn = !soundOn; return soundOn; }),
  get enabled() { return soundOn; },
} satisfies Sound;
let root: HTMLElement;
let dispose: () => void = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  view = lobbyView;
  soundOn = true;
  root = document.createElement('div');
  document.body.append(root);
  dispose = installMenu(game, client, new Hud(root), c, sound, reload);
  status('open');
});
afterEach(() => {
  dispose();
  root.remove();
  vi.useRealTimers();
});

function press(key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

it('lists the actions and the stages for the lobby online', () => {
  const m = menuItems(c, lobbyView, 'online', 'open', { enabled: true });
  expect(m.actions.map((a) => [a.id, a.label, a.enabled, a.confirm])).toEqual([
    ['restart', 'Restart the round', false, true], ['lobby', 'Back to the lobby', false, true], ['reload', 'Reload the page', true, false],
    ['sound', 'Sound off', true, false]]);
  expect(m.actions[2].hint).toBe('The same room and screen come back.');
  expect(m.stages.map((s) => s.label)).toEqual(['1 Grid Wyrm', '2 Debt Golem', '3 Fog of Demand', '4 The core', 'Ending']);
  expect(m.stages.map((s) => s.act)).toEqual([0, 1, 2, 3, 4].map((stage) => ({ kind: 'cmd', cmd: { k: 'goto', stage } })));
  expect(m.stages.every((s) => s.enabled && s.confirm)).toBe(true);
});
it('names the round to restart and sends goto for it; offline the reload is disabled and says why', () => {
  const m = menuItems(c, { ...lobbyView, phase: 'reveal', round: 2 }, 'offline', 'open', { enabled: true });
  expect(m.actions[0]).toMatchObject({ label: 'Restart round 3', enabled: true, act: { kind: 'cmd', cmd: { k: 'goto', stage: 2 } } });
  expect(m.actions[1]).toMatchObject({ enabled: true, act: { kind: 'cmd', cmd: { k: 'reset' } } });
  expect(m.actions[2]).toMatchObject({ enabled: false, hint: 'Offline mode starts over on a reload. Use Back to the lobby.', act: { kind: 'reload' } });
});
it('online with the link down, the reload asks twice and says it needs the network', () => {
  for (const link of ['closed', 'gone', null] as const) {
    expect(menuItems(c, lobbyView, 'online', link, { enabled: true }).actions[2]).toMatchObject({ enabled: true, confirm: true, hint: 'Needs the network. Without it the page is lost.' });
  }
});
it('with no view yet only the reload is enabled', () => {
  const m = menuItems(c, null, 'online', 'open', { enabled: true });
  expect([...m.actions, ...m.stages].filter((i) => i.enabled).map((i) => i.id)).toEqual(['reload', 'sound']);
});
it('the fourth action turns the sound off or on, by its state, and never asks twice', () => {
  expect(menuItems(c, lobbyView, 'online', 'open', { enabled: true }).actions[3]).toEqual(
    { id: 'sound', label: 'Sound off', hint: 'S does the same.', enabled: true, confirm: false, act: { kind: 'sound' } });
  expect(menuItems(c, null, 'offline', null, { enabled: false }).actions[3]).toMatchObject({ label: 'Sound on', enabled: true, confirm: false });
});
it('picking Sound toggles it and keeps the menu open, relabelled; opening and closing each play their blip', () => {
  press('m');
  expect(sound.sfx.mock.calls).toEqual([['menuOpen']]);
  const item = (): HTMLButtonElement => root.querySelector('[data-menu-item=sound]') as HTMLButtonElement;
  expect(item().textContent).toContain('Sound off');
  item().click();
  expect(sound.toggle).toHaveBeenCalledTimes(1);
  expect(root.querySelector('[role=dialog]')).not.toBeNull();
  expect(item().textContent).toContain('Sound on');
  item().click();
  expect(sound.toggle).toHaveBeenCalledTimes(2);
  expect(item().textContent).toContain('Sound off');
  expect(send).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  press('Escape');
  expect(root.querySelector('[role=dialog]')).toBeNull();
  expect(sound.sfx.mock.calls).toEqual([['menuOpen'], ['menuClose']]);
});
it('M opens with nothing focused, Esc closes, and M typed into a field does nothing', () => {
  press('m');
  expect(root.querySelector('[role=dialog][aria-label=Menu]')).not.toBeNull();
  expect(document.activeElement?.hasAttribute('data-menu-item') ?? false).toBe(false);
  press('Escape');
  expect(root.querySelector('[role=dialog][aria-label=Menu]')).toBeNull();
  const field = document.createElement('input'); document.body.append(field); field.focus();
  press('m');
  expect(root.querySelector('[role=dialog]')).toBeNull();
  field.remove();
});
it('swallows key presses while open, chords too but left to the browser, and lets releases through', () => {
  const seen = vi.fn();
  window.addEventListener('keydown', seen); window.addEventListener('keyup', seen);
  press('m');
  press('2'); press(' '); press('n');
  const chord = new KeyboardEvent('keydown', { key: ' ', ctrlKey: true, bubbles: true, cancelable: true });
  window.dispatchEvent(chord);
  expect(seen).not.toHaveBeenCalled();
  expect(chord.defaultPrevented).toBe(false);   // never prevented, so Cmd+R still reloads
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  expect(seen).toHaveBeenCalledTimes(1);
  press('Escape');
  press(' ', { ctrlKey: true });   // closed, the same chord passes untouched
  expect(seen).toHaveBeenCalledTimes(2);
  const passed = seen.mock.calls[1][0] as KeyboardEvent;
  expect([passed.type, passed.key, passed.ctrlKey, passed.defaultPrevented]).toEqual(['keydown', ' ', true, false]);
  expect(send).not.toHaveBeenCalled();
  window.removeEventListener('keydown', seen); window.removeEventListener('keyup', seen);
});
it('arms a room-changing item on the first press and fires it on the second within 3 s', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  const lobby = root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement;
  lobby.click();
  expect(root.querySelector('[data-menu-item=lobby]')!.textContent).toContain('Sure?');
  expect(send).not.toHaveBeenCalled();
  vi.advanceTimersByTime(ARM_MS + 1);
  expect(root.querySelector('[data-menu-item=lobby]')!.textContent).toContain('Back to the lobby');
  (root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement).click();
  vi.advanceTimersByTime(DEAD_MS);
  (root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'reset' });
  expect(root.querySelector('[role=dialog]')).toBeNull();
});
it('a second press within 300 ms of the one that armed an item is the same press: it stays armed and sends nothing', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  const lobby = () => root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement;
  lobby().click();
  vi.advanceTimersByTime(100);
  lobby().click();   // a double-click, or a bounce of the key
  expect(send).not.toHaveBeenCalled();
  expect(lobby().hasAttribute('data-armed')).toBe(true);
  // The ignored press leaves the arming's time alone: it still lapses 3 s after the press that armed it.
  vi.advanceTimersByTime(ARM_MS - 100 - 1);
  expect(lobby().hasAttribute('data-armed')).toBe(true);
  vi.advanceTimersByTime(2);
  expect(lobby().hasAttribute('data-armed')).toBe(false);
  expect(send).not.toHaveBeenCalled();
});
it('a second press 400 ms after the arming one fires it, once', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  (root.querySelector('[data-menu-item=stage-3]') as HTMLButtonElement).click();
  vi.advanceTimersByTime(400);
  (root.querySelector('[data-menu-item=stage-3]') as HTMLButtonElement).click();
  expect(send.mock.calls).toEqual([[{ k: 'goto', stage: 3 }]]);
  expect(root.querySelector('[role=dialog]')).toBeNull();
});
it('draws the panel again only when a view changes what it shows, so a click that spans a broadcast is not lost', () => {
  const vote: HostView = { ...lobbyView, phase: 'vote', round: 0 };
  view = vote;
  press('m');
  const panel = root.querySelector('.hud-menu');
  const joiner = { id: 'p9', name: 'Ann', role: 'citizen' as const, table: null, joinedAt: T0, score: 0, lastPoints: 0, votes: {} };
  view = { ...vote, updatedAt: vote.updatedAt + 1, players: { p9: joiner } };   // a join: nothing the menu shows changes
  for (const fn of viewListeners) fn();
  expect(root.querySelector('.hud-menu')).toBe(panel);
  view = { ...vote, updatedAt: vote.updatedAt + 2, round: 1 };
  for (const fn of viewListeners) fn();
  expect(root.querySelector('.hud-menu')).not.toBe(panel);
  expect(root.querySelector('[data-menu-item=restart]')!.textContent).toContain('Restart round 2');
});
it('a press on another item moves the arming', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  (root.querySelector('[data-menu-item=restart]') as HTMLButtonElement).click();
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(root.querySelector('[data-menu-item=restart]')!.hasAttribute('data-armed')).toBe(false);
  expect(root.querySelector('[data-menu-item=stage-2]')!.hasAttribute('data-armed')).toBe(true);
  vi.advanceTimersByTime(DEAD_MS);
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'goto', stage: 2 });
});
it('the arrows walk the enabled buttons, wrapping, and Enter presses the focused one', () => {
  press('m');   // lobby: restart and lobby are disabled, so the first enabled is reload
  press('ArrowRight');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('reload');
  press('ArrowDown');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('sound');
  press('ArrowLeft'); press('ArrowUp');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-4');
  press('Enter');
  vi.advanceTimersByTime(DEAD_MS);
  press('Enter');
  expect(send).toHaveBeenCalledWith({ k: 'goto', stage: 4 });
});
it('reload fires at once while the link is up, asks twice once it drops, and a click on the scrim closes', () => {
  press('m');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(reload).toHaveBeenCalledTimes(1);
  status('closed');
  press('m');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(reload).toHaveBeenCalledTimes(1);
  expect(root.querySelector('[data-menu-item=reload]')!.hasAttribute('data-armed')).toBe(true);
  (root.querySelector('.hud-menu') as HTMLElement).click();
  expect(root.querySelector('[role=dialog]')).toBeNull();
});

// ---- Tab, closing, redraws, held keys, chords, installs and the link -----------------------------------------

it('Tab and Shift+Tab walk the focus like the arrows, so it never leaves the page', () => {
  press('m');   // lobby: the first enabled is reload, the last the ending
  const tab = (shiftKey: boolean): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event;
  };
  expect(tab(false).defaultPrevented).toBe(true);
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('reload');
  tab(false);
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('sound');
  expect(tab(true).defaultPrevented).toBe(true);
  tab(true);
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-4');   // back past the first, to the last
});
it('closing disarms: an item armed before Esc does not bring the menu back when its time runs out', () => {
  press('m');
  (root.querySelector('[data-menu-item=stage-0]') as HTMLButtonElement).click();
  expect(root.querySelector('[data-menu-item=stage-0]')!.hasAttribute('data-armed')).toBe(true);
  press('Escape');
  vi.advanceTimersByTime(ARM_MS + 1);
  expect(document.querySelector('.hud-menu')).toBeNull();
});

it('redraws for a new view while open, and stops listening for views once closed', () => {
  press('m');
  expect((root.querySelector('[data-menu-item=restart]') as HTMLButtonElement).disabled).toBe(true);
  view = { ...lobbyView, phase: 'vote', round: 0 };
  for (const fn of viewListeners) fn();
  const restart = root.querySelector('[data-menu-item=restart]') as HTMLButtonElement;
  expect(restart.disabled).toBe(false);
  expect(restart.textContent).toContain('Restart round 1');
  press('m');
  expect(viewListeners.size).toBe(0);
});
it('redraws when the link changes while open: a reload armed while the link was down fires at once when it is back', () => {
  status('closed');
  press('m');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(root.querySelector('[data-menu-item=reload]')!.hasAttribute('data-armed')).toBe(true);
  status('open');
  expect(root.querySelector('[data-menu-item=reload]')!.hasAttribute('data-armed')).toBe(false);
  expect(root.querySelector('[data-menu-item=reload] .menu-hint')!.textContent).toBe('The same room and screen come back.');
  (root.querySelector('[data-menu-item=reload]') as HTMLButtonElement).click();
  expect(reload).toHaveBeenCalledTimes(1);
});
it('a held key does not repeat: M held down leaves the menu open, and Enter held on an item only arms it', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  press('m', { repeat: true });
  expect(root.querySelector('[role=dialog]')).not.toBeNull();
  press('ArrowRight');
  press('Enter');
  press('Enter', { repeat: true });
  expect(send).not.toHaveBeenCalled();
  expect(root.querySelector('[data-menu-item=restart]')!.hasAttribute('data-armed')).toBe(true);
});
it('replaces an earlier install, so one press opens one menu, and its disposer takes an open menu down', () => {
  const second = document.createElement('div');
  document.body.append(second);
  const again = installMenu(game, client, new Hud(second), c, sound, reload);
  press('m');
  expect(root.querySelector('[role=dialog]')).toBeNull();
  expect(second.querySelector('[role=dialog]')).not.toBeNull();
  again();
  expect(second.querySelector('[role=dialog]')).toBeNull();
  press('m');
  expect(second.querySelector('[role=dialog]')).toBeNull();
  second.remove();
});
it('opening the menu calls off a Shift+R that waits for its second press, as any other key does', () => {
  const offHotkeys = installHotkeys(game, client, new Hud(document.createElement('div')), sound);
  const shiftR = (): void => press('R', { code: 'KeyR', shiftKey: true });
  shiftR();   // the first press: the reset waits for the second
  press('m');
  press('Escape');
  shiftR();   // a first press again, not the second
  expect(send).not.toHaveBeenCalled();
  shiftR();
  expect(send).toHaveBeenCalledWith({ k: 'reset' });
  offHotkeys();
});
it('a Ctrl, Cmd or Alt chord on M never opens the menu, and while it is open a chord is stopped but never prevented', () => {
  const heard = vi.fn();
  window.addEventListener('keydown', heard);
  const chord = (key: string, flag: 'ctrlKey' | 'metaKey' | 'altKey'): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, [flag]: true, bubbles: true, cancelable: true });
    window.dispatchEvent(event);
    return event;
  };
  for (const flag of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    expect(chord('m', flag).defaultPrevented).toBe(false);
    expect(root.querySelector('[role=dialog]')).toBeNull();
  }
  expect(heard).toHaveBeenCalledTimes(3);   // shut, a chord passes untouched
  press('m');
  for (const flag of ['ctrlKey', 'metaKey', 'altKey'] as const) {
    expect(chord('Escape', flag).defaultPrevented).toBe(false);
    expect(root.querySelector('[role=dialog]')).not.toBeNull();   // a chorded Esc does not close it
  }
  expect(heard).toHaveBeenCalledTimes(3);   // open, every chord stops at the menu
  window.removeEventListener('keydown', heard);
});
it('a change of link while the menu is shut draws nothing, and dispose stops listening to the link', () => {
  status('closed');
  status('open');
  expect(root.querySelector('.hud-menu')).toBeNull();
  expect(offStatus).not.toHaveBeenCalled();
  dispose();
  expect(offStatus).toHaveBeenCalledTimes(1);
});
