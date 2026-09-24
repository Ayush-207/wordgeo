// Per-puzzle game state persisted in localStorage.
//
// Keyed by puzzle id so daily and practice games never collide.

export interface GuessEntry {
  word: string;
  rank: number;
}

export interface GameState {
  guesses: GuessEntry[]; // in guess order
  solved: boolean;
}

const KEY_PREFIX = "wordgeo:state:";

function key(id: number): string {
  return `${KEY_PREFIX}${id}`;
}

export function loadState(id: number): GameState {
  try {
    const raw = localStorage.getItem(key(id));
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (Array.isArray(parsed.guesses) && typeof parsed.solved === "boolean") {
        return parsed;
      }
    }
  } catch {
    // corrupt or unavailable storage -> fresh game
  }
  return { guesses: [], solved: false };
}

export function saveState(id: number, state: GameState): void {
  try {
    localStorage.setItem(key(id), JSON.stringify(state));
  } catch {
    // storage full or unavailable -> game continues without persistence
  }
}

/** Recent practice ids for the non-repeating picker. */
const RECENT_KEY = "wordgeo:recent-practice";

export function loadRecentPractice(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === "number")) {
        return parsed as number[];
      }
    }
  } catch {
    // fall through
  }
  return [];
}

export function saveRecentPractice(ids: number[]): void {
  try {
    // keep the last 30, most recent first
    localStorage.setItem(RECENT_KEY, JSON.stringify(ids.slice(0, 30)));
  } catch {
    // ignore
  }
}
