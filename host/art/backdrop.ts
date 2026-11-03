// The night behind the road in Travel: a cloudy sky with a dim moon, and a hill with a ruined castle and bare trees,
// both from the Superpowers backgrounds pack (CREDITS.md) recoloured to the stone palette. Each layer is a tile sprite
// at twice its pixel size, scrolled at a fraction of the camera's pace, the hill faster than the sky. Boot loads the
// files; a layer that did not load is left out, and the night colour behind the canvas shows instead.
import Phaser from 'phaser';
import nightSky from './assets/backdrop/night-sky.png';
import stormHill from './assets/backdrop/storm-hill.png';

export interface BackdropLayer {
  key: string;
  url: string;
  /** The fraction of the camera's scroll the layer moves by. */
  scroll: number;
  /** Where the layer's top edge sits on the canvas. */
  top: number;
}

/** Far to near. The hill's foot is behind the road (its top at 160), so only its slopes and the castle show. */
export const BACKDROP: readonly BackdropLayer[] = [
  { key: 'backdrop-sky', url: nightSky, scroll: 0.1, top: 0 },
  { key: 'backdrop-hill', url: stormHill, scroll: 0.3, top: -8 },
];
/** Each pixel of a layer is drawn two world pixels square: 137 x 89 covers 274 x 178. */
const SCALE = 2;
/** Behind everything Travel draws; its road is at depth 0. */
const DEPTH = -10;

/** Lays the backdrop behind a world `width` px wide, seen through a camera the width of the canvas. */
export function addBackdrop(scene: Phaser.Scene, width: number): void {
  const view = scene.scale.width;
  BACKDROP.forEach(({ key, scroll, top }, i) => {
    if (!scene.textures.exists(key)) return;
    const { height } = scene.textures.getFrame(key);
    // The camera crosses width - view; the layer moves that times `scroll`, and must cover the view all the way.
    const span = Math.ceil(view + (width - view) * scroll) + SCALE;
    scene.add.tileSprite(0, top, span, height * SCALE, key)
      .setOrigin(0, 0).setTileScale(SCALE).setScrollFactor(scroll).setDepth(DEPTH + i);
  });
}
