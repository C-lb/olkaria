// Which scene the projector should be showing for the room's phase, round and trip, and the switch to it. On a load or
// a reconnect the host resumes where the room is (spec 6.3): the lobby, the start of a travel segment, the battle at
// its state, or the ending and leaderboard screens. A scene that already fits is left alone. A Travel or a Battle fits
// only when its round and its trip are the view's as well: a goto to the round already on screen is a new trip, so its
// road starts again instead of being taken for the gate's own hand-over from Travel to Battle.
import type Phaser from 'phaser';
import type { Phase } from '../shared/types';

/** What every scene is started with: its round and trip, and whether it picks up a phase already under way. */
export interface SceneData { round: number; resume: boolean; trip: number }

/** The scene running now, by key, and the round and trip it was started for (round -1 for the lobby). */
export interface ActiveScene { key: string; round: number; trip: number }

/** What the router reads of a view: the room's phase and round, and how many roads it has set off on. */
type RoutedView = { phase: Phase; round: number; trips: number };

/**
 * The view's trip count, or 0 when it carries none that is a finite number, as a room server from an earlier build
 * sends: 0 is what the lobby starts on, so such a room routes as one trip instead of restarting a road on every view.
 */
export const tripOf = (view: { readonly trips?: unknown }): number =>
  (typeof view.trips === 'number' && Number.isFinite(view.trips) ? view.trips : 0);

/**
 * The scene to start for `view`, or null when `active` already fits it. Travel's gate starts the Battle while the room
 * is still in `travel`, so a Battle for that round and trip fits `travel` too. `trips` counts the roads the room has
 * set off on: a Travel or a Battle fits only when key, round and trip all match, so the same round on a new trip starts
 * again, while the lobby, the ending and the leaderboard fit by key alone. Battle started from here always resumes: the
 * strike of a saved `reveal` is never replayed, the debrief shows directly.
 */
export function sceneFor(
  view: RoutedView,
  active: ActiveScene | null,
): { key: string; data: SceneData } | null {
  const { phase, round } = view;
  const trips = tripOf(view);
  const at = (key: string): boolean =>
    active !== null && active.key === key && active.round === round && active.trip === trips;
  const start = (key: string, resume = false) => ({ key, data: { round, resume, trip: trips } });
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
 * the active scene, so the views that keep arriving do not ask for it again, and a newer view can still replace it.
 * When the microtask runs, `sceneFor` is asked once more about the scene that is up by then, so a switch that a newer
 * view has made unnecessary (a reset straight after a start, say) does nothing.
 *
 * Scenes are told apart by `settings.active`, which Phaser sets from a scene's start until it stops (this game never
 * pauses or sleeps a scene), and their round and trip are read from the data they were started with, so a scene that
 * starts another (Travel's gate starting Battle) must pass `{ round, resume, trip }` as well. Starting a scene that is
 * running shuts it down and starts it again, which is how a new trip puts a road back at its start. Boot is never the
 * active scene.
 */
export function makeRouter(game: Phaser.Game): (view: RoutedView) => void {
  /** The switch to make, with the view it was made for. */
  let waiting: { key: string; data: SceneData; view: RoutedView } | null = null;

  const running = (): ActiveScene | null => {
    for (const scene of game.scene.getScenes(false)) {
      const { key, active, data } = scene.sys.settings;
      if (key === 'Boot' || !active) continue;
      const started = data as Partial<SceneData> | undefined;
      return {
        key,
        round: typeof started?.round === 'number' ? started.round : -1,
        trip: typeof started?.trip === 'number' ? started.trip : 0,
      };
    }
    return null;
  };

  const go = (): void => {
    const next = waiting;
    waiting = null;
    if (next === null) return;
    // Asked again about the scene up now, and what the answer names is what starts, so the fit rule lives in sceneFor.
    const target = sceneFor(next.view, running());
    if (target === null) return;
    for (const scene of game.scene.getScenes(false)) {
      const { key, active } = scene.sys.settings;
      if (active && key !== target.key) game.scene.stop(key);
    }
    game.scene.start(target.key, target.data);
  };

  return (view) => {
    const active: ActiveScene | null =
      waiting !== null ? { key: waiting.key, round: waiting.data.round, trip: waiting.data.trip } : running();
    const next = sceneFor(view, active);
    if (next === null) return;
    if (waiting === null) queueMicrotask(go);
    waiting = { ...next, view };
  };
}
