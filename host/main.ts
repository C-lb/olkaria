// The projector page. It loads the case, picks the room client (online, or offline with ?mode=offline), lays the HUD
// over a 320 x 180 Phaser world at a whole-number zoom, and lets the router start whichever scene the room's phase
// calls for. The scenes share one registry: 'client', 'content', 'hud', 'sound', the music and effects (audio/sound.ts,
// silent until the first key press or click), 'view', the latest HostView or null (listen for 'changedata-view'), and
// 'spaceLockedUntil' (SPACE_LOCK_KEY in strikers.ts), the game time before which Space does nothing, which Lobby,
// Travel, Battle and Ending set so that a press's rest holds across a scene switch. The facilitator's hotkeys work in
// every scene (S among them turns the sound off or on), and M or Esc opens the menu over any screen (menu.ts): restart
// the round, back to the lobby, reload the page, sound off or on, go to a stage, and the key map. The ? key opens How
// to play over any screen (howto.ts): eight slides on how the game is played and scored.
import Phaser from 'phaser';
import { loadContent } from '../shared/content';
import { createSound } from './audio/sound';
import { installHotkeys } from './hotkeys';
import { installHowTo } from './howto';
import { capitalise, Hud } from './hud/Hud';
import { installMenu } from './menu';
import { createRoomClient } from './net';
import { connectionNotices } from './notices';
import { makeRouter } from './router';
import { applyZoom, integerZoom } from './scale';
import { Battle } from './scenes/Battle';
import { Boot } from './scenes/Boot';
import { Ending } from './scenes/Ending';
import { Leaderboard } from './scenes/Leaderboard';
import { Lobby } from './scenes/Lobby';
import { Travel } from './scenes/Travel';

/** The page's localStorage, or null where reading it throws (storage blocked by the browser's settings). */
function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** ?new=1 has done its work once the client exists: a reload that kept it would open another room and orphan the phones. */
function dropNewFlag(): void {
  const url = new URL(location.href);
  if (url.searchParams.get('new') !== '1') return;
  url.searchParams.delete('new');
  history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`);
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
    banner: false,
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
  const sound = createSound({
    target: window,
    storage: safeLocalStorage(),
    makeContext: () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
  });
  game.registry.set('sound', sound);
  game.registry.set('view', null);

  // Scene switches wait until the handler that delivered the view has returned (see makeRouter).
  const route = makeRouter(game);
  client.onState((view) => {
    game.registry.set('view', view);
    route(view);
  });
  // Refusals ("bad phase", "not connected") show for 2 s, so a key pressed at the wrong moment is never silent.
  client.onError((msg) => hud.showToast(capitalise(msg), 2000));
  // A drop keeps "Reconnecting to the room" up for as long as it lasts, and a room that has closed says to reload.
  client.onStatus(connectionNotices(hud));

  const fit = (): void => applyZoom(game, hudRoot);
  game.events.once(Phaser.Core.Events.READY, fit);
  window.addEventListener('resize', fit);
  document.addEventListener('fullscreenchange', fit);
  installHotkeys(game, client, hud, sound);
  // The how-to's key listener goes on before the menu's: both listen on window in the capture phase, where listeners
  // run in the order they were added, and this order is what lets the how-to swallow every key before the menu.
  installHowTo(hud, content);
  installMenu(game, client, hud, content, sound);
}

main().catch((err: unknown) => {
  console.error(err);
  const note = document.createElement('p');
  note.className = 'boot-error';
  note.textContent = `The host page could not start: ${err instanceof Error ? err.message : String(err)}`;
  document.body.append(note);
});
