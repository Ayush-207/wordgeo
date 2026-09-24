import { useState, type FormEvent } from "react";
import type { UseGameResult } from "../game/useGame";

const MESSAGES: Record<string, string> = {
  unknown: "not in my vocabulary — try another word",
  duplicate: "already guessed",
  already_solved: "",
};

export default function GuessInput({
  onSubmit,
}: {
  onSubmit: UseGameResult["submitGuess"];
}) {
  const [word, setWord] = useState("");
  const [message, setMessage] = useState("");

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

  return (
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
      {message && <p className="message">{message}</p>}
    </form>
  );
}
