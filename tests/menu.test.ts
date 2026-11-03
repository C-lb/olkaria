// @vitest-environment happy-dom
// The facilitator menu: what each item says and does, and the keys and clicks that open, walk and fire it.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import raw from '../content/case.json';
import { Hud } from '../host/hud/Hud';
import { ARM_MS, installMenu, menuItems } from '../host/menu';
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
const client = { send, mode: 'online', onStatus: vi.fn((cb: (s: ConnectionStatus) => void) => { status = cb; return () => {}; }) } as unknown as RoomClient;
const reload = vi.fn();
let root: HTMLElement;
let dispose: () => void = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  view = lobbyView;
  root = document.createElement('div');
  document.body.append(root);
  dispose = installMenu(game, client, new Hud(root), c, reload);
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
  const m = menuItems(c, lobbyView, 'online', 'open');
  expect(m.actions.map((a) => [a.id, a.label, a.enabled, a.confirm])).toEqual([
    ['restart', 'Restart the round', false, true], ['lobby', 'Back to the lobby', false, true], ['reload', 'Reload the page', true, false]]);
  expect(m.actions[2].hint).toBe('The same room and screen come back.');
  expect(m.stages.map((s) => s.label)).toEqual(['1 Grid Wyrm', '2 Debt Golem', '3 Fog of Demand', '4 The core', 'Ending']);
  expect(m.stages.map((s) => s.act)).toEqual([0, 1, 2, 3, 4].map((stage) => ({ kind: 'cmd', cmd: { k: 'goto', stage } })));
  expect(m.stages.every((s) => s.enabled && s.confirm)).toBe(true);
});
it('names the round to restart and sends goto for it; offline the reload is disabled and says why', () => {
  const m = menuItems(c, { ...lobbyView, phase: 'reveal', round: 2 }, 'offline', 'open');
  expect(m.actions[0]).toMatchObject({ label: 'Restart round 3', enabled: true, act: { kind: 'cmd', cmd: { k: 'goto', stage: 2 } } });
  expect(m.actions[1]).toMatchObject({ enabled: true, act: { kind: 'cmd', cmd: { k: 'reset' } } });
  expect(m.actions[2]).toMatchObject({ enabled: false, hint: 'Offline mode starts over on a reload. Use Back to the lobby.', act: { kind: 'reload' } });
});
it('online with the link down, the reload asks twice and says it needs the network', () => {
  for (const link of ['closed', 'gone', null] as const) {
    expect(menuItems(c, lobbyView, 'online', link).actions[2]).toMatchObject({ enabled: true, confirm: true, hint: 'Needs the network. Without it the page is lost.' });
  }
});
it('with no view yet only the reload is enabled', () => {
  const m = menuItems(c, null, 'online', 'open');
  expect([...m.actions, ...m.stages].filter((i) => i.enabled).map((i) => i.id)).toEqual(['reload']);
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
it('swallows key presses while open and lets releases and browser chords through', () => {
  const seen = vi.fn();
  window.addEventListener('keydown', seen); window.addEventListener('keyup', seen);
  press('m');
  press('2'); press(' '); press('n');
  expect(seen).not.toHaveBeenCalled();
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true }));
  press('r', { metaKey: true });
  expect(seen).toHaveBeenCalledTimes(2);
  expect(send).not.toHaveBeenCalled();
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
  (root.querySelector('[data-menu-item=lobby]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'reset' });
  expect(root.querySelector('[role=dialog]')).toBeNull();
});
it('a press on another item moves the arming', () => {
  view = { ...lobbyView, phase: 'reveal', round: 1 };
  press('m');
  (root.querySelector('[data-menu-item=restart]') as HTMLButtonElement).click();
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(root.querySelector('[data-menu-item=restart]')!.hasAttribute('data-armed')).toBe(false);
  expect(root.querySelector('[data-menu-item=stage-2]')!.hasAttribute('data-armed')).toBe(true);
  (root.querySelector('[data-menu-item=stage-2]') as HTMLButtonElement).click();
  expect(send).toHaveBeenCalledWith({ k: 'goto', stage: 2 });
});
it('the arrows walk the enabled buttons, wrapping, and Enter presses the focused one', () => {
  press('m');   // lobby: restart and lobby are disabled, so the first enabled is reload
  press('ArrowRight');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('reload');
  press('ArrowDown');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-0');
  press('ArrowLeft'); press('ArrowUp');
  expect(document.activeElement?.getAttribute('data-menu-item')).toBe('stage-4');
  press('Enter'); press('Enter');
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

// ---- Beyond the brief: the tests above are its code unchanged ----------------------------------------------

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
  const again = installMenu(game, client, new Hud(second), c, reload);
  press('m');
  expect(root.querySelector('[role=dialog]')).toBeNull();
  expect(second.querySelector('[role=dialog]')).not.toBeNull();
  again();
  expect(second.querySelector('[role=dialog]')).toBeNull();
  press('m');
  expect(second.querySelector('[role=dialog]')).toBeNull();
  second.remove();
});
