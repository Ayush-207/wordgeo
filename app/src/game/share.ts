// Share-text generation: wordgeo #<id> — solved in N guesses.

import type { GameState, GuessEntry } from "./storage";

export function buildShareText(puzzleId: number, state: GameState): string {
  const hintCount = state.guesses.filter((g) => g.hint).length;
  const hintsPart = hintCount > 0 ? ` · ${hintCount} hint${hintCount === 1 ? "" : "s"}` : "";

  if (state.gaveUp) {
    const answer = state.guesses.find((g) => g.rank === 1);
    const wordPart = answer ? ` — the word was ${answer.word}` : "";
    return `wordgeo #${puzzleId} — gave up after ${state.guesses.length} guesses${wordPart}${hintsPart}`;
  }
  if (!state.solved) {
    return `wordgeo #${puzzleId} — gave up after ${state.guesses.length} guesses${hintsPart}`;
  }
  const best = state.guesses
    .slice(0, -1)
    .reduce<GuessEntry | null>((acc, g) => (acc === null || g.rank < acc.rank ? g : acc), null);
  const bestPart = best ? ` · best: #${best.rank} ${best.word}` : "";
  return `wordgeo #${puzzleId} — solved in ${state.guesses.length} guesses${bestPart}${hintsPart}`;
}
