import { useState, type FormEvent } from "react";
import type { UseGameResult } from "../game/useGame";

const MESSAGES: Record<string, string> = {
  unknown: "not in my vocabulary — try another word",
  duplicate: "already guessed",
  already_solved: "",
};

export default function GuessInput({
  onSubmit,
  onRequestHint,
  onGiveUp,
}: {
  onSubmit: UseGameResult["submitGuess"];
  onRequestHint: UseGameResult["requestHint"];
  onGiveUp: UseGameResult["giveUp"];
}) {
  const [word, setWord] = useState("");
  const [message, setMessage] = useState("");
  const [confirmGiveUp, setConfirmGiveUp] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const result = onSubmit(word);
    if (result === "ranked" || result === "solved") {
      setWord("");
      setMessage("");
    } else {
      setMessage(MESSAGES[result] ?? "");
    }
  }

  function handleHint() {
    const result = onRequestHint();
    setMessage(
      result === "no-need"
        ? "you're really close — no hint needed"
        : "",
    );
  }

  return (
    <div className="guess-area">
      <form className="guess-form" onSubmit={handleSubmit}>
        <input
          autoFocus
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder="your guess"
          autoComplete="off"
          spellCheck={false}
          maxLength={30}
        />
        <button type="submit" disabled={!word.trim()}>
          guess
        </button>
        <button type="button" className="secondary" onClick={handleHint}>
          hint
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            if (confirmGiveUp) onGiveUp();
            else setConfirmGiveUp(true);
          }}
        >
          {confirmGiveUp ? "reveal answer?" : "give up"}
        </button>
      </form>
      {message && <p className="message">{message}</p>}
    </div>
  );
}
