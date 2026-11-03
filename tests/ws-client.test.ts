// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import raw from '../content/case.json';
import { OfflineRoomClient, WsRoomClient, botTally, createRoomClient } from '../host/net';
import { recallRoom, rememberRoom } from '../host/session';
import { loadContent } from '../shared/content';
import { hostView, initialState } from '../shared/room-logic';
import type { HostView, RoomState } from '../shared/types';

const content = loadContent(raw);
const BASE = 'http://localhost:3000';

/** Stands in for the browser WebSocket. The tests play the room by calling open, say and drop. */
class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  static refuse = false;
  readyState = 0;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};
  constructor(public url: string) {
    if (FakeSocket.refuse) throw new Error('blocked');
    FakeSocket.all.push(this);
  }
  addEventListener(type: string, fn: (ev: unknown) => void): void { (this.listeners[type] ??= []).push(fn); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  open(): void { this.readyState = 1; this.emit('open', {}); }
  say(msg: unknown): void { this.emit('message', { data: typeof msg === 'string' ? msg : JSON.stringify(msg) }); }
  drop(code = 1006): void { this.readyState = 3; this.emit('close', { code }); }
  private emit(type: string, ev: unknown): void { for (const fn of this.listeners[type] ?? []) fn(ev); }
}
const ws = (): FakeSocket => FakeSocket.all[FakeSocket.all.length - 1];

/** A view the room could have sent, built by the real reducer helpers. */
const viewOf = (patch: Partial<RoomState> = {}): HostView =>
  hostView({ ...initialState('ABCD', 'hidden', 0, content), ...patch }, 1000, content);
const lobby = viewOf();
const voting = viewOf({ phase: 'vote', round: 0 });

/** What POST /api/rooms answers. */
const created = { code: 'WXYZ', hostKey: 'fresh-key', joinUrl: `${BASE}/j/WXYZ` };

interface Call { url: string; init: RequestInit | undefined }
let calls: Call[] = [];

function reply(status: number, body?: unknown): Response {
  return { status, ok: status >= 200 && status < 300, json: async () => body } as unknown as Response;
}

/** Stands in for fetch: records every call and answers as `answer` says. Throwing from `answer` is a network failure. */
function stubFetch(answer: (url: string) => Response): void {
  calls = [];
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return answer(url);
  });
}
const isProbe = (url: string): boolean => url.includes('/ws/');

/** Lets the promises that are ready run, without moving the clock. */
const settle = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
};

/** A connected client: the room is created, the socket is open and the first view has arrived. */
async function online(first: HostView = lobby, withContent = true) {
  stubFetch(() => reply(201, created));
  const client = new WsRoomClient(BASE, withContent ? content : undefined);
  const states: HostView[] = [];
  const errors: string[] = [];
  client.onState((v) => states.push(v));
  client.onError((m) => errors.push(m));
  const connecting = client.connect();
  await settle();
  ws().open();
  ws().say({ t: 'host', state: first });
  await connecting;
  return { client, states, errors };
}

const sentCommands = (): unknown[] => ws().sent.map((s) => JSON.parse(s));

beforeEach(() => {
  FakeSocket.all = [];
  FakeSocket.refuse = false;
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sessionStorage.clear();
});

describe('WsRoomClient.connect', () => {
  it('creates and remembers a room when none is remembered, and resolves once the room sends its first view', async () => {
    stubFetch(() => reply(201, created));
    const client = new WsRoomClient(BASE);
    const states: HostView[] = [];
    client.onState((v) => states.push(v));
    let result: unknown;
    const connecting = client.connect().then((r) => { result = r; });
    await settle();
    expect(calls.map((c) => [c.url, c.init?.method])).toEqual([[`${BASE}/api/rooms`, 'POST']]);
    expect(recallRoom()).toEqual({ code: 'WXYZ', hostKey: 'fresh-key' });
    expect(FakeSocket.all).toHaveLength(1);
    expect(ws().url).toBe('ws://localhost:3000/ws/WXYZ?role=host&key=fresh-key');
    ws().open();
    await settle();
    expect(result).toBeUndefined();   // the socket is open but the room has not spoken yet
    ws().say({ t: 'host', state: lobby });
    await connecting;
    expect(result).toEqual({ code: 'WXYZ', joinUrl: created.joinUrl });
    expect(states).toEqual([lobby]);
  });

  it('uses a secure socket for a secure page and builds the join link itself when the server sends none', async () => {
    stubFetch(() => reply(201, { code: 'WXYZ', hostKey: 'fresh-key' }));
    const client = new WsRoomClient('https://olkaria.example.workers.dev/');
    const connecting = client.connect();
    await settle();
    expect(calls[0].url).toBe('https://olkaria.example.workers.dev/api/rooms');
    expect(ws().url).toBe('wss://olkaria.example.workers.dev/ws/WXYZ?role=host&key=fresh-key');
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'WXYZ', joinUrl: 'https://olkaria.example.workers.dev/j/WXYZ' });
  });

  it('keeps a remembered room the server accepts (426) and creates nothing', async () => {
    rememberRoom('ABCD', 'old-key');
    stubFetch(() => reply(426));
    const client = new WsRoomClient(BASE);
    const connecting = client.connect();
    await settle();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`${BASE}/ws/ABCD?role=host&key=old-key`);
    expect(calls[0].init?.method ?? 'GET').toBe('GET');
    expect(calls[0].init?.cache).toBe('no-store');
    expect(ws().url).toBe('ws://localhost:3000/ws/ABCD?role=host&key=old-key');
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'ABCD', joinUrl: `${BASE}/j/ABCD` });
    expect(recallRoom()).toEqual({ code: 'ABCD', hostKey: 'old-key' });
  });

  it.each([404, 403])('forgets a remembered room the server answers %i for, and creates a new one', async (status) => {
    rememberRoom('ABCD', 'old-key');
    stubFetch((url) => (isProbe(url) ? reply(status) : reply(201, created)));
    const client = new WsRoomClient(BASE);
    const connecting = client.connect();
    await settle();
    expect(calls.map((c) => [c.url, c.init?.method ?? 'GET'])).toEqual([
      [`${BASE}/ws/ABCD?role=host&key=old-key`, 'GET'],
      [`${BASE}/api/rooms`, 'POST'],
    ]);
    expect(recallRoom()).toEqual({ code: 'WXYZ', hostKey: 'fresh-key' });
    expect(FakeSocket.all).toHaveLength(1);
    expect(ws().url).toBe('ws://localhost:3000/ws/WXYZ?role=host&key=fresh-key');
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'WXYZ', joinUrl: created.joinUrl });
  });

  it.each([
    ['an error status', () => reply(500)],
    ['a bad request', () => reply(400)],
    ['no answer at all', () => { throw new TypeError('Failed to fetch'); }],
  ])('keeps a remembered room when the probe gets %s, because that proves nothing', async (_what, answer) => {
    rememberRoom('ABCD', 'old-key');
    stubFetch(answer);
    const client = new WsRoomClient(BASE);
    const connecting = client.connect();
    await settle();
    expect(calls).toHaveLength(1);
    expect(recallRoom()).toEqual({ code: 'ABCD', hostKey: 'old-key' });
    expect(ws().url).toBe('ws://localhost:3000/ws/ABCD?role=host&key=old-key');
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'ABCD', joinUrl: `${BASE}/j/ABCD` });
  });

  it('encodes the code and the key it puts in the addresses', async () => {
    rememberRoom('AB CD', 'k&y=1');
    stubFetch(() => reply(426));
    const connecting = new WsRoomClient(BASE).connect();
    await settle();
    expect(calls[0].url).toBe(`${BASE}/ws/AB%20CD?role=host&key=k%26y%3D1`);
    expect(ws().url).toBe('ws://localhost:3000/ws/AB%20CD?role=host&key=k%26y%3D1');
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'AB CD', joinUrl: `${BASE}/j/AB%20CD` });
  });

  it('does not keep a dead room when its replacement cannot be created', async () => {
    rememberRoom('ABCD', 'old-key');
    stubFetch((url) => (isProbe(url) ? reply(404) : reply(503)));
    await expect(new WsRoomClient(BASE).connect()).rejects.toThrow('HTTP 503');
    expect(recallRoom()).toBeNull();
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('rejects when the room cannot be created, remembers nothing, and tries again on the next connect()', async () => {
    let up = false;
    stubFetch(() => (up ? reply(201, created) : reply(500)));
    const client = new WsRoomClient(BASE);
    await expect(client.connect()).rejects.toThrow('HTTP 500');
    expect(recallRoom()).toBeNull();
    expect(FakeSocket.all).toHaveLength(0);
    up = true;
    const again = client.connect();
    await settle();
    expect(calls).toHaveLength(2);
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(again).resolves.toEqual({ code: 'WXYZ', joinUrl: created.joinUrl });
  });

  it('rejects when the server cannot be reached or sends back no room', async () => {
    stubFetch(() => { throw new TypeError('Failed to fetch'); });
    await expect(new WsRoomClient(BASE).connect()).rejects.toThrow('could not reach the server');
    for (const body of [{ nope: true }, undefined, null, 'WXYZ', { code: '', hostKey: 'k' }, { code: 'WXYZ', hostKey: '' }, { code: 7, hostKey: 'k' }, { code: 'WXYZ' }]) {
      stubFetch(() => reply(201, body));
      await expect(new WsRoomClient(BASE).connect(), JSON.stringify(body)).rejects.toThrow('no room');
    }
    expect(recallRoom()).toBeNull();
  });

  it('opens one socket and makes one room however often connect() is called', async () => {
    stubFetch(() => reply(201, created));
    const client = new WsRoomClient(BASE);
    const first = client.connect();
    const second = client.connect();
    await settle();
    ws().open();
    ws().say({ t: 'host', state: lobby });
    const results = await Promise.all([first, second]);
    expect(results[0]).toEqual(results[1]);
    expect(calls).toHaveLength(1);
    expect(FakeSocket.all).toHaveLength(1);
    await expect(client.connect()).resolves.toEqual(results[0]);
    expect(FakeSocket.all).toHaveLength(1);
  });

  it('retries when the browser will not create the socket', async () => {
    stubFetch(() => reply(201, created));
    FakeSocket.refuse = true;
    const connecting = new WsRoomClient(BASE).connect();
    await settle();
    expect(FakeSocket.all).toHaveLength(0);
    FakeSocket.refuse = false;
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(1);
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await expect(connecting).resolves.toEqual({ code: 'WXYZ', joinUrl: created.joinUrl });
  });

  it('reports itself as an online client', () => {
    expect(new WsRoomClient(BASE).mode).toBe('online');
  });
});

describe('WsRoomClient messages', () => {
  it('passes host views and errors on and ignores everything else', async () => {
    const { states, errors } = await online();
    ws().say({ t: 'host', state: voting });
    ws().say({ t: 'error', msg: 'bad phase' });
    ws().say({ t: 'you', view: {} });
    ws().say({ t: 'kicked' });
    ws().say({ t: 'host' });
    ws().say({ t: 'host', state: 'nope' });
    ws().say({ t: 'error' });
    ws().say('not json');
    ws().say('null');
    ws().say('7');
    expect(states).toEqual([lobby, voting]);
    expect(errors).toEqual(['bad phase']);
  });

  it('serves every listener, and a listener that unsubscribes is not called again', async () => {
    const { client } = await online();
    const a: string[] = [];
    const b: string[] = [];
    const offA = client.onState((v) => a.push(v.phase));
    client.onState((v) => b.push(v.phase));
    const errs: string[] = [];
    const offErr = client.onError((m) => errs.push(m));
    ws().say({ t: 'host', state: voting });
    ws().say({ t: 'error', msg: 'one' });
    offA();
    offErr();
    ws().say({ t: 'host', state: lobby });
    ws().say({ t: 'error', msg: 'two' });
    expect(a).toEqual(['vote']);
    expect(b).toEqual(['vote', 'lobby']);
    expect(errs).toEqual(['one']);
  });

  it('keeps serving the other listeners when one of them throws, and still resolves connect()', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubFetch(() => reply(201, created));
    const client = new WsRoomClient(BASE);
    const seen: string[] = [];
    client.onState(() => { throw new Error('a scene broke'); });
    client.onState((v) => seen.push(v.phase));
    const connecting = client.connect();
    await settle();
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await connecting;
    expect(seen).toEqual(['lobby']);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe('WsRoomClient.send', () => {
  it('wraps a command with the host key', async () => {
    const { client } = await online();
    client.send({ k: 'start' });
    client.send({ k: 'openVote', seconds: 20 });
    expect(sentCommands()).toEqual([
      { t: 'cmd', key: 'fresh-key', cmd: { k: 'start' } },
      { t: 'cmd', key: 'fresh-key', cmd: { k: 'openVote', seconds: 20 } },
    ]);
  });

  it('uses the key of a remembered room', async () => {
    rememberRoom('ABCD', 'old-key');
    stubFetch(() => reply(426));
    const client = new WsRoomClient(BASE);
    const connecting = client.connect();
    await settle();
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await connecting;
    client.send({ k: 'start' });
    expect(sentCommands()).toEqual([{ t: 'cmd', key: 'old-key', cmd: { k: 'start' } }]);
  });

  it('reports not connected and drops the command while there is no open socket', async () => {
    stubFetch(() => reply(201, created));
    const client = new WsRoomClient(BASE);
    const errors: string[] = [];
    client.onError((m) => errors.push(m));
    client.send({ k: 'start' });   // before connect()
    expect(errors).toEqual(['not connected']);
    const connecting = client.connect();
    await settle();
    client.send({ k: 'start' });   // the socket exists but has not opened
    expect(errors).toEqual(['not connected', 'not connected']);
    expect(ws().sent).toEqual([]);
    ws().open();
    ws().say({ t: 'host', state: lobby });
    await connecting;

    const first = ws();
    first.drop();
    client.send({ k: 'start' });   // lost, waiting to reconnect
    expect(errors).toHaveLength(3);
    expect(first.sent).toEqual([]);
    vi.advanceTimersByTime(1000);
    client.send({ k: 'start' });   // reconnecting, not open yet
    expect(errors).toHaveLength(4);
    expect(ws().sent).toEqual([]);
    ws().open();
    expect(errors).toHaveLength(4);
    expect(ws().sent).toEqual([]);   // nothing was queued for later
    client.send({ k: 'next' });
    expect(sentCommands()).toEqual([{ t: 'cmd', key: 'fresh-key', cmd: { k: 'next' } }]);
  });
});

describe('WsRoomClient reconnect', () => {
  it('reconnects after 1, 2 and 4 seconds, then every 10, and starts again after a good connection', async () => {
    await online();
    const waits = [1000, 2000, 4000, 10000, 10000];
    waits.forEach((wait, i) => {
      ws().drop();
      expect(FakeSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(wait - 1);
      expect(FakeSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.all).toHaveLength(i + 2);
    });
    ws().open();
    ws().drop();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(6);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(7);
  });

  it('comes back to the same room with the same key, and hands on the views of the new connection', async () => {
    const { states } = await online();
    ws().drop();
    vi.advanceTimersByTime(1000);
    expect(ws().url).toBe('ws://localhost:3000/ws/WXYZ?role=host&key=fresh-key');
    ws().open();
    ws().say({ t: 'host', state: voting });
    expect(states).toEqual([lobby, voting]);
  });

  it('ignores late events from a socket it has replaced, and never has two sockets at once', async () => {
    const { client, states, errors } = await online();
    const old = ws();
    old.drop();
    vi.advanceTimersByTime(1000);
    const current = ws();
    expect(current).not.toBe(old);
    current.open();
    old.open();
    old.say({ t: 'host', state: voting });
    old.say({ t: 'error', msg: 'stale' });
    old.drop();
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(states).toEqual([lobby]);
    expect(errors).toEqual([]);
    client.send({ k: 'start' });
    expect(old.sent).toEqual([]);
    expect(current.sent).toHaveLength(1);
  });

  it('does not let a replaced socket that opens late reset the wait', async () => {
    await online();
    const first = ws();
    first.drop();                       // wait 1 s
    vi.advanceTimersByTime(1000);
    ws().drop();                        // wait 2 s
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.all).toHaveLength(3);
    first.open();                       // a stale open: it must not count as a good connection
    ws().drop();                        // so the wait is 4 s
    vi.advanceTimersByTime(3999);
    expect(FakeSocket.all).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(4);
  });

  it('plans one retry per loss, even if a socket reports its close twice', async () => {
    await online();
    const first = ws();
    first.drop();
    first.drop();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(2);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(2);
  });
});

describe('WsRoomClient.addBots', () => {
  it('sends injectVotes for the round and earlier majorities of the last view', async () => {
    const { client } = await online(voting);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    client.addBots(20);
    const first = botTally(content, 0, [], 20, () => 0.1);
    expect(first).toEqual({ A: 20, B: 0, C: 0, D: 0 });
    expect(sentCommands()).toEqual([{ t: 'cmd', key: 'fresh-key', cmd: { k: 'injectVotes', counts: first } }]);

    // The next view moves the room to round 4 with three earlier majorities, and the bots follow.
    ws().say({ t: 'host', state: viewOf({ phase: 'vote', round: 3, majorities: ['B', 'C', 'B'] }) });
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    client.addBots(20);
    const later = botTally(content, 3, ['B', 'C', 'B'], 20, () => 0.7);
    expect(later).toEqual({ A: 0, B: 0, C: 0, D: 20 });
    expect(later).not.toEqual(botTally(content, 3, [], 20, () => 0.7));
    expect(sentCommands().at(-1)).toEqual({ t: 'cmd', key: 'fresh-key', cmd: { k: 'injectVotes', counts: later } });
  });

  it('reports an error and sends nothing before the room has sent a view', () => {
    const client = new WsRoomClient(BASE, content);
    const errors: string[] = [];
    client.onError((m) => errors.push(m));
    client.addBots(10);
    expect(errors).toEqual(['no room view yet']);
    expect(FakeSocket.all).toHaveLength(0);
  });

  it('reports an error and sends nothing while the room is still in the lobby', async () => {
    const { client, errors } = await online(lobby);
    client.addBots(10);
    expect(errors).toEqual(['no room view yet']);
    expect(ws().sent).toEqual([]);
  });

  it('reports an error and sends nothing when it was built without content', async () => {
    const { client, errors } = await online(voting, false);
    client.addBots(10);
    expect(errors).toEqual(['no room view yet']);
    expect(ws().sent).toEqual([]);
  });

  it('reports not connected when the socket is down', async () => {
    const { client, errors } = await online(voting);
    ws().drop();
    client.addBots(10);
    expect(errors).toEqual(['not connected']);
  });
});

describe('createRoomClient', () => {
  const at = (search: string) => ({ search, origin: BASE });

  it('runs offline for ?mode=offline, whatever else is asked', () => {
    for (const search of ['?mode=offline', '?x=1&mode=offline', '?mode=offline&new=1']) {
      const client = createRoomClient(at(search), content);
      expect(client).toBeInstanceOf(OfflineRoomClient);
      expect(client.mode).toBe('offline');
    }
  });

  it('is online otherwise, on the page origin', async () => {
    for (const search of ['', '?', '?mode=online', '?mode=offlines']) {
      const client = createRoomClient(at(search), content);
      expect(client).toBeInstanceOf(WsRoomClient);
      expect(client.mode).toBe('online');
    }
    stubFetch(() => reply(201, created));
    const client = createRoomClient(at(''), content);
    void client.connect();
    await settle();
    expect(calls[0].url).toBe(`${BASE}/api/rooms`);
  });

  it('gives the online client the content, so addBots can build votes', async () => {
    stubFetch(() => reply(201, created));
    const client = createRoomClient(at(''), content);
    void client.connect();
    await settle();
    ws().open();
    ws().say({ t: 'host', state: voting });
    client.addBots(5);
    expect(sentCommands()).toHaveLength(1);
  });

  it('keeps the remembered room unless the page is opened with new=1', () => {
    for (const search of ['', '?mode=online', '?new=0', '?new=', '?renew=1', '?new=10', '?mode=offline&new=1']) {
      rememberRoom('ABCD', 'old-key');
      createRoomClient(at(search), content);
      expect(recallRoom(), search).toEqual({ code: 'ABCD', hostKey: 'old-key' });
    }
  });

  it('forgets the remembered room for new=1, wherever it sits in the query', () => {
    for (const search of ['?new=1', '?mode=online&new=1', '?new=1&x=2']) {
      rememberRoom('ABCD', 'old-key');
      const client = createRoomClient(at(search), content);
      expect(recallRoom(), search).toBeNull();
      expect(client.mode).toBe('online');
    }
  });
});
