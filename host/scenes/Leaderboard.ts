// The closing screen (spec 3.2): the top five, the most consistent strategist, the top table, and round 4's split under
// the question the class discussion picks up, all in the HUD and redrawn from each view (H hides or shows the names).
// The canvas keeps the party at rest on a floor behind the panel's lower band, the core gone. There is no Space here, so
// the screen survives a stray press through the discussion; only Shift+R twice (host/hotkeys.ts) takes the room back to
// the lobby.
import Phaser from 'phaser';
import type { CaseContent } from '../../shared/content';
import type { HostView, Role } from '../../shared/types';
import { leaderboardArgs } from '../finale';
import type { Hud } from '../hud/Hud';
import type { SceneData } from '../router';
import { classFor } from '../strikers';

/**
 * One row of floor tiles near the bottom, the party standing on it where it stood for the last round. The leaderboard's
 * panel covers the canvas but for a 4 px margin (hud.css `.leaderboard`: inset var(--s4), corners var(--r-lg), 3 px)
 * and centres its text, so a floor kept FLOOR_INSET inside every edge sits wholly behind the panel's empty lower band:
 * nothing shows bright around the panel, and no sprite stands behind a line of text.
 */
const FLOOR_H = 16;
const FLOOR_INSET = 8;
const LEAD_X = 104;
const SUPPORT_X = [30, 52, 74] as const;

export class Leaderboard extends Phaser.Scene {
  private round = 0;
  private content!: CaseContent;
  private hud!: Hud;
  /** What the HUD shows now, so a view that changes nothing it shows redraws nothing. */
  private shown = '';

  constructor() {
    super('Leaderboard');
  }

  /** A resumed leaderboard is no different from a fresh one, so only the round is kept: the party stands as it did in it. */
  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
  }

  create(): void {
    this.content = this.registry.get('content') as CaseContent;
    this.hud = this.registry.get('hud') as Hud;
    this.hud.clear();
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
    const groundY = height - FLOOR_INSET - FLOOR_H;
    this.add.tileSprite(FLOOR_INSET, groundY, width - 2 * FLOOR_INSET, FLOOR_H, 'tile-ground').setOrigin(0, 0).setDepth(0);
    const { lead, support } = classFor(this.content, this.round);
    const stand = (role: Role, x: number): void => {
      this.add.image(x, groundY, `class-${role}`).setOrigin(0.5, 1).setDepth(20);
    };
    stand(lead, LEAD_X);
    support.forEach((role, i) => stand(role, SUPPORT_X[i] ?? SUPPORT_X[0]));
  }

  private onView(_parent: unknown, view: HostView | null): void {
    if (view === null || view.phase !== 'leaderboard') return;   // the router is about to move on
    const args = leaderboardArgs(this.content, view);
    const sig = JSON.stringify(args);
    if (sig === this.shown) return;
    this.shown = sig;
    this.hud.showLeaderboard(args);
  }
}
