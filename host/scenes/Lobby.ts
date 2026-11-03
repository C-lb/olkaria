// The lobby. The HUD carries the QR, the code, the counts per class and the newest names; the canvas carries a
// gothic Nairobi skyline and, for every phone that joins, an avatar of its class dropping onto the road. No text is
// drawn on the canvas. Space starts the game.
import Phaser from 'phaser';
import QRCode from 'qrcode';
import type { CaseContent } from '../../shared/content';
import type { HostView, Role } from '../../shared/types';
import { PALETTE } from '../art/placeholders';
import type { Hud, LobbyArgs } from '../hud/Hud';
import type { RoomClient, RoomInfo } from '../net';

/** Where the avatars stand: the top of the road along the bottom of the canvas. */
const ROAD_Y = 172;
/** How long the connect may take before the HUD suggests offline mode. */
const SLOW_MS = 8000;
/** How long to wait after the room server refuses before asking again. */
const RETRY_MS = 3000;
/** How many of the newest names the list shows. */
const RECENT = 8;
const OFFLINE_HINT = 'Add ?mode=offline to the URL to rehearse without the server';

/** One QR per join address, so a lobby that starts again after a reset does not draw it twice. */
const qrs = new Map<string, Promise<string | null>>();

function qrFor(url: string): Promise<string | null> {
  let qr = qrs.get(url);
  if (qr === undefined) {
    qr = QRCode.toDataURL(url, { margin: 1, scale: 8 }).catch((err: unknown) => {
      console.warn('could not draw the join QR', err);
      qrs.delete(url);
      return null;
    });
    qrs.set(url, qr);
  }
  return qr;
}

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** A small fixed-seed generator, so the skyline is the same city every time. */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Lobby extends Phaser.Scene {
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;
  /** The room and its QR, once connect() has resolved and the QR is drawn (or has failed). */
  private room: (RoomInfo & { qr: string | null }) | null = null;
  private connected = false;
  /** One avatar per player, keyed by id and join time. */
  private avatars = new Map<string, Phaser.GameObjects.Image>();
  /** What the HUD shows now, so a view that changes nothing it shows does not redraw it. */
  private shown = '';
  /** Moves on when the scene stops, so a connect or a QR from an earlier run that finishes late changes nothing. */
  private run = 0;

  constructor() {
    super('Lobby');
  }

  create(): void {
    this.client = this.registry.get('client') as RoomClient;
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.room = null;
    this.connected = false;
    this.avatars = new Map();
    this.shown = '';
    const run = ++this.run;

    this.drawSkyline();
    this.registry.events.on('changedata-view', this.onView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.run += 1;
      this.registry.events.off('changedata-view', this.onView, this);
    });
    this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
      if (!event.repeat) this.client.send({ k: 'start' });
    });

    this.onView(null, (this.registry.get('view') as HostView | null | undefined) ?? null);
    this.time.delayedCall(SLOW_MS, () => {
      if (!this.connected) this.hud.showToast(`Still connecting. ${OFFLINE_HINT}`, 8000);
    });
    this.connect(run);
  }

  /** Asks for the room, and once it is known draws its QR. Refusals are shown and the ask is repeated. */
  private connect(run: number): void {
    this.client.connect().then(async (info) => {
      if (run === this.run) this.connected = true;
      const qr = this.client.mode === 'online' && info.joinUrl !== '' ? await qrFor(info.joinUrl) : null;
      if (run !== this.run) return;
      this.room = { ...info, qr };
      this.refresh();
    }, (err: unknown) => {
      if (run !== this.run) return;
      const reason = err instanceof Error ? err.message : String(err);
      this.hud.showToast(`${reason}. Trying again. ${OFFLINE_HINT}`, RETRY_MS + 1000);
      this.time.delayedCall(RETRY_MS, () => {
        if (run === this.run) this.connect(run);
      });
    });
  }

  private onView(_parent: unknown, view: HostView | null): void {
    if (view !== null && view.phase !== 'lobby') return;   // the router is about to move on
    if (view !== null) this.syncAvatars(view);
    this.refresh();
  }

  /** Redraws the HUD from the latest view, but only when something it shows has changed. */
  private refresh(): void {
    const view = (this.registry.get('view') as HostView | null | undefined) ?? null;
    if (view !== null && view.phase !== 'lobby') return;
    const players = view === null ? [] : Object.values(view.players);
    const classNames = Object.fromEntries(this.content.roles.map((r) => [r.id, r.className])) as Record<Role, string>;
    const roleCounts: Record<Role, number> = { citizen: 0, government: 0, business: 0, microsoft: 0 };
    for (const p of players) roleCounts[p.role] += 1;
    const recent = view === null || view.hideNames ? [] : [...players]
      .sort((a, b) => b.joinedAt - a.joinedAt || a.id.localeCompare(b.id))
      .slice(0, RECENT)
      .map((p) => `${p.name}, ${classNames[p.role]}`);
    const args: LobbyArgs = {
      qrDataUrl: this.room?.qr ?? null,
      code: this.room?.code ?? '',
      joinUrl: this.room?.joinUrl ?? '',
      count: players.length,
      roleCounts,
      classNames,
      recent,
      offline: this.client.mode === 'offline',
      smith: this.content.quotes.smith,
      tanui: this.content.quotes.tanui,
    };
    const sig = JSON.stringify(args);
    if (sig === this.shown) return;
    this.shown = sig;
    this.hud.showLobby(args);
  }

  /** An avatar drops in for each new player and goes for each one no longer in the room. */
  private syncAvatars(view: HostView): void {
    const here = new Set<string>();
    let dropped = 0;
    for (const p of Object.values(view.players).sort((a, b) => a.joinedAt - b.joinedAt)) {
      const key = `${p.id}@${p.joinedAt}`;
      here.add(key);
      if (!this.avatars.has(key)) this.avatars.set(key, this.dropAvatar(p.role, dropped++));
    }
    for (const [key, avatar] of this.avatars) {
      if (here.has(key)) continue;
      avatar.destroy();
      this.avatars.delete(key);
    }
  }

  private dropAvatar(role: Role, nth: number): Phaser.GameObjects.Image {
    const x = Phaser.Math.Between(10, 310);
    const y = ROAD_Y + Phaser.Math.Between(2, 6);
    const avatar = this.add.image(x, y - 28, `class-${role}`).setOrigin(0.5, 1).setAlpha(0).setDepth(y).setFlipX(Math.random() < 0.5);
    this.tweens.add({ targets: avatar, y, alpha: 1, duration: 600, ease: 'Bounce.easeOut', delay: Math.min(nth * 40, 1200) });
    return avatar;
  }

  /** Spires and towers along the bottom third, under the HUD panel: a far row, a near row with lit windows, the road. */
  private drawSkyline(): void {
    const rand = seeded(611);
    const g = this.add.graphics().setDepth(0);
    g.fillStyle(hex(PALETTE.stoneDeep), 1);
    for (let x = -4; x < 324;) {
      const w = 10 + Math.floor(rand() * 14);
      const top = 134 + Math.floor(rand() * 18);
      g.fillRect(x, top, w, ROAD_Y - top);
      if (rand() < 0.45) g.fillTriangle(x + 1, top, x + w - 1, top, x + w / 2, top - 6 - Math.floor(rand() * 8));
      x += w + Math.floor(rand() * 3);
    }
    const near: readonly (readonly [x: number, w: number, top: number])[] = [
      [6, 12, 140], [40, 10, 132], [74, 16, 144], [112, 12, 128], [190, 14, 136], [226, 10, 126], [262, 16, 142], [298, 12, 134],
    ];
    for (const [x, w, top] of near) {
      g.fillStyle(hex(PALETTE.stoneDark), 1);
      g.fillRect(x, top, w, ROAD_Y - top);
      g.fillTriangle(x, top, x + w, top, x + w / 2, top - 10 - Math.floor(rand() * 6));
      g.fillStyle(hex(PALETTE.ember), 1);
      for (let i = 0; i < 3; i++) {
        if (rand() < 0.6) g.fillRect(x + 2 + Math.floor(rand() * (w - 4)), top + 6 + Math.floor(rand() * (ROAD_Y - top - 14)), 1, 2);
      }
    }
    // A rotunda tower with a saucer roof, for the Kenyatta International Convention Centre.
    g.fillStyle(hex(PALETTE.stoneDark), 1);
    g.fillRect(150, 126, 12, ROAD_Y - 126);
    g.fillEllipse(156, 126, 26, 6);
    g.fillRect(155, 118, 2, 6);
    g.fillStyle(hex(PALETTE.ember), 1);
    g.fillRect(153, 136, 1, 2);
    g.fillRect(158, 148, 1, 2);
    g.fillStyle(hex(PALETTE.stone), 1);
    g.fillRect(0, ROAD_Y, 320, 180 - ROAD_Y);
    g.fillStyle(hex(PALETTE.stoneLight), 1);
    g.fillRect(0, ROAD_Y, 320, 1);
  }
}
