import type { GuessEntry } from "../game/storage";

/** how hot a rank is, on a 0..1 scale, for coloring */
function heat(rank: number): number {
  // 1..100 scroll fast (the fun zone), 100+ decay toward 0
  if (rank <= 100) return 1 - (rank - 1) / 120;
  return Math.max(0, 1 - Math.log10(rank) / 4.7);
}

export default function GuessList({ guesses }: { guesses: GuessEntry[] }) {
  if (guesses.length === 0) {
    return <p className="empty">no guesses yet — type a word to start</p>;
  }
  return (
    <ol className="guess-list">
      {guesses.map((g) => {
        const h = heat(g.rank);
        return (
          <li
            key={g.word}
            className="guess"
            style={{ borderLeftColor: `rgba(224, 122, 95, ${0.15 + 0.85 * h})` }}
          >
            <span className="word">{g.word}</span>
            <span className="rank" data-hot={h > 0.66}>
              #{g.rank.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
