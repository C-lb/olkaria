// Which scene the projector should be showing for the room's phase and round. On a load or a reconnect the host
// resumes where the room is (spec 6.3): the lobby, the start of a travel segment, the battle at its state, or the
// ending and leaderboard screens. A scene that already fits is left alone.
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
