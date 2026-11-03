// Placeholder until Task 9 builds the Travel scene: it starts the round's Battle at once, as the arena gate will, so the
// loop can be played before the platformer exists. The router counts that Battle as fitting the `travel` phase.
import Phaser from 'phaser';
import type { SceneData } from '../router';

export class Travel extends Phaser.Scene {
  private round = 0;
  private resume = false;

  constructor() {
    super('Travel');
  }

  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
    this.resume = data.resume ?? false;
  }

  create(): void {
    const battle: SceneData = { round: this.round, resume: false };
    this.scene.start('Battle', battle);
  }
}
