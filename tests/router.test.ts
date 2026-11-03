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
