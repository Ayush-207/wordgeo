// Share-text generation: wordgeo #<id> — solved in N guesses.

import type { GameState } from "./storage";
import type { GuessEntry } from "./storage";

export function buildShareText(puzzleId: number, state: GameState): string {
  if (!state.solved) {
    return `wordgeo #${puzzleId} — gave up after ${state.guesses.length} guesses`;
  }
  const best = state.guesses
    .slice(0, -1)
    .reduce<GuessEntry | null>((acc, g) => (acc === null || g.rank < acc.rank ? g : acc), null);
  const bestPart = best ? ` · best: #${best.rank} ${best.word}` : "";
  return `wordgeo #${puzzleId} — solved in ${state.guesses.length} guesses${bestPart}`;
}
