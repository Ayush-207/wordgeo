// Per-puzzle game state persisted in localStorage.
//
// Keyed by puzzle id so daily and practice games never collide.

export interface GuessEntry {
  word: string;
  rank: number;
  /** true when this entry was revealed by the hint button, not typed */
  hint?: boolean;
}

export interface GameState {
  guesses: GuessEntry[]; // in guess order
  solved: boolean;
  /** true when the player gave up and the answer was revealed */
  gaveUp?: boolean;
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

/** New games' blank state. */
export function freshState(): GameState {
  return { guesses: [], solved: false, gaveUp: false };
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

/** The practice puzzle in progress, if any — so a reload resumes it. */
const ACTIVE_PRACTICE_KEY = "wordgeo:active-practice";

export function loadActivePractice(): number | null {
  try {
    const raw = localStorage.getItem(ACTIVE_PRACTICE_KEY);
    if (raw === null) return null;
    const id = JSON.parse(raw);
    if (typeof id === "number" && Number.isInteger(id) && id >= 0 && id < 200) {
      return id;
    }
  } catch {
    // fall through
  }
  return null;
}

export function saveActivePractice(id: number | null): void {
  try {
    if (id === null) localStorage.removeItem(ACTIVE_PRACTICE_KEY);
    else localStorage.setItem(ACTIVE_PRACTICE_KEY, String(id));
  } catch {
    // ignore
  }
}
