// The room's Durable Object over a stand-in for its storage. A room saved by an earlier build, without the trip count
// or with an infinite vote deadline, loads safe: its alarm locks the vote and arms the idle cleanup instead of throwing,
// and a start counts its first road as trip 1. A room the scoring build left on its leaderboard loads as the ending
// and loses its scoring fields. An alarm time that is not finite never reaches setAlarm. This file is
// type-checked with the worker's program (worker/tsconfig.json), which knows the Workers types, and left out of the
// page's (tsconfig.json).
import { expect, it, vi } from 'vitest';
import raw from '../content/case.json';
import { loadContent } from '../shared/content';
import { initialState, reduce } from '../shared/room-logic';
import type { Effect, RoomEvent, RoomState } from '../shared/types';
import { Room, type Env } from '../worker/room';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(readonly ctx: unknown, readonly env: unknown) {}
  },
}));

const content = loadContent(raw);
const KEY = 'host-secret';
/** worker/room.ts closes a room after six hours without a person's command, join or vote. */
const IDLE_MS = 6 * 60 * 60 * 1000;

/** The storage calls the room makes, over a Map. setAlarm refuses a time that is not finite, as the platform does. */
function roomOver(stored: Record<string, unknown>) {
  const data = new Map<string, unknown>(Object.entries(stored));
  const alarms: number[] = [];
  const storage = {
    get: async (keys: string[]) => new Map(keys.filter((k) => data.has(k)).map((k) => [k, data.get(k)] as const)),
    put: async (entries: Record<string, unknown>) => {
      for (const [k, v] of Object.entries(entries)) data.set(k, structuredClone(v));
    },
    setAlarm: async (at: number) => {
      if (!Number.isFinite(at)) throw new TypeError(`${at} is not a valid Date`);
      alarms.push(at);
    },
    deleteAlarm: vi.fn(async () => {}),
    deleteAll: async () => data.clear(),
  };
  const ctx = { storage, getWebSockets: () => [], acceptWebSocket: () => {} };
  return { room: new Room(ctx as unknown as DurableObjectState, {} as Env), data, alarms, storage };
}

/** A state as an earlier build stored it: the reducer's, with the given changes and without the trip count. */
function earlier(state: RoomState, changes: Partial<Record<keyof RoomState, unknown>> = {}): Record<string, unknown> {
  const { trips: _trips, ...old } = { ...state, ...changes };
  return old;
}

/** A room with one player and its first vote open, by the reducer, at `now`. */
function openVote(now: number): RoomState {
  const events: RoomEvent[] = [
    { type: 'join', clientId: 'p1', name: 'Ann', role: 'citizen', table: 'Team 1', now },
    { type: 'cmd', key: KEY, cmd: { k: 'start' }, now },
    { type: 'cmd', key: KEY, cmd: { k: 'openVote' }, now },
  ];
  return events.reduce((s, ev) => reduce(s, ev, content).state, initialState('ABCD', KEY, now, content));
}

it('a vote saved with an infinite deadline and no trips: its alarm locks the vote and arms the idle cleanup', async () => {
  const now = Date.now();
  const { room, data, alarms } = roomOver({ state: earlier(openVote(now), { voteDeadline: Infinity }), lastActivity: now });
  await room.alarm();
  expect(data.get('state')).toMatchObject({ phase: 'locked', voteDeadline: null, trips: 0 });
  expect(alarms).toEqual([now + IDLE_MS]);
});

it('a lobby saved without trips sets off on trip 1 when the host starts it', async () => {
  const now = Date.now();
  const { room, data } = roomOver({ state: earlier(initialState('ABCD', KEY, now, content)), lastActivity: now });
  const host = { deserializeAttachment: () => ({ role: 'host', clientId: '' }), send: vi.fn() };
  await room.webSocketMessage(host as unknown as WebSocket, JSON.stringify({ t: 'cmd', key: KEY, cmd: { k: 'start' } }));
  expect(host.send).not.toHaveBeenCalled();   // no refusal and no server error
  expect(data.get('state')).toMatchObject({ phase: 'travel', round: 0, trips: 1 });
});

it('an alarm time that is not finite deletes the alarm instead of reaching setAlarm', async () => {
  const now = Date.now();
  const { room, alarms, storage } = roomOver({ state: initialState('ABCD', KEY, now, content), lastActivity: now });
  const run = (effect: Effect): Promise<void> => (room as unknown as { run(effect: Effect): Promise<void> }).run(effect);
  await run({ type: 'setAlarm', at: Infinity });
  await run({ type: 'setAlarm', at: Number.NaN });
  expect(storage.deleteAlarm).toHaveBeenCalledTimes(2);
  await run({ type: 'setAlarm', at: now + 5000 });
  expect(alarms).toEqual([now + 5000]);
});

it('a room an earlier build left on its leaderboard loads as the ending, and the next change stores no scoring fields', async () => {
  const now = Date.now();
  const old = {
    ...earlier(openVote(now)), phase: 'leaderboard', round: 3, bossHp: 120, damageLog: [{ round: 0, total: 80 }], exhibits: { 0: ['t1a'] },
    players: { p1: { id: 'p1', name: 'Ann', role: 'citizen', table: null, joinedAt: now, score: 90, lastPoints: 10, votes: { 0: { option: 'D', at: now, points: 10 } } } },
  };
  const { room, data } = roomOver({ state: old, lastActivity: now });
  const host = { deserializeAttachment: () => ({ role: 'host', clientId: '' }), send: vi.fn() };
  await room.webSocketMessage(host as unknown as WebSocket, JSON.stringify({ t: 'cmd', key: KEY, cmd: { k: 'hideNames', hide: true } }));
  expect(host.send).not.toHaveBeenCalled();
  const stored = data.get('state') as Record<string, unknown>;
  expect(stored).toMatchObject({ phase: 'ending', round: 3, hideNames: true, players: { p1: { table: 'Team 1', votes: {} } } });
  for (const key of ['bossHp', 'damageLog', 'exhibits']) expect(stored).not.toHaveProperty(key);
  expect((stored.players as Record<string, object>).p1).not.toHaveProperty('score');
});
