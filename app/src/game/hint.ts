// Hint selection: reveal a word ranked 3/4 of the current best guess.
//
// Pure math + table walking; no React, no I/O — unit-testable.

import type { Puzzle } from "./puzzle";
import type { GuessEntry } from "./storage";

/** Start-of-game nudge: reveal a toehold word when nothing is guessed yet. */
const FIRST_HINT_RANK = 4000;

/** Never reveal at or below this rank — rank 1 is the answer itself. */
const MIN_HINT_RANK = 2;

/** Below this best rank, a hint is noise — you're one word off at most. */
const NO_HINT_NEEDED_RANK = 2;

export type HintResult =
  | { kind: "hint"; word: string; rank: number }
  | { kind: "no-need" }
  | { kind: "unavailable" };

/**
 * Pick the hint word for the current state.
 *
 * best n  ->  reveal the unguessed word at rank max(2, floor(3n/4)),
 *             walking upward past already-guessed words.
 * no guesses -> word at rank 4000.
 * best <= 3  -> "you're really close", no reveal.
 */
export function pickHint(puzzle: Puzzle, vocab: string[], guesses: GuessEntry[]): HintResult {
  const guessed = new Set(guesses.map((g) => g.word));
  // rank -> vocab index. Built lazily; caller passes the puzzle ranks.
  // The word at rank r is the vocab index i where ranks[i] === r.
  const { ranks, vocabSize } = puzzle;

  const best = guesses.reduce<number | null>(
    (acc, g) => (acc === null || g.rank < acc ? g.rank : acc),
    null,
  );

  if (best !== null && best <= NO_HINT_NEEDED_RANK) {
    return { kind: "no-need" };
  }

  let targetRank: number;
  if (best === null) {
    // start-of-game toehold, clamped into the puzzle's actual size
    targetRank = Math.min(FIRST_HINT_RANK, vocabSize);
  } else {
    targetRank = Math.max(MIN_HINT_RANK, Math.floor((best * 3) / 4));
  }

  // walk upward from targetRank until an unguessed, in-vocab word
  for (let r = targetRank; r <= vocabSize; r++) {
    const word = wordAtRank(ranks, vocab, r);
    if (word !== null && !guessed.has(word)) {
      return { kind: "hint", word, rank: r };
    }
  }
  return { kind: "unavailable" };
}

/** Inverse lookup: which vocab word holds rank r. Linear scan of the
 * rank array — 50k comparisons is sub-millisecond, fine per hint click. */
function wordAtRank(ranks: Uint16Array, vocab: string[], r: number): string | null {
  for (let i = 0; i < ranks.length; i++) {
    if (ranks[i] === r) return vocab[i];
  }
  return null;
}

export { wordAtRank as _wordAtRankForTests };
