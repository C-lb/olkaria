// Who said the case's quotes, with their citations (spec 5.6). The quotes themselves are content (`quotes` in
// content/case.json); the speakers and citations live here, once, for the round narration: Ruto's before round 1,
// Tanui's before round 2. Smith's quote left the lobby and the game shows it nowhere (spec 7), so it has no speaker
// here; the content keeps it for the character sheet's briefing (docs/character-sheet/build.py).
export const SPEAKERS = {
  tanui: 'PS John Tanui (James, 2026; Vimal, 2026)',
  ruto: 'President William Ruto (Semafor, 2026)',
} as const;
