// @vitest-environment happy-dom
// The facilitator's keys: what each sends, and what it must not.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { installHotkeys } from '../host/hotkeys';
import type { Hud } from '../host/hud/Hud';
import type { RoomClient } from '../host/net';
import type { Callout, HostView } from '../shared/types';

let view: Partial<HostView> | null = null;
const send = vi.fn();
const addBots = vi.fn();
const showToast = vi.fn();
const toggleFullscreen = vi.fn();
/** Every HUD method the keys call, by name. The HUD is a stand-in that has whatever is asked of it; showToast reaches its mock. */
const hudCalls: string[] = [];
const hud = new Proxy({}, {
  get: (_target, method) => (...args: unknown[]) => {
    hudCalls.push(String(method));
    if (method === 'showToast') showToast(...args);
  },
}) as unknown as Hud;

const game = { registry: { get: (key: string) => (key === 'view' ? view : undefined) }, scale: { toggleFullscreen } } as unknown as Phaser.Game;
const install = () => installHotkeys(game, { send, addBots } as unknown as RoomClient, hud);
let dispose: () => void = () => {};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  view = null;
  hudCalls.length = 0;
  dispose = install();
});
afterEach(() => {
  dispose();
  vi.useRealTimers();
});

function press(code: string, key: string, init: KeyboardEventInit = {}): void {
  window.dispatchEvent(new KeyboardEvent('keydown', { code, key, bubbles: true, ...init }));
}
const locked = (callouts: Callout[]): Partial<HostView> => ({ phase: 'locked', round: 1, callouts: { 1: callouts }, hideNames: false });

it('adds one vote per digit and ten with Shift, by key position', () => {
  press('Digit2', '2');
  press('Digit4', '$', { shiftKey: true });
  press('Numpad1', '1');
  expect(send.mock.calls.map(([cmd]) => cmd)).toEqual([
    { k: 'injectVotes', counts: { B: 1 } }, { k: 'injectVotes', counts: { D: 10 } }, { k: 'injectVotes', counts: { A: 1 } },
  ]);
  press('Digit5', '5');
  expect(send).toHaveBeenCalledTimes(3);
});

it('ignores held keys, browser chords and keys typed into a field', () => {
  press('KeyR', 'r', { repeat: true });
  press('KeyR', 'r', { metaKey: true });
  press('KeyR', 'r', { ctrlKey: true });
  const field = document.createElement('input');
  document.body.append(field);
  field.focus();
  press('KeyC', 'c');
  field.remove();
  expect(send).not.toHaveBeenCalled();
});

it('sends bots, call-outs, reopen and hide names', () => {
  press('KeyB', 'b');
  expect(addBots).toHaveBeenCalledWith(30);
  press('KeyC', 'c');
  press('KeyR', 'r');
  view = { phase: 'lobby', round: -1, hideNames: true };
  press('KeyH', 'h');
  expect(send.mock.calls.map(([cmd]) => cmd)).toEqual([{ k: 'callout' }, { k: 'reopen' }, { k: 'hideNames', hide: false }]);
});

it('judges with Y and N only while a call-out is pending in a locked vote', () => {
  press('KeyY', 'y');
  view = locked([{ playerId: 'p1', option: 'B', status: 'awarded', points: 30 }]);
  press('KeyN', 'n');
  expect(send).not.toHaveBeenCalled();
  view = locked([{ playerId: 'p1', option: 'B', status: 'awarded', points: 30 }, { playerId: null, option: null, status: 'pending', points: 0 }]);
  press('KeyY', 'y');
  press('KeyN', 'n');
  expect(send.mock.calls.map(([cmd]) => cmd)).toEqual([{ k: 'judge', awarded: true }, { k: 'judge', awarded: false }]);
  view = { ...view, phase: 'travel' };
  press('KeyN', 'n');
  expect(send).toHaveBeenCalledTimes(2);
});

it('resets only on a second Shift+R within 3 s, with no other key between', () => {
  press('KeyR', 'R', { shiftKey: true });
  expect(showToast).toHaveBeenCalledWith('Press Shift+R again to reset', 3000);
  press('ShiftLeft', 'Shift', { shiftKey: true });   // pressing Shift again on its own is not another key
  vi.advanceTimersByTime(2900);
  press('KeyR', 'R', { shiftKey: true });
  expect(send).toHaveBeenCalledWith({ k: 'reset' });

  send.mockClear();
  press('KeyR', 'R', { shiftKey: true });
  vi.advanceTimersByTime(3100);
  press('KeyR', 'R', { shiftKey: true });
  expect(send).not.toHaveBeenCalled();

  // That late press armed it again; a digit in between calls it off, so the next Shift+R only arms.
  press('Digit1', '!', { shiftKey: true });
  press('KeyR', 'R', { shiftKey: true });
  expect(send.mock.calls.map(([cmd]) => cmd)).toEqual([{ k: 'injectVotes', counts: { A: 10 } }]);
});

it('confirms a reset, and says so when another key calls it off', () => {
  press('KeyR', 'R', { shiftKey: true });
  press('KeyR', 'R', { shiftKey: true });
  press('KeyR', 'R', { shiftKey: true });
  press('KeyC', 'c');
  expect(showToast.mock.calls).toEqual([
    ['Press Shift+R again to reset', 3000], ['Room reset', 1500], ['Press Shift+R again to reset', 3000], ['Reset called off', 1500],
  ]);
  expect(send.mock.calls.map(([cmd]) => cmd)).toEqual([{ k: 'reset' }, { k: 'callout' }]);
});

it('replaces an earlier install, and its disposer removes the listener', () => {
  const second = install();
  press('KeyC', 'c');
  expect(send).toHaveBeenCalledTimes(1);
  second();
  press('KeyC', 'c');
  expect(send).toHaveBeenCalledTimes(1);
});

it('leaves Escape alone', () => {
  press('Escape', 'Escape');
  press('Escape', 'Escape');
  expect(send).not.toHaveBeenCalled();
  expect(addBots).not.toHaveBeenCalled();
  expect(hudCalls).toEqual([]);
});

it('toggles fullscreen with F', () => {
  press('KeyF', 'f');
  expect(toggleFullscreen).toHaveBeenCalledTimes(1);
});
