// tests/router.test.ts
import { it, expect } from 'vitest';
import { sceneFor } from '../host/router';
it('routes a fresh host to the saved phase', () => {
  expect(sceneFor({ phase: 'lobby', round: -1, trips: 0 }, null)).toEqual({ key: 'Lobby', data: { round: -1, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'travel', round: 2, trips: 0 }, null)).toEqual({ key: 'Travel', data: { round: 2, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'reveal', round: 1, trips: 0 }, null)).toEqual({ key: 'Battle', data: { round: 1, resume: true, trip: 0 } });
  expect(sceneFor({ phase: 'ending', round: 3, trips: 0 }, null)!.key).toBe('Ending');
  expect(sceneFor({ phase: 'leaderboard', round: 3, trips: 0 }, null)!.key).toBe('Leaderboard');
});
it('leaves a fitting scene alone', () => {
  expect(sceneFor({ phase: 'travel', round: 1, trips: 0 }, { key: 'Battle', round: 1, trip: 0 })).toBeNull();
  expect(sceneFor({ phase: 'vote', round: 1, trips: 0 }, { key: 'Battle', round: 1, trip: 0 })).toBeNull();
  expect(sceneFor({ phase: 'vote', round: 2, trips: 0 }, { key: 'Battle', round: 1, trip: 0 })!.data.round).toBe(2);
  expect(sceneFor({ phase: 'lobby', round: -1, trips: 0 }, { key: 'Lobby', round: -1, trip: 0 })).toBeNull();
});

// ---- Beyond the brief: the tests above are its code with the trip added ------------------------------------
it('starts the next travel segment from the battle before it, and Travel again only for another round on the same trip', () => {
  expect(sceneFor({ phase: 'travel', round: 2, trips: 0 }, { key: 'Battle', round: 1, trip: 0 })).toEqual({ key: 'Travel', data: { round: 2, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'travel', round: 0, trips: 0 }, { key: 'Lobby', round: -1, trip: 0 })).toEqual({ key: 'Travel', data: { round: 0, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'travel', round: 1, trips: 0 }, { key: 'Travel', round: 1, trip: 0 })).toBeNull();
  expect(sceneFor({ phase: 'travel', round: 1, trips: 0 }, { key: 'Travel', round: 0, trip: 0 })!.data.round).toBe(1);
});
it('resumes the battle for a locked vote or a reveal, never replaying the strike', () => {
  expect(sceneFor({ phase: 'locked', round: 0, trips: 0 }, { key: 'Travel', round: 0, trip: 0 })).toEqual({ key: 'Battle', data: { round: 0, resume: true, trip: 0 } });
  expect(sceneFor({ phase: 'reveal', round: 3, trips: 0 }, { key: 'Lobby', round: -1, trip: 0 })).toEqual({ key: 'Battle', data: { round: 3, resume: true, trip: 0 } });
  expect(sceneFor({ phase: 'reveal', round: 2, trips: 0 }, { key: 'Battle', round: 2, trip: 0 })).toBeNull();
});
it('goes back to the lobby from anywhere after a reset, and leaves the closing screens alone', () => {
  expect(sceneFor({ phase: 'lobby', round: -1, trips: 0 }, { key: 'Leaderboard', round: 3, trip: 0 })).toEqual({ key: 'Lobby', data: { round: -1, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'lobby', round: -1, trips: 0 }, { key: 'Battle', round: 2, trip: 0 })!.key).toBe('Lobby');
  expect(sceneFor({ phase: 'ending', round: 3, trips: 0 }, { key: 'Battle', round: 3, trip: 0 })).toEqual({ key: 'Ending', data: { round: 3, resume: false, trip: 0 } });
  expect(sceneFor({ phase: 'ending', round: 3, trips: 0 }, { key: 'Ending', round: 3, trip: 0 })).toBeNull();
  expect(sceneFor({ phase: 'leaderboard', round: 3, trips: 0 }, { key: 'Ending', round: 3, trip: 0 })!.key).toBe('Leaderboard');
  expect(sceneFor({ phase: 'leaderboard', round: 3, trips: 0 }, { key: 'Leaderboard', round: 3, trip: 0 })).toBeNull();
});
it('starts the road again when the same round sets off on a new trip, and leaves it alone on the same trip', () => {
  expect(sceneFor({ phase: 'travel', round: 1, trips: 3 }, { key: 'Battle', round: 1, trip: 2 })).toEqual({ key: 'Travel', data: { round: 1, resume: false, trip: 3 } });
  expect(sceneFor({ phase: 'travel', round: 1, trips: 2 }, { key: 'Battle', round: 1, trip: 2 })).toBeNull();
  expect(sceneFor({ phase: 'travel', round: 1, trips: 3 }, { key: 'Travel', round: 1, trip: 2 })!.data.trip).toBe(3);
  expect(sceneFor({ phase: 'vote', round: 1, trips: 2 }, { key: 'Battle', round: 1, trip: 2 })).toBeNull();
  expect(sceneFor({ phase: 'ending', round: 3, trips: 9 }, { key: 'Ending', round: 3, trip: 4 })).toBeNull();
});
it('fits the lobby and the leaderboard by key whatever the trip, and a battle only on its own trip', () => {
  // Boot starts the lobby at trip 0, and a host that loads into a room that has set off before still finds it fitting.
  expect(sceneFor({ phase: 'lobby', round: -1, trips: 3 }, { key: 'Lobby', round: -1, trip: 0 })).toBeNull();
  expect(sceneFor({ phase: 'leaderboard', round: 3, trips: 9 }, { key: 'Leaderboard', round: 3, trip: 4 })).toBeNull();
  expect(sceneFor({ phase: 'reveal', round: 1, trips: 3 }, { key: 'Battle', round: 1, trip: 2 })).toEqual({ key: 'Battle', data: { round: 1, resume: true, trip: 3 } });
});
it('reads a view without a usable trip count as trip 0, so a room server from an earlier build cannot restart the road on every view', () => {
  for (const trips of [undefined, null, Number.NaN]) {
    const travel = { phase: 'travel', round: 1, trips } as unknown as Parameters<typeof sceneFor>[0];
    expect(sceneFor(travel, { key: 'Travel', round: 1, trip: 0 })).toBeNull();
    expect(sceneFor(travel, { key: 'Battle', round: 1, trip: 0 })).toBeNull();
    expect(sceneFor(travel, null)).toEqual({ key: 'Travel', data: { round: 1, resume: false, trip: 0 } });
  }
});

// ---- Applying the route: makeRouter with a stand-in for Phaser's scene manager -----------------------------
import type Phaser from 'phaser';
import { makeRouter } from '../host/router';

/** Phaser's scene manager, cut down to what the router touches: each scene's key, started flag and start data. */
function fakeGame(started: string, log: string[]): Phaser.Game {
  const scenes = ['Boot', 'Lobby', 'Travel', 'Battle', 'Ending', 'Leaderboard'].map((key) => ({
    sys: { settings: { key, active: key === started, data: (key === started ? { round: -1, resume: false, trip: 0 } : {}) as object } },
  }));
  const find = (key: string) => scenes.find((s) => s.sys.settings.key === key)!;
  return {
    scene: {
      getScenes: () => scenes,
      stop: (key: string) => { log.push(`stop ${key}`); find(key).sys.settings.active = false; },
      start: (key: string, data: { round: number; resume: boolean; trip: number }) => {
        log.push(`start ${key} round ${data.round} trip ${data.trip}${data.resume ? ' resume' : ''}`);
        Object.assign(find(key).sys.settings, { active: true, data });
      },
    },
  } as unknown as Phaser.Game;
}

it('switches scenes only after the handler whose command brought the view has returned', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  // Offline, a command sent from a scene's key handler comes back as a view before send() returns, and repeats.
  const send = () => { route({ phase: 'travel', round: 0, trips: 1 }); route({ phase: 'travel', round: 0, trips: 1 }); };
  log.push('Space handler starts');
  send();
  log.push('Space handler returns');
  expect(log).toEqual(['Space handler starts', 'Space handler returns']);
  await Promise.resolve();
  expect(log).toEqual(['Space handler starts', 'Space handler returns', 'stop Lobby', 'start Travel round 0 trip 1']);
});

it('lets a newer view replace a waiting switch, and does nothing when that view fits the scene already up', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  route({ phase: 'travel', round: 0, trips: 1 });
  route({ phase: 'lobby', round: -1, trips: 1 });   // reset before the switch ran (a reset keeps the trips)
  await Promise.resolve();
  expect(log).toEqual([]);
  route({ phase: 'travel', round: 0, trips: 1 });
  route({ phase: 'vote', round: 0, trips: 1 });
  await Promise.resolve();
  expect(log).toEqual(['stop Lobby', 'start Battle round 0 trip 1 resume']);
  route({ phase: 'locked', round: 0, trips: 1 });
  await Promise.resolve();
  expect(log).toHaveLength(2);
});

it('stops the battle and starts its road again when a goto sets the round of that battle off on a new trip', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  route({ phase: 'vote', round: 1, trips: 2 });
  await Promise.resolve();
  route({ phase: 'travel', round: 1, trips: 3 });   // Restart round 2 while its vote is open
  await Promise.resolve();
  expect(log).toEqual(['stop Lobby', 'start Battle round 1 trip 2 resume', 'stop Battle', 'start Travel round 1 trip 3']);
});

it('starts the road again when a goto sets the same round off on a new trip', async () => {
  const log: string[] = [];
  const route = makeRouter(fakeGame('Lobby', log));
  route({ phase: 'travel', round: 0, trips: 1 });
  await Promise.resolve();
  route({ phase: 'travel', round: 0, trips: 2 });   // the same round, a new trip: Travel is already up, and still starts over
  await Promise.resolve();
  expect(log).toEqual(['stop Lobby', 'start Travel round 0 trip 1', 'start Travel round 0 trip 2']);
});
