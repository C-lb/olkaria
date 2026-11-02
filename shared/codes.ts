// Room codes: four letters from A to Z without I and O, which read as 1 and 0 across a room.
// Plain TypeScript with no DOM or Node globals, because shared/ is type-checked by both the DOM
// program and the worker program.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Four letters drawn with `rng`, a number in [0, 1). A draw of exactly 1 lands on the last letter instead of past the end. */
export function makeRoomCode(rng: () => number): string {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.min(ALPHABET.length - 1, Math.floor(rng() * ALPHABET.length))];
  return code;
}

export function isValidCode(s: string): boolean {
  return /^[A-HJ-NP-Z]{4}$/.test(s);
}
