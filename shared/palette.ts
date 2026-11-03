// The world's colours, kept in shared/ so the host's canvas textures and the phone's class figures paint the same hex
// values. Plain TypeScript with no DOM or Node globals, because shared/ is type-checked by both the DOM program and the
// worker program.

/** The world's palette: cold stone, bone white, and torch amber for eyes, flames and the odd lit window (spec 7). */
export const PALETTE = {
  night: '#15141c',
  outline: '#0c0b10',
  stoneDeep: '#1f2230',
  stoneDark: '#2a2e3a',
  stone: '#3d4352',
  stoneLight: '#59606f',
  stonePale: '#7d8494',
  bone: '#ddd7c7',
  boneDim: '#b0aa9a',
  steel: '#a4abb8',
  steelDark: '#6f7686',
  clothDark: '#2e2b38',
  cloth: '#4a4556',
  leather: '#6b4f3a',
  wood: '#7a5a3a',
  skin: '#b8957a',
  ember: '#a8682c',
  amber: '#eda34f',
  white: '#ffffff',   // the digits font, so a tint gives the exact colour
} as const;
