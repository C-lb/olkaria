// The ending (spec 4.6). The HUD names the ending the class reached, at its tier, over round 4's split: what must be
// true and the risk accepted, or, when the Deadlock holds, why. The canvas keeps the last round's arena, the party on
// the floor facing the core. For an option's ending the core trembles, flashes and splits in two, once per start of
// the scene and in under 2 s, with no key needed; when the Deadlock holds it stands still. Space moves the room on to
// the leaderboard, which also cuts the crack short. A reload here is no different: the crack plays again.
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import type { HostView, Role } from '../../shared/types';
import { PALETTE } from '../art/placeholders';
import { endingArgs, outcomeOf } from '../finale';
import type { Hud } from '../hud/Hud';
import type { RoomClient } from '../net';
import type { SceneData } from '../router';
import { classFor, SEND_LOCK_MS, SPACE_LOCK_KEY } from '../strikers';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/** The arena as the last round's Battle left it: one row of floor tiles, the core at the right edge, the party facing it. */
const GROUND_Y = 84;
const FLOOR_H = 16;
const CORE_X = 280;
const LEAD_X = 104;
const SUPPORT_X = [30, 52, 74] as const;

/**
 * The crack, 1.65 s in all: the core trembles a pixel each way (eight times, 100 ms each), flashes bone white for
 * 150 ms, then splits down the middle, its halves tipping apart over 700 ms while the camera shakes.
 */
const TREMBLE_PX = 1;
const TREMBLE_MS = 50;
const TREMBLES = 8;
const FLASH_MS = 150;
const SPLIT_PX = 10;
const TILT_DEG = 12;
const SPLIT_MS = 700;
const SHAKE_MS = 250;
const SHAKE = 0.01;

export class Ending extends Phaser.Scene {
  private round = 0;
  private client!: RoomClient;
  private content!: CaseContent;
  private hud!: Hud;
  private core!: Phaser.GameObjects.Image;
  /** The latest view of the ending: Space sends nothing before one has come. */
  private view: HostView | null = null;
  /** What the HUD shows now, so a view that changes nothing it shows redraws nothing. */
  private shown = '';
  /** The core cracks once per start of the scene, however many views follow. */
  private cracked = false;

  constructor() {
    super('Ending');
  }

  /** A resumed ending is no different from a fresh one, so only the round is kept: the party stands as it did in it. */
  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
  }

  /**
   * Space does nothing until the game clock passes this. It lives in the registry, where the Battle set it when Space
   * on round 4's debrief sent `next`, so a second press of that Space cannot also send this screen on.
   */
  private get lockedUntil(): number {
    const until: unknown = this.registry.get(SPACE_LOCK_KEY);
    return typeof until === 'number' ? until : 0;
  }

  private set lockedUntil(until: number) {
    this.registry.set(SPACE_LOCK_KEY, until);
  }

  create(): void {
    this.client = this.registry.get('client') as RoomClient;
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.hud.clear();
    this.view = null;
    this.shown = '';
    this.cracked = false;

    this.drawArena();
    this.registry.events.on('changedata-view', this.onView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-view', this.onView, this);
    });
    this.input.keyboard?.on('keydown-SPACE', (event: KeyboardEvent) => {
      if (!event.repeat) this.onSpace();
    });
    this.onView(null, (this.registry.get('view') as HostView | null | undefined) ?? null);
  }

  private drawArena(): void {
    const { width, height } = this.scale;
    this.add.tileSprite(0, GROUND_Y, width, FLOOR_H, 'tile-ground').setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, GROUND_Y + FLOOR_H, width, height - GROUND_Y - FLOOR_H, hex(PALETTE.stoneDeep)).setOrigin(0, 0).setDepth(0);
    this.core = this.add.image(CORE_X, GROUND_Y, 'boss-core').setOrigin(0.5, 1).setDepth(10);
    const { lead, support } = classFor(this.content, this.round);
    const stand = (role: Role, x: number): void => {
      this.add.image(x, GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(20);
    };
    stand(lead, LEAD_X);
    support.forEach((role, i) => stand(role, SUPPORT_X[i] ?? SUPPORT_X[0]));
  }

  /** Redraws the HUD when what it shows has changed, and cracks the core the first time a view names an option's ending. */
  private onView(_parent: unknown, view: HostView | null): void {
    if (view === null || view.phase !== 'ending') return;   // the router is about to move on
    this.view = view;
    const args = endingArgs(this.content, view);
    const sig = JSON.stringify(args);
    if (sig !== this.shown) {
      this.shown = sig;
      this.hud.showEnding(args);
    }
    if (!this.cracked && outcomeOf(this.content, view).ending !== 'holds') {
      this.cracked = true;
      this.crack();
    }
  }

  /** Space sends `next` and rests a second. The rest is set before the send, because offline the answer comes inside it. */
  private onSpace(): void {
    if (this.view === null || this.time.now < this.lockedUntil) return;
    this.lockedUntil = this.time.now + SEND_LOCK_MS;
    this.client.send({ k: 'next' });
  }

  /** The core trembles, then flashes, then splits. */
  private crack(): void {
    this.tweens.add({
      targets: this.core,
      x: { from: CORE_X - TREMBLE_PX, to: CORE_X + TREMBLE_PX },
      duration: TREMBLE_MS,
      yoyo: true,
      repeat: TREMBLES - 1,
      onComplete: () => {
        this.core.setX(CORE_X).setTintFill(hex(PALETTE.bone));
        this.time.delayedCall(FLASH_MS, () => this.split());
      },
    });
  }

  /** The whole core gives way to its two halves, each cropped from the same texture, which tip apart from the seam. */
  private split(): void {
    const { width, height } = this.core;
    this.core.setVisible(false);
    this.cameras.main.shake(SHAKE_MS, SHAKE);
    for (const side of [-1, 1] as const) {
      const half = this.add.image(CORE_X, GROUND_Y, 'boss-core').setOrigin(0.5, 1).setDepth(10)
        .setCrop(side < 0 ? 0 : width / 2, 0, width / 2, height);
      this.tweens.add({ targets: half, x: CORE_X + side * SPLIT_PX, angle: side * TILT_DEG, duration: SPLIT_MS, ease: 'Quad.easeOut' });
    }
  }
}
