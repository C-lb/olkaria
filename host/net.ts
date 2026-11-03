// The projector page's connection to its room, behind one interface so the scenes never ask which kind they have.
// WsRoomClient talks to the live room on Cloudflare. OfflineRoomClient runs the same reducer in the browser, for a
// rehearsal or for a lost connection, with synthetic voters instead of phones.
import type { CaseContent } from '../shared/content';
import { hostView, initialState, reduce } from '../shared/room-logic';
import { effectiveScores } from '../shared/scoring';
import {
  OPTION_IDS,
  type ClientMsg, type HostCmd, type HostView, type OptionId, type RoomEvent, type RoomState, type ServerMsg, type Tally,
} from '../shared/types';
import { forgetRoom, recallRoom, rememberRoom } from './session';

/** What the host page shows about the room: its code, and the address phones join at (empty offline). */
export interface RoomInfo { code: string; joinUrl: string }

/** Whether the connection to the room is up, and 'gone' once the server has said the room no longer exists. */
export type ConnectionStatus = 'open' | 'closed' | 'gone';

export interface RoomClient {
  readonly mode: 'online' | 'offline';
  /** Online: finds or creates the room and resolves once its first view has arrived. Offline: resolves at once. */
  connect(): Promise<RoomInfo>;
  /** A host command. One that cannot be delivered is dropped and reported through onError. */
  send(cmd: HostCmd): void;
  /**
   * The first view of the room on connect, then later ones. Online, the room sends a view after every event it handles,
   * a refusal or an early alarm tick included; offline, a view comes only when the state changed. Views are read-only:
   * every listener is handed the same object. Returns the function that unsubscribes.
   */
  onState(cb: (view: HostView) => void): () => void;
  /** Refusals such as "bad phase", and "not connected". Returns the function that unsubscribes. */
  onError(cb: (msg: string) => void): () => void;
  /**
   * 'open' when the connection to the room comes up, 'closed' when one that was open drops, and (online only) 'gone'
   * when the room has closed under the page: the server no longer has it, so the client stops trying and only a reload
   * (which makes a new room) helps. A new subscriber is told the current status at once; before the first connection
   * there is none. Returns the function that unsubscribes.
   */
  onStatus(cb: (status: ConnectionStatus) => void): () => void;
  /** Adds n synthetic voters to the current round, leaning toward the options the evidence favours. */
  addBots(n: number): void;
}

/**
 * The callbacks of one kind of event. A callback that throws is logged and does not stop the ones after it. With
 * `replay`, the last value is kept and a new subscriber is told it at once.
 */
class Listeners<T> {
  private readonly subs = new Set<{ cb: (value: T) => void }>();
  private latest: { value: T } | null = null;

  constructor(private readonly replay = false) {}

  /** Returns the function that removes this subscription, and only this one. */
  on(cb: (value: T) => void): () => void {
    const sub = { cb };
    this.subs.add(sub);
    if (this.latest !== null) this.call(sub, this.latest.value);
    return () => { this.subs.delete(sub); };
  }

  emit(value: T): void {
    if (this.replay) this.latest = { value };
    for (const sub of [...this.subs]) {
      if (this.subs.has(sub)) this.call(sub, value);   // not one that an earlier callback of this same emit removed
    }
  }

  private call(sub: { cb: (value: T) => void }, value: T): void {
    try {
      sub.cb(value);
    } catch (err) {
      console.error('room client listener threw', err);
    }
  }
}

// ---- Bots ------------------------------------------------------------------------------------------

/** Added to every option's score before the bots draw, so a weak option still gets the odd vote, as in a real class. */
const BOT_FLOOR = 10;

/** Reported when there is nothing to add bots to: the lobby, or no view or content yet to build their votes from. */
const NO_ROUND = 'Start the game before adding bots';

/**
 * n bot votes spread over the options: each of n independent draws lands on an option with probability
 * proportional to its effective score plus BOT_FLOOR, so the evidence-strongest option collects the most.
 * `rng` returns numbers in [0, 1). An n that is not a positive number gives no votes; a fraction is rounded down.
 */
export function botTally(
  content: CaseContent, roundIndex: number, prior: readonly (OptionId | null)[], n: number, rng: () => number,
): Tally {
  const score = effectiveScores(content, roundIndex, prior);
  const edges: number[] = [];
  let sum = 0;
  for (const o of OPTION_IDS) {
    sum += score[o] + BOT_FLOOR;
    edges.push(sum);
  }
  const tally: Tally = { A: 0, B: 0, C: 0, D: 0 };
  const draws = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  for (let i = 0; i < draws; i++) {
    const x = rng() * sum;
    const at = edges.findIndex((edge) => x < edge);
    // A draw that rounding leaves past the last edge belongs to the last option.
    tally[OPTION_IDS[at === -1 ? OPTION_IDS.length - 1 : at]] += 1;
  }
  return tally;
}

/** Bot votes for the round a view shows, or null while there is nothing to vote in. */
function botVotes(content: CaseContent | undefined, view: Pick<HostView, 'round' | 'majorities'> | null, n: number): Tally | null {
  if (content === undefined || view === null || view.round < 0) return null;
  return botTally(content, view.round, view.majorities, n, Math.random);
}

// ---- Offline ---------------------------------------------------------------------------------------

/** How often the offline client advances its own clock, standing in for the room's alarm. */
const TICK_MS = 250;

export class OfflineRoomClient implements RoomClient {
  readonly mode = 'offline';
  private state: RoomState;
  private timer: ReturnType<typeof setInterval> | undefined;
  private readonly views = new Listeners<HostView>();
  private readonly errors = new Listeners<string>();
  private readonly statuses = new Listeners<ConnectionStatus>(true);
  /** Views made but not yet delivered, oldest first, and whether a delivery is going round right now. */
  private readonly pending: HostView[] = [];
  private delivering = false;

  constructor(private readonly content: CaseContent, private readonly now: () => number = () => Date.now()) {
    this.state = initialState('OFFLINE', 'offline', now(), content);
  }

  /** Starts the clock, reports the status open and the first view. Calling it again changes nothing. */
  connect(): Promise<RoomInfo> {
    if (this.timer === undefined) {
      this.timer = setInterval(() => this.tick(), TICK_MS);
      this.statuses.emit('open');
      this.emit();
    }
    return Promise.resolve({ code: 'OFFLINE', joinUrl: '' });
  }

  send(cmd: HostCmd): void {
    // The Worker draws the call-out lottery for a command that has no pick, and so does this client.
    const withPick: HostCmd = cmd.k === 'callout' && cmd.pick === undefined ? { ...cmd, pick: Math.random() } : cmd;
    this.apply({ type: 'cmd', key: 'offline', cmd: withPick, now: this.now() });
  }

  /** Lets the clock reach the vote deadline. The timer calls it; a test can too. */
  tick(): void {
    this.apply({ type: 'tick', now: this.now() });
  }

  onState(cb: (view: HostView) => void): () => void { return this.views.on(cb); }
  onError(cb: (msg: string) => void): () => void { return this.errors.on(cb); }
  onStatus(cb: (status: ConnectionStatus) => void): () => void { return this.statuses.on(cb); }

  addBots(n: number): void {
    const counts = botVotes(this.content, this.state, n);
    if (counts === null) this.errors.emit(NO_ROUND);
    else this.send({ k: 'injectVotes', counts });
  }

  /**
   * Reduces one event and reports a view only if the state changed, so the 250 ms ticks stay silent until one of them
   * locks the vote. A refusal changes nothing and still reaches onError.
   */
  private apply(ev: RoomEvent): void {
    const before = JSON.stringify(this.state);
    const { state, effects } = reduce(this.state, ev, this.content);
    this.state = state;
    for (const effect of effects) {
      switch (effect.type) {
        case 'error':
          this.errors.emit(effect.msg);
          break;
        case 'setAlarm':
        case 'clearAlarm':
        case 'kicked':
          break;   // the client ticks itself, and offline there are no phones to remove
        default:
          effect satisfies never;
      }
    }
    if (JSON.stringify(state) !== before) this.emit();
  }

  /**
   * Views go out one at a time, in the order they were made. A listener that sends a command while it is being told a
   * view makes a newer one; that one waits its turn, so no listener is handed an older view after a newer one.
   */
  private emit(): void {
    // hostView shares its nested objects with the live state, so each view is a copy. A listener that edits it cannot
    // change the room, but the listeners share the copy, which is why views are read-only (see RoomClient.onState).
    this.pending.push(structuredClone(hostView(this.state, this.now(), this.content)));
    if (this.delivering) return;
    this.delivering = true;
    try {
      for (let view = this.pending.shift(); view !== undefined; view = this.pending.shift()) this.views.emit(view);
    } finally {
      this.delivering = false;
    }
  }
}

// ---- Online ----------------------------------------------------------------------------------------

/** Wait before the next attempt: 1 s, 2 s, 4 s, then 10 s for as long as the room stays out of reach. */
const BACKOFF_MS = [1000, 2000, 4000, 10000];

/** How long a request to the room server may take before it counts as unanswered. */
const REQUEST_TIMEOUT_MS = 8000;

/**
 * After this many sockets in a row that closed without opening, the client asks the server whether the room still
 * exists, and again after every miss from then on. A wiped room turns every socket away; so can a dropped Wi-Fi.
 */
const MISSES_BEFORE_ASKING = 3;

/**
 * A signal that aborts after REQUEST_TIMEOUT_MS, and the call that stops its timer once the request is over. An abort
 * makes fetch fail like any other network error. (AbortSignal.timeout would do the same, but fake timers do not drive it
 * and older browsers lack it.)
 */
function deadline(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timer) };
}

interface Room { code: string; hostKey: string; joinUrl: string }

export class WsRoomClient implements RoomClient {
  readonly mode = 'online';
  private readonly base: string;
  private room: Room | null = null;
  private ws: WebSocket | null = null;
  private failures = 0;
  /** Sockets in a row that closed without ever opening. */
  private misses = 0;
  /** The next attempt, once one is planned, so a room found gone can call it off. */
  private retry: ReturnType<typeof setTimeout> | undefined;
  /** True while the question to the server about the room is out (askIfGone). */
  private asking = false;
  private view: HostView | null = null;
  private starting: Promise<RoomInfo> | null = null;
  private firstView: (() => void) | null = null;
  private readonly states = new Listeners<HostView>();
  private readonly errors = new Listeners<string>();
  private readonly statuses = new Listeners<ConnectionStatus>(true);

  /** `baseUrl` is the page origin. `content` is only needed by addBots. */
  constructor(baseUrl: string, private readonly content?: CaseContent) {
    this.base = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Resumes the room this tab remembers if the server still has it, else creates one, then opens the socket and
   * resolves once the room's first view has arrived. Rejects if no room can be created; the next call tries again.
   */
  connect(): Promise<RoomInfo> {
    this.starting ??= this.start().catch((err: unknown) => {
      this.starting = null;
      throw err;
    });
    return this.starting;
  }

  /** Sent only while the socket is open. Otherwise the command is dropped: the host presses the key again. */
  send(cmd: HostCmd): void {
    const { ws, room } = this;
    if (ws === null || room === null || ws.readyState !== WebSocket.OPEN) {
      this.errors.emit('not connected');
      return;
    }
    const msg: ClientMsg = { t: 'cmd', key: room.hostKey, cmd };
    ws.send(JSON.stringify(msg));
  }

  onState(cb: (view: HostView) => void): () => void { return this.states.on(cb); }
  onError(cb: (msg: string) => void): () => void { return this.errors.on(cb); }
  onStatus(cb: (status: ConnectionStatus) => void): () => void { return this.statuses.on(cb); }

  addBots(n: number): void {
    const counts = botVotes(this.content, this.view, n);
    if (counts === null) this.errors.emit(NO_ROUND);
    else this.send({ k: 'injectVotes', counts });
  }

  private async start(): Promise<RoomInfo> {
    const room = await this.claimRoom();
    this.room = room;
    await new Promise<void>((resolve) => {
      this.firstView = resolve;
      this.open();
    });
    return { code: room.code, joinUrl: room.joinUrl };
  }

  private async claimRoom(): Promise<Room> {
    const saved = recallRoom();
    if (saved !== null) {
      if (!(await this.isGone(saved))) return { ...saved, joinUrl: `${this.base}/j/${encodeURIComponent(saved.code)}` };
      forgetRoom();
    }
    return this.createRoom();
  }

  /**
   * Asks the server whether a remembered room is still there, with a plain GET of the host socket address: 404 is a
   * room the server has wiped, 403 a key it does not know, and 426 (upgrade required) a live room that took the key.
   * Any other answer, or none within REQUEST_TIMEOUT_MS, proves nothing, so the room stays remembered and the socket
   * gets to try.
   */
  private async isGone(saved: { code: string; hostKey: string }): Promise<boolean> {
    const { signal, clear } = deadline();
    try {
      const res = await fetch(this.base + this.hostPath(saved), { cache: 'no-store', signal });
      return res.status === 404 || res.status === 403;
    } catch {
      return false;
    } finally {
      clear();
    }
  }

  /** Asks the server for a room. Rejects if it cannot be reached within REQUEST_TIMEOUT_MS or sends back no room. */
  private async createRoom(): Promise<Room> {
    const { signal, clear } = deadline();
    try {
      let res: Response;
      try {
        res = await fetch(`${this.base}/api/rooms`, { method: 'POST', signal });
      } catch {
        throw new Error('Could not reach the room server');
      }
      if (!res.ok) throw new Error(`The server could not create a room (HTTP ${res.status})`);
      const body: unknown = await res.json().catch(() => null);
      const { code, hostKey, joinUrl } = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      if (typeof code !== 'string' || code === '' || typeof hostKey !== 'string' || hostKey === '') {
        throw new Error('The server sent back no room');
      }
      rememberRoom(code, hostKey);
      return { code, hostKey, joinUrl: typeof joinUrl === 'string' ? joinUrl : `${this.base}/j/${encodeURIComponent(code)}` };
    } finally {
      clear();
    }
  }

  private hostPath(room: { code: string; hostKey: string }): string {
    return `/ws/${encodeURIComponent(room.code)}?role=host&key=${encodeURIComponent(room.hostKey)}`;
  }

  private open(): void {
    const { room } = this;
    if (room === null || this.ws !== null) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.base.replace(/^http/, 'ws') + this.hostPath(room));
    } catch {
      this.lost();
      return;
    }
    this.ws = ws;
    let opened = false;
    // Events from a socket that has been replaced or dropped belong to nobody.
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      opened = true;
      this.failures = 0;
      this.misses = 0;
      this.statuses.emit('open');
    });
    ws.addEventListener('message', (ev) => {
      if (this.ws === ws) this.handle(ev.data);
    });
    ws.addEventListener('close', () => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.lost();
      // Only a socket that had opened can close; an attempt that never got through is not news, unless it keeps happening.
      if (opened) this.statuses.emit('closed');
      else if (++this.misses >= MISSES_BEFORE_ASKING) void this.askIfGone();
    });
  }

  private lost(): void {
    const wait = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    this.failures += 1;
    this.retry = setTimeout(() => {
      this.retry = undefined;
      this.open();
    }, wait);
  }

  /**
   * Asks the server about the room (isGone) while the retries carry on, one question at a time. A room the server has
   * wiped, or a key it no longer takes, is forgotten: the planned attempt and any socket still opening are dropped, the
   * client stops trying and reports 'gone'. Any other answer, or none, proves nothing and changes nothing.
   */
  private async askIfGone(): Promise<void> {
    const { room } = this;
    if (room === null || this.asking) return;
    this.asking = true;
    const gone = await this.isGone(room);
    this.asking = false;
    if (!gone || this.room !== room) return;
    forgetRoom();
    this.room = null;
    clearTimeout(this.retry);
    this.retry = undefined;
    const opening = this.ws;
    this.ws = null;   // first, so nothing the socket reports from here on is heard
    opening?.close();
    this.statuses.emit('gone');
  }

  private handle(data: unknown): void {
    if (typeof data !== 'string') return;
    let msg: ServerMsg | null;
    try {
      msg = JSON.parse(data) as ServerMsg | null;
    } catch {
      return;
    }
    if (msg === null || typeof msg !== 'object') return;
    switch (msg.t) {
      case 'host': {
        if (typeof msg.state !== 'object' || msg.state === null) return;
        this.view = msg.state;
        this.firstView?.();
        this.firstView = null;
        this.states.emit(msg.state);
        break;
      }
      case 'error':
        if (typeof msg.msg === 'string') this.errors.emit(msg.msg);
        break;
      default:
        break;   // 'you' and 'kicked' are for phones
    }
  }
}

// ---- Choosing a client -----------------------------------------------------------------------------

/**
 * `?mode=offline` runs the room in the browser. Otherwise the page uses the live room, and `?new=1` makes it forget
 * the room this tab remembers first, which is how a rehearsal starts from a clean room.
 */
export function createRoomClient(loc: Pick<Location, 'search' | 'origin'>, content: CaseContent): RoomClient {
  const params = new URLSearchParams(loc.search);
  if (params.get('mode') === 'offline') return new OfflineRoomClient(content);
  if (params.get('new') === '1') forgetRoom();
  return new WsRoomClient(loc.origin, content);
}
