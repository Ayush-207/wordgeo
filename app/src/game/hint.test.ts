import { describe, expect, it } from "vitest";
import { pickHint } from "./hint";
import type { Puzzle } from "./puzzle";
import type { GuessEntry } from "./storage";

/** ranks[i] = rank of vocab word i. Vocab: [alpha, beta, gamma, delta, eps]. */
function puzzleFromRanks(ranks: number[]): Puzzle {
  return { vocabSize: ranks.length, ranks: Uint16Array.from(ranks) };
}

const VOCAB = ["alpha", "beta", "gamma", "delta", "eps"];

describe("pickHint", () => {
  it("with no guesses, reveals the fixed toehold rank", () => {
    // full permutation of ranks 1..5 across the 5-word vocab:
    // alpha=4000? no — 5-word puzzles can't hold rank 4000, so this test
    // uses a realistic small permutation and asserts the clamp behavior
    // in the next test instead. Real puzzles are 50k; here the toehold
    // clamps to 5 and eps holds it.
    const p = puzzleFromRanks([4, 1, 5, 2, 3]);
    expect(pickHint(p, VOCAB, [])).toEqual({ kind: "hint", word: "gamma", rank: 5 });
  });

  it("clamps the toehold into a puzzle smaller than the toehold rank", () => {
    // vocabSize=5, toehold 4000 clamps to 5; eps holds rank 5
    const tiny = puzzleFromRanks([10, 1, 500, 2, 5]);
    expect(pickHint(tiny, VOCAB, [])).toEqual({ kind: "hint", word: "eps", rank: 5 });
  });

  it("reveals the 3/4 rank of the best guess", () => {
    // beta best at rank 4 -> floor(4*3/4)=3 -> delta holds rank 3
    const p = puzzleFromRanks([10, 4, 500, 3, 1]);
    const guesses: GuessEntry[] = [{ word: "beta", rank: 4 }];
    expect(pickHint(p, VOCAB, guesses)).toEqual({ kind: "hint", word: "delta", rank: 3 });
  });

  it("never goes below rank 2 when 3/4 of a small best", () => {
    // best = 3 -> floor(3*3/4)=2 -> delta holds rank 2
    const p = puzzleFromRanks([10, 3, 500, 2, 1]);
    const guesses: GuessEntry[] = [{ word: "beta", rank: 3 }];
    expect(pickHint(p, VOCAB, guesses)).toEqual({ kind: "hint", word: "delta", rank: 2 });
  });

  it("says no-need when the best guess is at rank <= 2", () => {
    const p = puzzleFromRanks([10, 2, 500, 9, 1]);
    const guesses: GuessEntry[] = [{ word: "beta", rank: 2 }];
    expect(pickHint(p, VOCAB, guesses)).toEqual({ kind: "no-need" });
  });

  it("walks past words that are already guessed", () => {
    // 10-word vocab, full permutation 1..10:
    // [w0..w9] ranks: w0=10 w1=4 w2=9 w3=3 w4=1 w5=8 w6=7 w7=5 w8=6 w9=2
    const V = Array.from({ length: 10 }, (_, i) => `w${i}`);
    const p = puzzleFromRanks([10, 4, 9, 3, 1, 8, 7, 5, 6, 2]);

    // best = w1 at rank 4 -> target 3 -> w3 (unguessed) -> direct hit
    const g1: GuessEntry[] = [{ word: "w1", rank: 4 }];
    expect(pickHint(p, V, g1)).toEqual({ kind: "hint", word: "w3", rank: 3 });

    // walk-past: best = w0 at 10 -> target 7 (w6). If w6 already guessed,
    // the best IS 7 now (w6 outranks w0), so target = floor(21/4) = 5 -> w7.
    // Rank map for this fixture:
    //   rank:  3  4  5  6  7  8  9  10
    //   word: w3 w1 w7 w8 w6 w5 w2 w0
    const g2: GuessEntry[] = [
      { word: "w0", rank: 10 },
      { word: "w6", rank: 7 },
    ];
    // best=7 -> target 5 -> w7 free
    expect(pickHint(p, V, g2)).toEqual({ kind: "hint", word: "w7", rank: 5 });

    // three entries: best=5 (w7) -> target 3 -> w3 free
    // (revealed hints join the guess list and become the new best —
    //  consecutive hints telescope: 10 -> 7 -> 5 -> 3)
    const g3: GuessEntry[] = [
      { word: "w0", rank: 10 },
      { word: "w6", rank: 7 },
      { word: "w7", rank: 5 },
    ];
    expect(pickHint(p, V, g3)).toEqual({ kind: "hint", word: "w3", rank: 3 });
  });
});
