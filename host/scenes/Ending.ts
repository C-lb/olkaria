// The ending (spec, "The flow" 8). The HUD says "Congratulations!" and "The Deadlock is broken." at the top, then the
// last question and a column per option with who picked it. The canvas has the floor and the four figures in the
// middle, hopping on the spot in a loop, each a beat behind the one before. No boss: the Deadlock is broken. It closes
// the game, so Space does nothing here. A reload is no different: the party hops again.
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import { ROLES, type HostView } from '../../shared/types';
import { PALETTE } from '../art/placeholders';
import type { Sound } from '../audio/sound';
import { endingArgs } from '../finale';
import type { Hud } from '../hud/Hud';

const hex = (colour: string): number => Number.parseInt(colour.slice(1), 16);

/**
 * The floor the party hops on: between the title (to y 34) and the question's panel (from y 70), so a figure at the
 * top of its hop (y 36) stays clear of both.
 */
const GROUND_Y = 66;
const FLOOR_H = 16;
/** The four in the middle of the canvas, in ROLES order. */
const PARTY_X = [127, 149, 171, 193] as const;
/** Each hop: HOP_PX up over HOP_MS and down again, each figure HOP_LAG_MS behind the one before it. */
const HOP_PX = 10;
const HOP_MS = 300;
const HOP_LAG_MS = 120;

export class Ending extends Phaser.Scene {
  private content!: CaseContent;
  private hud!: Hud;
  /** The music and effects (audio/sound.ts); `sound` is Phaser's own. */
  private audio!: Sound;
  /** The latest view of the ending; its theme sounds on the first. */
  private view: HostView | null = null;
  /** What the HUD shows now, so a view that changes nothing it shows redraws nothing. */
  private shown = '';

  constructor() {
    super('Ending');
  }

  create(): void {
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.audio = this.registry.get('sound') as Sound;
    this.hud.clear();
    this.view = null;
    this.shown = '';

    this.drawArena();
    this.registry.events.on('changedata-view', this.onView, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-view', this.onView, this);
    });
    this.onView(null, (this.registry.get('view') as HostView | null | undefined) ?? null);
  }

  private drawArena(): void {
    const { width, height } = this.scale;
    this.add.tileSprite(0, GROUND_Y, width, FLOOR_H, 'tile-ground').setOrigin(0, 0).setDepth(0);
    this.add.rectangle(0, GROUND_Y + FLOOR_H, width, height - GROUND_Y - FLOOR_H, hex(PALETTE.stoneDeep)).setOrigin(0, 0).setDepth(0);
    ROLES.forEach((role, i) => {
      const figure = this.add.image(PARTY_X[i], GROUND_Y, `class-${role}`).setOrigin(0.5, 1).setDepth(20);
      this.tweens.add({
        targets: figure, y: GROUND_Y - HOP_PX, duration: HOP_MS, ease: 'Quad.easeOut', yoyo: true, repeat: -1, delay: i * HOP_LAG_MS,
      });
    });
  }

  /** Sounds the ending on the first view, and redraws the HUD when what it shows has changed. */
  private onView(_parent: unknown, view: HostView | null): void {
    if (view === null || view.phase !== 'ending') return;   // the router is about to move on
    if (this.view === null) {
      this.audio.sfx('endingWon');
      this.audio.music('endingWon');
    }
    this.view = view;
    const args = endingArgs(this.content, view);
    const sig = JSON.stringify(args);
    if (sig === this.shown) return;
    this.shown = sig;
    this.hud.showEnding(args);
  }
}
