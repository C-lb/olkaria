// tests/router.test.ts
import { it, expect } from 'vitest';
import { sceneFor } from '../host/router';
it('routes a fresh host to the saved phase', () => {
  expect(sceneFor({ phase: 'lobby', round: -1 }, null)).toEqual({ key: 'Lobby', data: { round: -1, resume: false } });
  expect(sceneFor({ phase: 'travel', round: 2 }, null)).toEqual({ key: 'Travel', data: { round: 2, resume: false } });
  expect(sceneFor({ phase: 'reveal', round: 1 }, null)).toEqual({ key: 'Battle', data: { round: 1, resume: true } });
  expect(sceneFor({ phase: 'ending', round: 3 }, null)!.key).toBe('Ending');
  expect(sceneFor({ phase: 'leaderboard', round: 3 }, null)!.key).toBe('Leaderboard');
});
it('leaves a fitting scene alone', () => {
  expect(sceneFor({ phase: 'travel', round: 1 }, { key: 'Battle', round: 1 })).toBeNull();
  expect(sceneFor({ phase: 'vote', round: 1 }, { key: 'Battle', round: 1 })).toBeNull();
  expect(sceneFor({ phase: 'vote', round: 2 }, { key: 'Battle', round: 1 })!.data.round).toBe(2);
  expect(sceneFor({ phase: 'lobby', round: -1 }, { key: 'Lobby', round: -1 })).toBeNull();
});

// ---- Beyond the brief: the tests above are its code unchanged ----------------------------------------------
it('starts the next travel segment from the battle before it, and Travel again only for another round', () => {
  expect(sceneFor({ phase: 'travel', round: 2 }, { key: 'Battle', round: 1 })).toEqual({ key: 'Travel', data: { round: 2, resume: false } });
  expect(sceneFor({ phase: 'travel', round: 0 }, { key: 'Lobby', round: -1 })).toEqual({ key: 'Travel', data: { round: 0, resume: false } });
  expect(sceneFor({ phase: 'travel', round: 1 }, { key: 'Travel', round: 1 })).toBeNull();
  expect(sceneFor({ phase: 'travel', round: 1 }, { key: 'Travel', round: 0 })!.data.round).toBe(1);
});
it('resumes the battle for a locked vote or a reveal, never replaying the strike', () => {
  expect(sceneFor({ phase: 'locked', round: 0 }, { key: 'Travel', round: 0 })).toEqual({ key: 'Battle', data: { round: 0, resume: true } });
  expect(sceneFor({ phase: 'reveal', round: 3 }, { key: 'Lobby', round: -1 })).toEqual({ key: 'Battle', data: { round: 3, resume: true } });
  expect(sceneFor({ phase: 'reveal', round: 2 }, { key: 'Battle', round: 2 })).toBeNull();
});
it('goes back to the lobby from anywhere after a reset, and leaves the closing screens alone', () => {
  expect(sceneFor({ phase: 'lobby', round: -1 }, { key: 'Leaderboard', round: 3 })).toEqual({ key: 'Lobby', data: { round: -1, resume: false } });
  expect(sceneFor({ phase: 'lobby', round: -1 }, { key: 'Battle', round: 2 })!.key).toBe('Lobby');
  expect(sceneFor({ phase: 'ending', round: 3 }, { key: 'Battle', round: 3 })).toEqual({ key: 'Ending', data: { round: 3, resume: false } });
  expect(sceneFor({ phase: 'ending', round: 3 }, { key: 'Ending', round: 3 })).toBeNull();
  expect(sceneFor({ phase: 'leaderboard', round: 3 }, { key: 'Ending', round: 3 })!.key).toBe('Leaderboard');
  expect(sceneFor({ phase: 'leaderboard', round: 3 }, { key: 'Leaderboard', round: 3 })).toBeNull();
});

// ---- Applying the route: makeRouter with a stand-in for Phaser's scene manager -----------------------------
import type Phaser from 'phaser';
import { makeRouter } from '../host/router';

/** Phaser's scene manager, cut down to what the router touches: each scene's key, started flag and start data. */
function fakeGame(started: string, log: string[]): Phaser.Game {
  const scenes = ['Boot', 'Lobby', 'Travel', 'Battle', 'Ending', 'Leaderboard'].map((key) => ({
    sys: { settings: { key, active: key === started, data: (key === started ? { round: -1, resume: false } : {}) as object } },
  }));
  const find = (key: string) => scenes.find((s) => s.sys.settings.key === key)!;
  return {
    scene: {
      getScenes: () => scenes,
      stop: (key: string) => { log.push(`stop ${key}`); find(key).sys.settings.active = false; },
      start: (key: string, data: { round: number; resume: boolean }) => {
        log.push(`start ${key} round ${data.round}${data.resume ? ' resume' : ''}`);
        Object.assign(find(key).sys.settings, { active: true, data });
      },
    },
  } as unknown as Phaser.Game;
}

it('switches scenes only after the handler whose command brought the view has returned', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  // Offline, a command sent from a scene's key handler comes back as a view before send() returns, and repeats.
  const send = () => { route({ phase: 'travel', round: 0 }); route({ phase: 'travel', round: 0 }); };
  log.push('Space handler starts');
  send();
  log.push('Space handler returns');
  expect(log).toEqual(['Space handler starts', 'Space handler returns']);
  await Promise.resolve();
  expect(log).toEqual(['Space handler starts', 'Space handler returns', 'stop Lobby', 'start Travel round 0']);
});

it('lets a newer view replace a waiting switch, and does nothing when that view fits the scene already up', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  route({ phase: 'travel', round: 0 });
  route({ phase: 'lobby', round: -1 });   // reset before the switch ran
  await Promise.resolve();
  expect(log).toEqual([]);
  route({ phase: 'travel', round: 0 });
  route({ phase: 'vote', round: 0 });
  await Promise.resolve();
  expect(log).toEqual(['stop Lobby', 'start Battle round 0 resume']);
  route({ phase: 'locked', round: 0 });
  await Promise.resolve();
  expect(log).toHaveLength(2);
});
