import { useState } from "react";
import { dailyPuzzleId, practicePuzzleId } from "./game/modes";
import {
  loadActivePractice,
  loadRecentPractice,
  loadSeenHowToPlay,
  saveActivePractice,
  saveRecentPractice,
  saveSeenHowToPlay,
} from "./game/storage";
import { useGame } from "./game/useGame";
import { buildShareText } from "./game/share";
import { trackEvent } from "./analytics";
import GuessList from "./components/GuessList";
import GuessInput from "./components/GuessInput";
import HowToPlay from "./components/HowToPlay";

type Mode = "daily" | "practice";

export default function App() {
  // resume an in-progress practice puzzle after a reload
  const resumed = loadActivePractice();
  const [mode, setMode] = useState<Mode>(resumed !== null ? "practice" : "daily");
  const [practiceId, setPracticeId] = useState<number | null>(resumed);
  // rules open automatically on a first visit, then only via the ? button
  const [showHelp, setShowHelp] = useState(() => !loadSeenHowToPlay());

  function closeHelp() {
    saveSeenHowToPlay();
    setShowHelp(false);
  }

  const puzzleId = mode === "daily" ? dailyPuzzleId() : practiceId;

  function startPractice() {
    const recent = loadRecentPractice();
    const id = practicePuzzleId(recent);
    saveRecentPractice([id, ...recent]);
    saveActivePractice(id);
    setPracticeId(id);
    setMode("practice");
  }

  function goDaily() {
    saveActivePractice(null);
    setMode("daily");
  }

  const game = useGame(puzzleId);

  const submitGuess: typeof game.submitGuess = (word) => {
    const firstGuess = game.state.guesses.length === 0;
    const result = game.submitGuess(word);
    if ((result === "ranked" || result === "solved") && firstGuess) trackEvent(`start-${mode}`);
    if (result === "solved") trackEvent(`solve-${mode}`);
    return result;
  };

  const requestHint: typeof game.requestHint = () => {
    const result = game.requestHint();
    if (result === "hint") trackEvent("hint");
    return result;
  };

  const giveUp = () => {
    game.giveUp();
    trackEvent(`give-up-${mode}`);
  };

  function copyResult() {
    navigator.clipboard?.writeText(buildShareText(puzzleId ?? 0, game.state));
    trackEvent("copy-result");
  }

  return (
    <main className="app">
      <HowToPlay open={showHelp} onClose={closeHelp} />
      <header className="header">
        <button
          className="help-button"
          aria-label="how to play"
          title="how to play"
          onClick={() => setShowHelp(true)}
        >
          ?
        </button>
        <h1>wordgeo</h1>
        <p className="tagline">guess the word — every guess tells you its rank</p>
        <nav className="modes">
          <button
            className={mode === "daily" ? "active" : ""}
            onClick={goDaily}
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
              <h2>
                solved! the word was{" "}
                {game.state.guesses.find((g) => g.rank === 1)?.word}
              </h2>
              <p>
                {game.state.guesses.length} guess
                {game.state.guesses.length === 1 ? "" : "es"}
              </p>
              <button
                className="share"
                onClick={copyResult}
              >
                copy result
              </button>
              {mode === "practice" && (
                <button className="share" onClick={startPractice}>
                  new puzzle
                </button>
              )}
            </section>
          ) : game.state.gaveUp ? (
            <section className="solved gave-up">
              <h2>the word was revealed</h2>
              <p>
                you gave up after {game.state.guesses.length} guess
                {game.state.guesses.length === 1 ? "" : "es"}
              </p>
              <button
                className="share"
                onClick={copyResult}
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
            <GuessInput
              onSubmit={submitGuess}
              onRequestHint={requestHint}
              onGiveUp={giveUp}
            />
          )}
          <GuessList guesses={game.sortedGuesses} />
        </>
      )}
    </main>
  );
}
