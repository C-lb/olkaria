// The phone's connection to its room. It reconnects by itself, and it stops for good once the room has removed this phone.
import { KICKED_CLOSE_CODE, KICKED_CLOSE_REASON, type ClientMsg, type PlayerView, type ServerMsg } from '../shared/types';

export type SocketStatus = 'open' | 'closed' | 'kicked';

/** Wait before the next attempt: 1 s, 2 s, 4 s, then 10 s for as long as the room stays out of reach. */
const BACKOFF_MS = [1000, 2000, 4000, 10000];

/** The room sends this word as an error before it refuses a banned client, and closes a kicked socket with it. */
const REMOVED = KICKED_CLOSE_REASON;

export class PlayerSocket {
  private ws: WebSocket | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private failures = 0;
  private stopped = false;
  private viewCb: (view: PlayerView) => void = () => {};
  private statusCb: (status: SocketStatus) => void = () => {};
  private errorCb: (msg: string) => void = () => {};

  constructor(private readonly code: string, private readonly clientId: string) {
    this.connect();
  }

  onView(cb: (view: PlayerView) => void): void { this.viewCb = cb; }
  /** 'open' on every connection, 'closed' on every loss, and 'kicked' once, after which nothing reconnects. */
  onStatus(cb: (status: SocketStatus) => void): void { this.statusCb = cb; }
  /** Refusals from the room, such as "already voted". */
  onError(cb: (msg: string) => void): void { this.errorCb = cb; }

  /** Sent only while the connection is open. A message for a closed connection is dropped, not queued. */
  send(msg: ClientMsg): void {
    if (this.stopped || this.ws === null || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  private url(): string {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${scheme}://${location.host}/ws/${encodeURIComponent(this.code)}?role=player&clientId=${encodeURIComponent(this.clientId)}`;
  }

  private connect(): void {
    if (this.stopped) return;
    let ws: WebSocket;
    try {
      ws = new WebSocket(this.url());
    } catch {
      this.lost(null);
      return;
    }
    this.ws = ws;
    // Events from a socket that has been replaced or dropped on purpose belong to nobody.
    ws.addEventListener('open', () => {
      if (this.ws !== ws) return;
      this.failures = 0;
      this.statusCb('open');
    });
    ws.addEventListener('message', (ev) => {
      if (this.ws === ws) this.handle(ev.data);
    });
    ws.addEventListener('close', (ev) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.lost(ev.code);
    });
  }

  private lost(code: number | null): void {
    if (this.stopped) return;
    if (code === KICKED_CLOSE_CODE) {
      this.kick();
      return;
    }
    this.statusCb('closed');
    const wait = BACKOFF_MS[Math.min(this.failures, BACKOFF_MS.length - 1)];
    this.failures += 1;
    this.timer = setTimeout(() => this.connect(), wait);
  }

  private kick(): void {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.timer);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
    this.statusCb('kicked');
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
      case 'you':
        this.viewCb(msg.view);
        break;
      case 'kicked':
        this.kick();
        break;
      case 'error':
        if (msg.msg === REMOVED) this.kick();
        else this.errorCb(msg.msg);
        break;
      default:
        break; // host views are for the projector
    }
  }
}
