// The vote clock as minutes and seconds (spec 2.4 of the vote-window design), one formatter for the projector's status
// line and how-to ring (host/strikers.ts, host/howto.ts) and the phone's countdown (player/render.ts).

/** Whole seconds as "m:ss": 120 is "2:00", 9 is "0:09", 0 and below "0:00", 600 "10:00". */
export function clockText(seconds: number): string {
  const left = Math.max(0, seconds);
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}
