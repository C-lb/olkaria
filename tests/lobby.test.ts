// The lobby scene's Space, over stand-ins for the parts of Phaser it touches: one press starts the game once.
import { beforeEach, expect, it, vi } from 'vitest';
import { Lobby } from '../host/scenes/Lobby';
import { SEND_LOCK_MS, SPACE_LOCK_KEY } from '../host/strikers';
import type { HostCmd } from '../shared/types';

// Lobby.ts extends Phaser.Scene and reads two of its constants; nothing here draws.
vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Math: { Between: (lo: number) => lo },
  },
}));

/** Any call on it, and on what it returns, does nothing: the skyline's graphics and the avatars' images. */
const inert: unknown = new Proxy(() => {}, { get: () => inert, apply: () => inert });

let sent: HostCmd[] = [];
/** The scene's Space handler, as it registered it with its keyboard, its clock, and the registry the scenes share. */
let space: (event: KeyboardEvent) => void = () => {};
const clock = { now: 50_000, delayedCall: vi.fn() };
const values = new Map<string, unknown>();

beforeEach(() => {
  sent = [];
  clock.now = 50_000;
  values.clear();
  values.set('client', { mode: 'online', send: (cmd: HostCmd) => { sent.push(cmd); }, connect: () => new Promise(() => {}) });
  values.set('content', { roles: [] });
  values.set('hud', { showLobby: vi.fn(), showToast: vi.fn() });
  values.set('sound', { music: vi.fn(), tension: vi.fn(), sfx: vi.fn(), hit: vi.fn(), join: vi.fn(), toggle: vi.fn(() => true), enabled: true });
  values.set('view', null);
  const registry = { get: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, value), events: { on: vi.fn(), off: vi.fn() } };
  const keyboard = { on: (name: string, fn: (event: KeyboardEvent) => void) => { if (name === 'keydown-SPACE') space = fn; } };
  const scene = new Lobby();
  Object.assign(scene, { registry, input: { keyboard }, time: clock, events: { once: vi.fn() }, add: inert, tweens: inert });
  scene.create();
});

const press = (init: Partial<KeyboardEvent> = {}): KeyboardEvent => ({ repeat: false, ...init }) as KeyboardEvent;

it('two presses of Space 4 ms apart send one start', () => {
  space(press());
  clock.now += 4;
  space(press());
  expect(sent).toEqual([{ k: 'start' }]);
});

it('the same press handed over again sends nothing more, even once the rest is over', () => {
  // Phaser 3.90 hands a scene every key event of the frame again on each new key event (oncePerEvent in hotkeys.ts).
  const once = press();
  space(once);
  clock.now += SEND_LOCK_MS + 1;
  space(once);
  expect(sent).toEqual([{ k: 'start' }]);
});

it('rests Space for a second after a start, then takes a new press; a held key sends nothing', () => {
  space(press());
  expect(sent).toHaveLength(1);
  clock.now += SEND_LOCK_MS;
  space(press({ repeat: true }));
  expect(sent).toHaveLength(1);
  space(press());
  expect(sent).toEqual([{ k: 'start' }, { k: 'start' }]);   // a start the room refused can be pressed again
});

it('keeps to a rest another scene left in the registry', () => {
  // The Battle and the Ending set the rest too, and a reset can bring the lobby back while one still runs.
  values.set(SPACE_LOCK_KEY, clock.now + 500);
  space(press());
  expect(sent).toEqual([]);
  clock.now += 500;
  space(press());
  expect(sent).toEqual([{ k: 'start' }]);
});

it('names each role from the content\'s roles[].name, in the tiles and the newest names', () => {
  const showLobby = vi.fn();
  values.set('hud', { showLobby, showToast: vi.fn() });
  values.set('content', { roles: [{ id: 'citizen', name: 'Citizen' }, { id: 'government', name: 'Government' }, { id: 'business', name: 'Local Businessman' }, { id: 'microsoft', name: 'Satya Nadella' }] });
  values.set('view', { phase: 'lobby', hideNames: false, players: { p1: { id: 'p1', name: 'Ann', role: 'microsoft', table: 'Team 1', joinedAt: 1, votes: {} } } });
  const registry = { get: (key: string) => values.get(key), set: (key: string, value: unknown) => values.set(key, value), events: { on: vi.fn(), off: vi.fn() } };
  const scene = new Lobby();
  Object.assign(scene, { registry, input: { keyboard: { on: vi.fn() } }, time: clock, events: { once: vi.fn() }, add: inert, tweens: inert });
  scene.create();
  const args = showLobby.mock.calls.at(-1)![0];
  expect(args.roleNames).toEqual({ citizen: 'Citizen', government: 'Government', business: 'Local Businessman', microsoft: 'Satya Nadella' });
  expect(args.recent).toEqual(['Ann, Satya Nadella']);
  expect(args.roleCounts.microsoft).toBe(1);
  expect(args).not.toHaveProperty('classNames');
});
