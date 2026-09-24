// Game orchestration hook: load puzzle, submit guesses, persist state.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createLookup, type GuessLookup } from "./puzzle";
import { fetchPuzzle, fetchVocab } from "./fetchPuzzle";
import { loadState, saveState, type GameState } from "./storage";

export interface UseGameResult {
  status: "loading" | "ready" | "error";
  error?: string;
  state: GameState;
  /** ordered best-first view of guesses for rendering */
  sortedGuesses: GameState["guesses"];
  lookup?: GuessLookup;
  submitGuess: (word: string) => "ranked" | "unknown" | "solved" | "duplicate" | "already-solved";
}

export function useGame(puzzleId: number | null): UseGameResult {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [lookup, setLookup] = useState<GuessLookup>();
  const [state, setState] = useState<GameState>({ guesses: [], solved: false });

  useEffect(() => {
    if (puzzleId === null) return;
    let cancelled = false;
    setStatus("loading");
    setState(loadState(puzzleId));
    setError(undefined);
    Promise.all([fetchVocab(), fetchPuzzle(puzzleId)])
      .then(([vocab, puzzle]) => {
        if (cancelled) return;
        setLookup(createLookup(vocab, puzzle));
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [puzzleId]);

  const submitGuess = useCallback(
    (raw: string): "ranked" | "unknown" | "solved" | "duplicate" | "already-solved" => {
      if (puzzleId === null || !lookup) return "already-solved";
      const word = raw.trim().toLowerCase();
      if (!word) return "unknown";
      if (state.solved) return "already-solved";
      if (state.guesses.some((g) => g.word === word)) return "duplicate";
      const rank = lookup.lookupGuess(word);
      if (rank === null) return "unknown";
      const next: GameState = {
        guesses: [...state.guesses, { word, rank }],
        solved: rank === 1,
      };
      setState(next);
      saveState(puzzleId, next);
      return rank === 1 ? "solved" : "ranked";
    },
    [puzzleId, lookup, state],
  );

  const sortedGuesses = useMemo(
    () => [...state.guesses].sort((a, b) => a.rank - b.rank),
    [state.guesses],
  );

  return { status, error, state, sortedGuesses, lookup, submitGuess };
}
