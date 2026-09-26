// Game orchestration hook: load puzzle, submit guesses, persist state.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createLookup, type GuessLookup, type Puzzle } from "./puzzle";
import { fetchPuzzle, fetchVocab } from "./fetchPuzzle";
import { freshState, loadState, saveState, type GameState } from "./storage";
import { pickHint } from "./hint";

export interface UseGameResult {
  status: "loading" | "ready" | "error";
  error?: string;
  state: GameState;
  /** ordered best-first view of guesses for rendering */
  sortedGuesses: GameState["guesses"];
  lookup?: GuessLookup;
  puzzle?: Puzzle;
  vocab?: string[];
  submitGuess: (word: string) => "ranked" | "unknown" | "solved" | "duplicate" | "already-solved";
  requestHint: () => "hint" | "no-need" | "unavailable";
  giveUp: () => void;
}

export function useGame(puzzleId: number | null): UseGameResult {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>();
  const [lookup, setLookup] = useState<GuessLookup>();
  const [puzzle, setPuzzle] = useState<Puzzle>();
  const [vocab, setVocab] = useState<string[]>();
  const [state, setState] = useState<GameState>(freshState);

  useEffect(() => {
    if (puzzleId === null) return;
    let cancelled = false;
    setStatus("loading");
    setState(loadState(puzzleId));
    setError(undefined);
    Promise.all([fetchVocab(), fetchPuzzle(puzzleId)])
      .then(([v, p]) => {
        if (cancelled) return;
        setVocab(v);
        setPuzzle(p);
        setLookup(createLookup(v, p));
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

  const finished = state.solved || state.gaveUp === true;

  const commit = useCallback(
    (next: GameState) => {
      setState(next);
      if (puzzleId !== null) saveState(puzzleId, next);
    },
    [puzzleId],
  );

  const submitGuess = useCallback(
    (raw: string): "ranked" | "unknown" | "solved" | "duplicate" | "already-solved" => {
      if (puzzleId === null || !lookup) return "already-solved";
      const word = raw.trim().toLowerCase();
      if (!word) return "unknown";
      if (finished) return "already-solved";
      if (state.guesses.some((g) => g.word === word)) return "duplicate";
      const rank = lookup.lookupGuess(word);
      if (rank === null) return "unknown";
      commit({
        guesses: [...state.guesses, { word, rank }],
        solved: rank === 1,
        gaveUp: state.gaveUp,
      });
      return rank === 1 ? "solved" : "ranked";
    },
    [puzzleId, lookup, state, finished, commit],
  );

  const requestHint = useCallback((): "hint" | "no-need" | "unavailable" => {
    if (puzzleId === null || !puzzle || !vocab || finished) return "unavailable";
    const result = pickHint(puzzle, vocab, state.guesses);
    if (result.kind !== "hint") return result.kind;
    commit({
      guesses: [...state.guesses, { word: result.word, rank: result.rank, hint: true }],
      solved: false,
      gaveUp: state.gaveUp,
    });
    return "hint";
  }, [puzzleId, puzzle, vocab, state, finished, commit]);

  const giveUp = useCallback(() => {
    if (puzzleId === null || finished) return;
    if (!puzzle || !vocab) return;
    // reveal the answer (rank 1) as a hint-flagged entry
    const answerEntry = { word: vocab[answerIndexOf(puzzle)], rank: 1, hint: true };
    commit({
      guesses: [...state.guesses, answerEntry],
      solved: false,
      gaveUp: true,
    });
  }, [puzzleId, puzzle, vocab, state, finished, commit]);

  const sortedGuesses = useMemo(
    () => [...state.guesses].sort((a, b) => a.rank - b.rank),
    [state.guesses],
  );

  return {
    status,
    error,
    state,
    sortedGuesses,
    lookup,
    puzzle,
    vocab,
    submitGuess,
    requestHint,
    giveUp,
  };
}

/** Index of the rank-1 word = the secret. Linear scan, once per give-up. */
function answerIndexOf(puzzle: Puzzle): number {
  for (let i = 0; i < puzzle.ranks.length; i++) {
    if (puzzle.ranks[i] === 1) return i;
  }
  return 0; // unreachable: validated at build time
}
