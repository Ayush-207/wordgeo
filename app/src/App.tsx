import { useState } from "react";
import { dailyPuzzleId, practicePuzzleId } from "./game/modes";
import { loadRecentPractice, saveRecentPractice } from "./game/storage";
import { useGame } from "./game/useGame";
import { buildShareText } from "./game/share";
import GuessList from "./components/GuessList";
import GuessInput from "./components/GuessInput";

type Mode = "daily" | "practice";

export default function App() {
  const [mode, setMode] = useState<Mode>("daily");
  const [practiceId, setPracticeId] = useState<number | null>(null);

  const puzzleId =
    mode === "daily" ? dailyPuzzleId() : practiceId;

  function startPractice() {
    const recent = loadRecentPractice();
    const id = practicePuzzleId(recent);
    saveRecentPractice([id, ...recent]);
    setPracticeId(id);
    setMode("practice");
  }

  const game = useGame(puzzleId);

  return (
    <main className="app">
      <header className="header">
        <h1>wordgeo</h1>
        <p className="tagline">guess the word — every guess tells you its rank</p>
        <nav className="modes">
          <button
            className={mode === "daily" ? "active" : ""}
            onClick={() => setMode("daily")}
          >
            daily
          </button>
          <button
            className={mode === "practice" ? "active" : ""}
            onClick={startPractice}
          >
            practice
          </button>
        </nav>
      </header>

      {game.status === "loading" && <p className="status">loading…</p>}
      {game.status === "error" && (
        <p className="status error">failed to load puzzle: {game.error}</p>
      )}

      {game.status === "ready" && (
        <>
          {game.state.solved ? (
            <section className="solved">
              <h2>solved! the word was #{1}</h2>
              <p>
                {game.state.guesses.length} guess
                {game.state.guesses.length === 1 ? "" : "es"}
              </p>
              <button
                className="share"
                onClick={() => navigator.clipboard?.writeText(buildShareText(puzzleId ?? 0, game.state))}
              >
                copy result
              </button>
              {mode === "practice" && (
                <button className="share" onClick={startPractice}>
                  new puzzle
                </button>
              )}
            </section>
          ) : (
            <GuessInput onSubmit={game.submitGuess} />
          )}
          <GuessList guesses={game.sortedGuesses} />
        </>
      )}
    </main>
  );
}
