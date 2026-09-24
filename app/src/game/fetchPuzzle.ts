// Fetch vocab (once, cached by the browser) and a puzzle bin.

import { parsePuzzle, type Puzzle } from "./puzzle";

let vocabPromise: Promise<string[]> | null = null;

export function fetchVocab(): Promise<string[]> {
  if (!vocabPromise) {
    vocabPromise = fetch("data/vocab.json")
      .then((r) => {
        if (!r.ok) throw new Error(`vocab fetch failed: ${r.status}`);
        return r.json() as Promise<string[]>;
      })
      .catch((e) => {
        vocabPromise = null; // allow retry on failure
        throw e;
      });
  }
  return vocabPromise;
}

export async function fetchPuzzle(id: number): Promise<Puzzle> {
  const r = await fetch(`data/puzzles/puzzle-${String(id).padStart(3, "0")}.bin`);
  if (!r.ok) throw new Error(`puzzle fetch failed: ${r.status}`);
  return parsePuzzle(await r.arrayBuffer());
}
