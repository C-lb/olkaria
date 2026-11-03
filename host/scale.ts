// The world is 320 x 180 canvas pixels drawn at a whole-number zoom, so every pixel of the art stays a square of
// screen pixels (spec 7). The HUD, the HTML text layer, is laid exactly over the canvas and sized from --zoom.
import type Phaser from 'phaser';

/** The largest whole zoom at which a w x h world fits a winW x winH window, and never less than 1. */
export function integerZoom(winW: number, winH: number, w = 320, h = 180): number {
  return Math.max(1, Math.floor(Math.min(winW / w, winH / h)));
}

/**
 * Zooms the game to the largest whole multiple that fits its parent (the window, or the screen in fullscreen), has
 * Phaser centre the canvas, then lays `hudRoot` over the canvas rectangle and sets its --zoom. Run at boot and on
 * every resize. `hudRoot` is positioned against its offset parent, the element that holds the game and the HUD.
 */
export function applyZoom(game: Phaser.Game, hudRoot: HTMLElement): void {
  const parent = game.scale.parent as HTMLElement | null;
  const box = parent?.getBoundingClientRect();
  const width = box !== undefined && box.width > 0 ? box.width : window.innerWidth;
  const height = box !== undefined && box.height > 0 ? box.height : window.innerHeight;
  const zoom = integerZoom(width, height, game.scale.width, game.scale.height);
  // Always set, even when the zoom is unchanged: setZoom refreshes, and the refresh re-centres the canvas in the
  // parent's new size now rather than on Phaser's next frame, so the rectangle read below is already the final one.
  game.scale.setZoom(zoom);

  const canvas = game.canvas.getBoundingClientRect();
  const frame = (hudRoot.offsetParent ?? hudRoot.parentElement)?.getBoundingClientRect();
  const style = hudRoot.style;
  style.left = `${canvas.left - (frame?.left ?? 0)}px`;
  style.top = `${canvas.top - (frame?.top ?? 0)}px`;
  style.width = `${canvas.width}px`;
  style.height = `${canvas.height}px`;
  style.setProperty('--zoom', String(zoom));
}
