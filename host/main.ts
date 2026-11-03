// The projector page. It loads the case, picks the room client (online, or offline with ?mode=offline), lays the HUD
// over a 320 x 180 Phaser world at a whole-number zoom, and lets the router start whichever scene the room's phase
// calls for. Every scene reads the same registry: 'client', 'content', 'hud', and 'view', the latest HostView or null
// (listen for 'changedata-view').
import Phaser from 'phaser';
import { loadContent } from '../shared/content';
import type { HostView } from '../shared/types';
import { installHotkeys } from './hotkeys';
import { Hud } from './hud/Hud';
import { createRoomClient } from './net';
import { sceneFor, type ActiveScene, type SceneData } from './router';
import { applyZoom, integerZoom } from './scale';
import { Battle } from './scenes/Battle';
import { Boot } from './scenes/Boot';
import { Ending } from './scenes/Ending';
import { Leaderboard } from './scenes/Leaderboard';
import { Lobby } from './scenes/Lobby';
import { Travel } from './scenes/Travel';

const capitalise = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** ?new=1 has done its work once the client exists: a reload that kept it would open another room and orphan the phones. */
function dropNewFlag(): void {
  const url = new URL(location.href);
  if (url.searchParams.get('new') !== '1') return;
  url.searchParams.delete('new');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
}

/**
 * Starts the scene the room's phase calls for. Phaser starts a scene at once, so a start asked for while a frame is
 * being processed (a scene's own key handler, sending a command the offline room answers on the spot) waits for the
 * start of the next frame instead of tearing down the scene that is mid-update. The waiting start counts as the
 * active scene, so the views that keep arriving in the meantime do not ask for it again.
 */
function makeRouter(game: Phaser.Game): (view: HostView) => void {
  let queued: { key: string; data: SceneData } | null = null;

  const active = (): ActiveScene | null => {
    if (queued !== null) return { key: queued.key, round: queued.data.round };
    for (const scene of game.scene.getScenes(false)) {
      const { key, status, data } = scene.sys.settings;
      if (key === 'Boot' || status < Phaser.Scenes.START || status > Phaser.Scenes.RUNNING) continue;
      const round = (data as Partial<SceneData> | undefined)?.round;
      return { key, round: typeof round === 'number' ? round : -1 };
    }
    return null;
  };

  const go = (): void => {
    const next = queued;
    queued = null;
    if (next === null) return;
    for (const scene of game.scene.getScenes(false)) {
      const { key, status } = scene.sys.settings;
      if (key !== next.key && status >= Phaser.Scenes.START && status <= Phaser.Scenes.SLEEPING) game.scene.stop(key);
    }
    game.scene.start(next.key, next.data);
  };

  return (view) => {
    const next = sceneFor(view, active());
    if (next === null) return;
    const waiting = queued !== null;
    queued = next;
    if (!game.scene.isProcessing) go();
    else if (!waiting) game.events.once(Phaser.Core.Events.PRE_STEP, go);
  };
}

async function main(): Promise<void> {
  const content = loadContent((await import('../content/case.json')).default);
  const client = createRoomClient(location, content);
  dropNewFlag();
  const hudRoot = document.getElementById('hud');
  if (hudRoot === null) throw new Error('the page has no #hud element');
  const hud = new Hud(hudRoot);

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 320,
    height: 180,
    pixelArt: true,
    backgroundColor: '#15141c',
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      zoom: integerZoom(window.innerWidth, window.innerHeight),
      // The element that holds both the canvas and the HUD: in fullscreen the HUD has to come along.
      fullscreenTarget: 'stage',
    },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: 600 } } },
    scene: [Boot, Lobby, Travel, Battle, Ending, Leaderboard],
  });
  game.registry.set('client', client);
  game.registry.set('content', content);
  game.registry.set('hud', hud);
  game.registry.set('view', null);

  const route = makeRouter(game);
  client.onState((view) => {
    game.registry.set('view', view);
    route(view);
  });
  // Refusals ("bad phase", "not connected") show for 2 s, so a key pressed at the wrong moment is never silent.
  client.onError((msg) => hud.showToast(capitalise(msg), 2000));
  let dropped = false;
  client.onStatus((status) => {
    if (status === 'closed') {
      dropped = true;
      hud.showToast('Reconnecting to the room', 10000);
    } else if (dropped) {
      dropped = false;
      hud.showToast('Connected', 1500);
    }
  });

  const fit = (): void => applyZoom(game, hudRoot);
  game.events.once(Phaser.Core.Events.READY, fit);
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  installHotkeys(game, client, hud);
}

main().catch((err: unknown) => {
  console.error(err);
  const note = document.createElement('p');
  note.className = 'boot-error';
  note.textContent = `The host page could not start: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(note);
});
