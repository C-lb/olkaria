// tests/scale.test.ts
import { it, expect } from 'vitest';
import { integerZoom } from '../host/scale';
it('picks the largest whole zoom that fits', () => {
  expect(integerZoom(1920, 1080)).toBe(6);
  expect(integerZoom(1366, 768)).toBe(4);
  expect(integerZoom(1280, 720)).toBe(4);
  expect(integerZoom(640, 300)).toBe(1);
  expect(integerZoom(100, 100)).toBe(1);
});

// ---- Beyond the brief: the test above is its code unchanged ------------------------------------------------
import { vi } from 'vitest';
import type Phaser from 'phaser';
import { applyZoom } from '../host/scale';

const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height }) as DOMRect;

it('is held back by the width when the window is narrower than 16:9', () => {
  expect(integerZoom(1024, 768)).toBe(3);
  expect(integerZoom(1280, 4000)).toBe(4);
  expect(integerZoom(330, 2000)).toBe(1);
});

it('zooms the game to fit its parent, then lays the HUD exactly over the canvas and sets --zoom', () => {
  let zoom = 1;
  const setZoom = vi.fn((z: number) => { zoom = z; });
  // Phaser centres the canvas inside the 1366 x 768 parent: at zoom 4 it is 1280 x 720, at (43, 24).
  const game = {
    scale: { parent: { getBoundingClientRect: () => rect(0, 0, 1366, 768) }, width: 320, height: 180, setZoom },
    canvas: { getBoundingClientRect: () => rect(43, 24, 320 * zoom, 180 * zoom) },
  } as unknown as Phaser.Game;
  const props = new Map<string, string>();
  const hud = {
    offsetParent: { getBoundingClientRect: () => rect(0, 0, 1366, 768) },
    style: { left: '', top: '', width: '', height: '', setProperty: (name: string, value: string) => props.set(name, value) },
  } as unknown as HTMLElement;
  applyZoom(game, hud);
  expect(setZoom).toHaveBeenCalledWith(4);
  expect([hud.style.left, hud.style.top, hud.style.width, hud.style.height]).toEqual(['43px', '24px', '1280px', '720px']);
  expect(props.get('--zoom')).toBe('4');
});
