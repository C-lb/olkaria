// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PlayerSocket } from '../player/net';
import { KICKED_CLOSE_CODE, KICKED_CLOSE_REASON, type PlayerView } from '../shared/types';

/** Stands in for the browser WebSocket. The tests play the room by calling open, say and drop. */
class FakeSocket {
  static OPEN = 1;
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  private listeners: Record<string, Array<(ev: unknown) => void>> = {};
  constructor(public url: string) { FakeSocket.all.push(this); }
  addEventListener(type: string, fn: (ev: unknown) => void): void { (this.listeners[type] ??= []).push(fn); }
  send(data: string): void { this.sent.push(data); }
  close(): void { this.readyState = 3; }
  open(): void { this.readyState = 1; this.emit('open', {}); }
  say(msg: unknown): void { this.emit('message', { data: typeof msg === 'string' ? msg : JSON.stringify(msg) }); }
  drop(code = 1006): void { this.readyState = 3; this.emit('close', { code }); }
  private emit(type: string, ev: unknown): void { for (const fn of this.listeners[type] ?? []) fn(ev); }
}

const view: PlayerView = { phase: 'lobby', round: -1, serverNow: 1000, voteDeadline: null, voteWindowMs: 30000, name: 'Ann', role: 'citizen', table: null, lead: 'citizen', isLead: true, myVote: null, lastPoints: 0, score: 0, rank: 1, playerCount: 1, tally: null, leadTally: null, supportTally: null, majorities: [], picks: [], callout: null };

function connect() {
  const socket = new PlayerSocket('ABCD', 'client 1');
  const statuses: string[] = [];
  const views: PlayerView[] = [];
  const errors: string[] = [];
  socket.onStatus((s) => statuses.push(s));
  socket.onView((v) => views.push(v));
  socket.onError((m) => errors.push(m));
  return { socket, statuses, views, errors, ws: () => FakeSocket.all[FakeSocket.all.length - 1] };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
  vi.stubGlobal('WebSocket', FakeSocket);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('player socket', () => {
  it('connects to the room as a player and hands over views, errors and the open status', () => {
    const { ws, statuses, views, errors } = connect();
    expect(FakeSocket.all).toHaveLength(1);
    expect(ws().url).toBe('ws://localhost:3000/ws/ABCD?role=player&clientId=client%201');
    ws().open();
    ws().say({ t: 'you', view });
    ws().say({ t: 'error', msg: 'already voted' });
    ws().say({ t: 'host', state: {} });
    ws().say('not json');
    ws().say('null');
    expect(statuses).toEqual(['open']);
    expect(views).toEqual([view]);
    expect(errors).toEqual(['already voted']);
  });

  it('uses a secure socket when the page is secure', () => {
    vi.stubGlobal('location', { protocol: 'https:', host: 'olkaria.example.workers.dev' });
    connect();
    expect(FakeSocket.all[0].url).toBe('wss://olkaria.example.workers.dev/ws/ABCD?role=player&clientId=client%201');
  });

  it('sends only while the connection is open', () => {
    const { socket, ws } = connect();
    socket.send({ t: 'vote', round: 0, option: 'B' });
    expect(ws().sent).toEqual([]);
    ws().open();
    socket.send({ t: 'vote', round: 0, option: 'B' });
    expect(ws().sent.map((s) => JSON.parse(s))).toEqual([{ t: 'vote', round: 0, option: 'B' }]);
  });

  it('reconnects after 1, 2 and 4 seconds, then every 10, and starts again after a good connection', () => {
    const { ws, statuses } = connect();
    const waits = [1000, 2000, 4000, 10000, 10000];
    waits.forEach((wait, i) => {
      ws().drop();
      expect(FakeSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(wait - 1);
      expect(FakeSocket.all).toHaveLength(i + 1);
      vi.advanceTimersByTime(1);
      expect(FakeSocket.all).toHaveLength(i + 2);
    });
    expect(statuses).toEqual(['closed', 'closed', 'closed', 'closed', 'closed']);
    ws().open();
    ws().drop();
    vi.advanceTimersByTime(999);
    expect(FakeSocket.all).toHaveLength(6);
    vi.advanceTimersByTime(1);
    expect(FakeSocket.all).toHaveLength(7);
  });

  it('stops for good on a kicked message, even when the close that follows is an ordinary drop', () => {
    const { socket, ws, statuses } = connect();
    const first = ws();
    first.open();
    first.say({ t: 'kicked' });
    first.drop(1006);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses).toEqual(['open', 'kicked']);
    socket.send({ t: 'join', clientId: 'client 1', name: 'Ann', role: 'citizen' });
    expect(first.sent).toEqual([]);
  });

  it('treats a close with the kicked code as a kick even without the message', () => {
    const { ws, statuses } = connect();
    ws().open();
    ws().drop(KICKED_CLOSE_CODE);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses).toEqual(['open', 'kicked']);
  });

  it('ignores late events from a connection it has already replaced', () => {
    const { ws, statuses, views } = connect();
    const old = ws();
    old.drop();
    vi.advanceTimersByTime(1000);
    const current = ws();
    expect(current).not.toBe(old);
    current.open();
    old.open();
    old.say({ t: 'you', view });
    old.say({ t: 'kicked' });
    old.drop(KICKED_CLOSE_CODE);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(2);
    expect(statuses).toEqual(['closed', 'open']);
    expect(views).toEqual([]);
  });

  it('calls the room unreachable after three attempts in a row never open, keeps retrying, and clears on an open', () => {
    const socket = new PlayerSocket('ABCD', 'client 1');
    const seen: boolean[] = [];
    socket.onStatus((s) => { if (s === 'closed') seen.push(socket.unreachable); });
    const last = () => FakeSocket.all[FakeSocket.all.length - 1];
    expect(socket.unreachable).toBe(false);
    for (const wait of [1000, 2000, 4000]) {
      last().drop();
      vi.advanceTimersByTime(wait);
    }
    expect(seen).toEqual([false, false, true]);
    expect(FakeSocket.all).toHaveLength(4);
    last().drop();
    vi.advanceTimersByTime(10_000);
    expect(seen).toEqual([false, false, true, true]);
    expect(FakeSocket.all).toHaveLength(5);

    last().open();
    expect(socket.unreachable).toBe(false);
    last().drop();
    vi.advanceTimersByTime(1000);
    last().drop();
    vi.advanceTimersByTime(2000);
    last().drop();
    expect(socket.unreachable).toBe(false);
    vi.advanceTimersByTime(4000);
    last().drop();
    expect(socket.unreachable).toBe(true);
  });

  it('treats a removed error as a kick, because the room refuses a banned client that way', () => {
    const { ws, statuses, errors } = connect();
    ws().open();
    ws().say({ t: 'error', msg: KICKED_CLOSE_REASON });
    ws().drop(1006);
    vi.advanceTimersByTime(120_000);
    expect(FakeSocket.all).toHaveLength(1);
    expect(statuses).toEqual(['open', 'kicked']);
    expect(errors).toEqual([]);
  });
});
