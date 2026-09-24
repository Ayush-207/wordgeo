// Puzzle loading and rank lookup.
//
// puzzle.bin layout (see scripts/build.py):
//   magic "WG01" (4 bytes)
//   vocabSize uint32 LE
//   secretIndex uint32 LE
//   ranks uint16 LE x vocabSize, ranks[vocabIndex] = 1-based rank

const MAGIC = "WG01";

export interface Puzzle {
  vocabSize: number;
  /** 1-based rank per vocab index; index into this array = vocab index */
  ranks: Uint16Array;
}

export function parsePuzzle(buf: ArrayBuffer): Puzzle {
  const bytes = new Uint8Array(buf, 0, 4);
  const magic = String.fromCharCode(...bytes);
  if (magic !== MAGIC) {
    throw new Error(`bad puzzle magic: ${magic}`);
  }
  const view = new DataView(buf);
  const vocabSize = view.getUint32(4, true);
  // header: magic(4) + vocabSize(4) + secretIndex(4), then uint16 ranks
  if (buf.byteLength !== 12 + vocabSize * 2) {
    throw new Error(
      `truncated puzzle: header says ${vocabSize} ranks, buffer holds ${(buf.byteLength - 12) / 2}`,
    );
  }
  const ranks = new Uint16Array(buf, 12, vocabSize);
  return { vocabSize, ranks };
}

/** The harden-later seam: every guess goes through here. */
export interface GuessLookup {
  /** rank (1-based) of the guess, or null if the word is not in the vocabulary */
  lookupGuess(word: string): number | null;
}

export function createLookup(vocab: string[], puzzle: Puzzle): GuessLookup {
  const index = new Map<string, number>();
  vocab.forEach((w, i) => index.set(w, i));
  return {
    lookupGuess(word: string): number | null {
      const i = index.get(word.toLowerCase());
      if (i === undefined) return null;
      return puzzle.ranks[i];
    },
  };
}
