// The room: one Durable Object per game code. It wraps the pure reducer in shared/room-logic.ts with
// durable storage, one WebSocket per phone and per projector (the Hibernation API, so an idle room
// costs nothing) and the object's single alarm slot. The object can be evicted between two hibernated
// messages, so nothing here trusts memory: fetch, webSocketMessage and alarm each load the state from
// storage when the instance has none and cache it afterwards. Time is always Date.now(); the reducer
// never reads a clock.
import { DurableObject } from 'cloudflare:workers';
import { z } from 'zod';
import raw from '../content/case.json';
import { isValidCode } from '../shared/codes';
import { loadContent } from '../shared/content';
import { hostView, initialState, playerView, reduce } from '../shared/room-logic';
import {
  KICKED_CLOSE_CODE, KICKED_CLOSE_REASON, OPTION_IDS, ROLES,
  type ClientMsg, type Effect, type HostCmd, type OptionId, type Role, type RoomEvent, type RoomState, type ServerMsg,
} from '../shared/types';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  ASSETS: Fetcher;
}

/** A room with no activity for this long is closed and its storage deleted. */
const IDLE_MS = 6 * 60 * 60 * 1000;

const MAX_CLIENT_ID = 64;

/**
 * The longest vote window the room accepts, in seconds. It is far past any real vote, and it keeps
 * seconds * 1000 finite: a huge value would otherwise become an infinite deadline that no alarm can hold.
 */
const MAX_VOTE_SECONDS = 3600;

// ---- Messages --------------------------------------------------------------------------------------

const optionId = z.custom<OptionId>((v) => (OPTION_IDS as readonly unknown[]).includes(v));
const roleId = z.custom<Role>((v) => (ROLES as readonly unknown[]).includes(v));
const count = z.number().optional();

const hostCmd = z.discriminatedUnion('k', [
  z.object({ k: z.literal('start') }),
  z.object({ k: z.literal('openVote'), seconds: z.number().positive().max(MAX_VOTE_SECONDS).optional() }),
  z.object({ k: z.literal('closeVote') }),
  z.object({ k: z.literal('reveal') }),
  z.object({ k: z.literal('next') }),
  z.object({ k: z.literal('reopen') }),
  z.object({ k: z.literal('reset') }),
  z.object({ k: z.literal('kick'), playerId: z.string() }),
  z.object({ k: z.literal('exhibit'), exhibitId: z.string() }),
  z.object({ k: z.literal('injectVotes'), counts: z.object({ A: count, B: count, C: count, D: count }) }),
  z.object({ k: z.literal('hideNames'), hide: z.boolean() }),
  z.object({ k: z.literal('callout'), pick: z.number().optional(), playerId: z.string().optional() }),
  z.object({ k: z.literal('judge'), awarded: z.boolean() }),
]);

/** The shape every client message must have. */
const clientMsg = z.discriminatedUnion('t', [
  z.object({ t: z.literal('join'), clientId: z.string(), name: z.string(), role: roleId, table: z.string().optional() }),
  z.object({ t: z.literal('vote'), round: z.number(), option: optionId }),
  z.object({ t: z.literal('cmd'), key: z.string(), cmd: hostCmd }),
]);

// Compile-time only, and in both directions so the schema and ClientMsg cannot drift apart. A field with the
// wrong type fails the first line; a ClientMsg variant the schema lacks (a new host command, say) fails the second.
type Assignable<To, From extends To> = From;
type SchemaMsg = z.output<typeof clientMsg>;
type _SchemaFitsClientMsg = Assignable<ClientMsg, SchemaMsg>;
type _ClientMsgFitsSchema = Assignable<SchemaMsg, ClientMsg>;

const initBody = z.object({ code: z.string().refine(isValidCode), hostKey: z.string().min(1) });

/** Null for anything that is not a text frame holding a well-formed ClientMsg. */
function parseClientMsg(message: string | ArrayBuffer): ClientMsg | null {
  if (typeof message !== 'string') return null;
  try {
    const parsed = clientMsg.safeParse(JSON.parse(message));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The call-out draw is the one random number the reducer needs, so it travels in the command. */
const withPick = (cmd: HostCmd): HostCmd =>
  (cmd.k === 'callout' && cmd.pick === undefined ? { ...cmd, pick: Math.random() } : cmd);

// ---- Sockets ---------------------------------------------------------------------------------------

/** What each socket carries across hibernation. A host's clientId is empty; a player's never is. */
interface Attachment { role: 'host' | 'player'; clientId: string }

function attachmentOf(ws: WebSocket): Attachment | null {
  const a: unknown = ws.deserializeAttachment();
  if (typeof a !== 'object' || a === null) return null;
  const { role, clientId } = a as Record<string, unknown>;
  return (role === 'host' || role === 'player') && typeof clientId === 'string' ? { role, clientId } : null;
}

/** A socket that is already gone must not stop the others from being served. */
function send(ws: WebSocket, msg: ServerMsg): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch {
    // closed under us; there is nobody to tell
  }
}

function closeSocket(ws: WebSocket, code: number, reason: string): void {
  try {
    ws.close(code, reason);
  } catch {
    // already closed
  }
}

// ---- Room ------------------------------------------------------------------------------------------

export class Room extends DurableObject<Env> {
  private readonly content = loadContent(raw);
  private state: RoomState | undefined;
  private lastActivity = 0;

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'POST' && url.pathname === '/init') return this.init(req);

    const state = await this.load();
    if (!state) return new Response('No such room', { status: 404 });

    const role = url.searchParams.get('role');
    // The host page probes a remembered room with a plain GET of its socket address, so the answers come in this
    // order: 404 for a room that is gone, 403 for a wrong host key, and 426 for a live room that accepts the key.
    if (role === 'host' && url.searchParams.get('key') !== state.hostKey) return new Response('Bad host key', { status: 403 });
    if (req.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return new Response('Expected a WebSocket upgrade', { status: 426 });

    let attachment: Attachment;
    if (role === 'host') {
      attachment = { role: 'host', clientId: '' };
    } else if (role === 'player') {
      const clientId = url.searchParams.get('clientId') ?? '';
      if (clientId.length === 0 || clientId.length > MAX_CLIENT_ID) return new Response('Bad client id', { status: 400 });
      attachment = { role: 'player', clientId };
    } else {
      return new Response('Bad role', { status: 400 });
    }

    const [client, server] = Object.values(new WebSocketPair());
    server.serializeAttachment(attachment);
    this.ctx.acceptWebSocket(server, [attachment.role]);
    const first = this.viewFor(attachment, state, Date.now());
    if (first) send(server, first);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const attachment = attachmentOf(ws);
      const msg = parseClientMsg(message);
      if (!attachment || !msg) {
        send(ws, { t: 'error', msg: 'bad message' });
        return;
      }
      if (!(await this.load())) {
        send(ws, { t: 'error', msg: 'no such room' });
        return;
      }
      const now = Date.now();
      if (msg.t === 'cmd') {
        // Only the projector socket may command. The reducer checks the key inside the event as well.
        if (attachment.role !== 'host') {
          send(ws, { t: 'error', msg: 'bad host key' });
          return;
        }
        await this.apply({ type: 'cmd', key: msg.key, cmd: withPick(msg.cmd), now });
      } else if (attachment.role !== 'player') {
        // join and vote act as a client id, and a host socket has none.
        send(ws, { t: 'error', msg: 'bad message' });
      } else if (msg.t === 'join') {
        await this.apply({ type: 'join', clientId: attachment.clientId, name: msg.name, role: msg.role, table: msg.table, now });
      } else {
        await this.apply({ type: 'vote', clientId: attachment.clientId, round: msg.round, option: msg.option, now });
      }
    } catch (err) {
      console.error('webSocketMessage failed', err);
      send(ws, { t: 'error', msg: 'server error' });
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    // A phone dropping off changes no state. The one job is to finish the close handshake: before compatibility
    // date 2026-04-07 the runtime does not answer a Close frame itself, and an unanswered close leaves the socket
    // half open until the platform gives up on it.
    try {
      ws.close(code, reason);
    } catch {
      // 1005, 1006 and 1015 describe how a peer left and cannot be sent back, so answer plainly.
      closeSocket(ws, 1000, '');
    }
  }

  webSocketError(ws: WebSocket): void {
    // The runtime reports a broken socket here and does not close it; do so, so it leaves getWebSockets().
    closeSocket(ws, 1011, 'error');
  }

  async alarm(): Promise<void> {
    if (!(await this.load())) return;
    // The reducer decides whether it is time to lock the vote; apply re-arms the idle cleanup when the vote is not open.
    await this.apply({ type: 'tick', now: Date.now() });
    const state = this.state;
    if (state && state.phase !== 'vote' && Date.now() - this.lastActivity >= IDLE_MS) await this.wipe();
  }

  /** POST /init from the Worker: stores the first state. A code that already has a live room is refused. */
  private async init(req: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response('Bad body', { status: 400 });
    }
    const parsed = initBody.safeParse(body);
    if (!parsed.success) return new Response('Bad body', { status: 400 });
    // Nothing but storage is awaited from here to the write, so no other event can slip in between.
    if (await this.load()) return new Response('Room exists', { status: 409 });
    const now = Date.now();
    const state = initialState(parsed.data.code, parsed.data.hostKey, now, this.content);
    await this.ctx.storage.put({ state, lastActivity: now });
    await this.ctx.storage.setAlarm(now + IDLE_MS);
    this.state = state;
    this.lastActivity = now;
    return new Response(null, { status: 201 });
  }

  private async load(): Promise<RoomState | undefined> {
    if (this.state === undefined) {
      const stored = await this.ctx.storage.get<unknown>(['state', 'lastActivity']);
      this.state = stored.get('state') as RoomState | undefined;
      const last = stored.get('lastActivity');
      this.lastActivity = typeof last === 'number' ? last : (this.state?.updatedAt ?? Date.now());
    }
    return this.state;
  }

  /**
   * Reduce, persist, run the effects in order, then tell everyone. Memory is only updated once the write is accepted.
   * A refusal or a no-op leaves updatedAt where it was (the reducer moves it on every change and on nothing else, see
   * tests/room-logic.test.ts), so it is neither stored nor broadcast and does not count as activity: its effects (an
   * error, a kick, an alarm) still run. A phone that rejoins has had its view already, when its socket was accepted.
   */
  private async apply(ev: RoomEvent): Promise<void> {
    const state = await this.load();
    if (!state) return;
    const { state: next, effects } = reduce(state, ev, this.content);
    const changed = next.updatedAt !== state.updatedAt;
    if (changed) {
      // A tick is the clock, not a person. alarm() reads lastActivity to decide a room is idle, so a tick must not refresh it.
      const lastActivity = ev.type === 'tick' ? this.lastActivity : ev.now;
      await this.ctx.storage.put({ state: next, lastActivity });
      this.state = next;
      this.lastActivity = lastActivity;
    }
    for (const effect of effects) await this.run(effect);
    // One alarm slot: the vote deadline while a vote is open (the reducer sets it), the idle cleanup otherwise.
    if (next.phase !== 'vote') await this.ctx.storage.setAlarm(this.lastActivity + IDLE_MS);
    if (changed) this.broadcast();
  }

  private async run(effect: Effect): Promise<void> {
    switch (effect.type) {
      case 'setAlarm':
        await this.ctx.storage.setAlarm(effect.at);
        break;
      case 'clearAlarm':
        await this.ctx.storage.deleteAlarm();
        break;
      case 'error': {
        // To the phone the error is about, or to the projector when it is not about a client.
        const msg: ServerMsg = { t: 'error', msg: effect.msg };
        for (const ws of this.ctx.getWebSockets()) {
          const attachment = attachmentOf(ws);
          if (!attachment) continue;
          if (effect.clientId === undefined ? attachment.role === 'host' : attachment.clientId === effect.clientId) send(ws, msg);
        }
        break;
      }
      case 'kicked':
        for (const ws of this.ctx.getWebSockets('player')) {
          if (attachmentOf(ws)?.clientId !== effect.clientId) continue;
          send(ws, { t: 'kicked' });
          closeSocket(ws, KICKED_CLOSE_CODE, KICKED_CLOSE_REASON);
        }
        break;
      default: {
        // A new Effect variant that no case above handles fails the build here instead of being ignored.
        const _exhaustive: never = effect;
        return _exhaustive;
      }
    }
  }

  /** What one socket is shown: the host view, or the player's own view (nothing for a client the room does not know). */
  private viewFor(attachment: Attachment, state: RoomState, now: number): ServerMsg | null {
    if (attachment.role === 'host') return { t: 'host', state: hostView(state, now, this.content) };
    const view = playerView(state, attachment.clientId, now, this.content);
    return view === null ? null : { t: 'you', view };
  }

  private broadcast(): void {
    const state = this.state;
    if (!state) return;
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = attachmentOf(ws);
      const msg = attachment && this.viewFor(attachment, state, now);
      if (msg) send(ws, msg);
    }
  }

  /** Closes every socket and deletes everything the room stored, the alarm included. */
  private async wipe(): Promise<void> {
    // Forget the room in memory first, so nothing can write the old state back while the deletes are in flight.
    this.state = undefined;
    this.lastActivity = 0;
    for (const ws of this.ctx.getWebSockets()) closeSocket(ws, 1001, 'room closed');
    await this.ctx.storage.deleteAll();
    // deleteAll leaves a pending alarm alone on compatibility dates before 2026-02-24.
    await this.ctx.storage.deleteAlarm();
  }
}
