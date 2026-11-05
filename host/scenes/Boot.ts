// Loads the art in host/art/assets (credited in CREDITS.md), paints the bosses and every placeholder still needed, then
// hands over to the lobby. A file that fails to load is reported once and its key left to the placeholder (the backdrop,
// which has none, is left out): the game never waits on art. The router takes over once the room's first view arrives.
import Phaser from 'phaser';
import { makeBossArt } from '../art/bosses';
import { makePlaceholders } from '../art/placeholders';
import type { SceneData } from '../router';

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.warn(`Art "${file.key}" did not load from ${String(file.url)}; the game carries on without it.`);
    });
  }

  /** The bosses first, so `boss-core` is theirs; then the placeholders fill every key still missing. */
  create(): void {
    makeBossArt(this);
    makePlaceholders(this);
    const lobby: SceneData = { round: -1, resume: false, trip: 0 };
    this.scene.start('Lobby', lobby);
  }
}
