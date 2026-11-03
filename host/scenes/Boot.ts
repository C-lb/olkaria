// Draws the placeholder art, then hands over to the lobby. The router takes over once the room's first view arrives.
import Phaser from 'phaser';
import { makePlaceholders } from '../art/placeholders';
import type { SceneData } from '../router';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    makePlaceholders(this);
    const lobby: SceneData = { round: -1, resume: false };
    this.scene.start('Lobby', lobby);
  }
}
