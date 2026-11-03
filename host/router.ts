// Which scene the projector should be showing for the room's phase and round, and the switch to it. On a load or a
// reconnect the host resumes where the room is (spec 6.3): the lobby, the start of a travel segment, the battle at its
// state, or the ending and leaderboard screens. A scene that already fits is left alone.
import type Phaser from 'phaser';
import type { Phase } from '../shared/types';

/** What every scene is started with: the round it belongs to, and whether it picks up a phase already under way. */
export interface SceneData { round: number; resume: boolean }

/** The scene running now, by key, and the round it was started for (-1 for the lobby). */
export interface ActiveScene { key: string; round: number }

/**
 * The scene to start for `view`, or null when `active` already fits it. Travel's gate starts the Battle while the room
 * is still in `travel`, so a Battle for that round fits `travel` too. Battle started from here always resumes: the
 * strike of a saved `reveal` is never replayed, the debrief shows directly.
 */
export function sceneFor(
  view: { phase: Phase; round: number },
  active: ActiveScene | null,
): { key: string; data: SceneData } | null {
  const { phase, round } = view;
  const at = (key: string): boolean => active !== null && active.key === key && active.round === round;
  const start = (key: string, resume = false) => ({ key, data: { round, resume } });
  switch (phase) {
    case 'lobby':
      return active?.key === 'Lobby' ? null : start('Lobby');
    case 'travel':
      return at('Travel') || at('Battle') ? null : start('Travel');
    case 'vote':
    case 'locked':
    case 'reveal':
      return at('Battle') ? null : start('Battle', true);
    case 'ending':
      return active?.key === 'Ending' ? null : start('Ending');
    case 'leaderboard':
      return active?.key === 'Leaderboard' ? null : start('Leaderboard');
    default:
      phase satisfies never;   // a phase this code does not know starts nothing
      return null;
  }
}

/**
 * The function main.ts hands every view to: it stops every other started scene and starts the one `sceneFor` names.
 *
 * The switch never happens inside the call that delivered the view. Phaser runs a scene's key handlers straight from
 * the DOM key event, outside its frame, and offline a command sent from one of them comes back as a new view before
 * send() returns: switching there would stop the scene in the middle of its own handler. So every switch waits for a
 * microtask, which runs once the handler (and whatever called it) has returned. Until then the waiting switch counts as
 * the active scene, so the views that keep arriving do not ask for it again, and a newer view can still replace it. A
 * switch that a newer view has made unnecessary (a reset straight after a start, say) does nothing.
 *
 * Scenes are told apart by `settings.active`, which Phaser sets from a scene's start until it stops (this game never
 * pauses or sleeps a scene), and their round is read from the data they were started with, so a scene that starts
 * another (Travel's gate starting Battle) must pass `{ round, resume }` as well. Boot is never the active scene.
 */
export function makeRouter(game: Phaser.Game): (view: { phase: Phase; round: number }) => void {
  let waiting: { key: string; data: SceneData } | null = null;

  const running = (): ActiveScene | null => {
    for (const scene of game.scene.getScenes(false)) {
      const { key, active, data } = scene.sys.settings;
      if (key === 'Boot' || !active) continue;
      const round = (data as Partial<SceneData> | undefined)?.round;
      return { key, round: typeof round === 'number' ? round : -1 };
    }
    return null;
  };

  const go = (): void => {
    const next = waiting;
    waiting = null;
    if (next === null) return;
    const now = running();
    if (now !== null && now.key === next.key && now.round === next.data.round) return;
    for (const scene of game.scene.getScenes(false)) {
      const { key, active } = scene.sys.settings;
      if (active && key !== next.key) game.scene.stop(key);
    }
    game.scene.start(next.key, next.data);
  };

  return (view) => {
    const active = waiting !== null ? { key: waiting.key, round: waiting.data.round } : running();
    const next = sceneFor(view, active);
    if (next === null) return;
    if (waiting === null) queueMicrotask(go);
    waiting = next;
  };
}
