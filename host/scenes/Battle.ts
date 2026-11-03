// Placeholder until Task 8 builds the Battle scene: it shows that the router started it, for which round, and nothing else.
import Phaser from 'phaser';
import type { Hud } from '../hud/Hud';
import type { SceneData } from '../router';

export class Battle extends Phaser.Scene {
  private round = 0;
  private resume = false;

  constructor() {
    super('Battle');
  }

  init(data: Partial<SceneData>): void {
    this.round = data.round ?? 0;
    this.resume = data.resume ?? false;
  }

  create(): void {
    const hud = this.registry.get('hud') as Hud;
    hud.clear();
    hud.showToast(`Battle scene, round ${this.round} (Task 8 to 10)`, 3000);
  }
}
