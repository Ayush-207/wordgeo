import { useEffect, useRef } from "react";
import GuessList from "./GuessList";

// Real ranks from the shipped ensemble, for a word that is not a secret.
const EXAMPLE = [
  { word: "cheese", rank: 17 },
  { word: "kitchen", rank: 68 },
  { word: "italy", rank: 196 },
  { word: "car", rank: 1823 },
];

/** Modal rules box. Native <dialog>: focus trap and Escape-to-close for free. */
export default function HowToPlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="how-to-play"
      aria-labelledby="how-to-play-title"
      onClose={onClose}
      // a click on the dialog element itself (not its content) is a backdrop click
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="how-to-play-body">
        <h2 id="how-to-play-title">how to play</h2>
        <p>Find the secret word. You have unlimited guesses.</p>
        <p>
          Every guess gets a <strong>rank</strong>. The secret word is <strong>#1</strong>, and
          the lower the number, the closer your guess is in meaning.
        </p>
        <p>
          Closeness comes from AI models trained on lots of text: words used in similar
          contexts rank close. It's about meaning, not spelling.
        </p>
        <p className="how-to-play-example">If the word were <strong>pizza</strong>:</p>
        <GuessList guesses={EXAMPLE} />
        <p>
          Stuck? <strong>hint</strong> reveals a word closer than your best guess, and{" "}
          <strong>give up</strong> reveals the answer.
        </p>
        <p>
          <strong>daily</strong>: a new word every day, the same for everyone.{" "}
          <strong>practice</strong>: random puzzles, as many as you like.
        </p>
        <button className="share" onClick={onClose} autoFocus>
          got it
        </button>
      </div>
    </dialog>
  );
}
