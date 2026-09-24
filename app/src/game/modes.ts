// Puzzle selection: daily (derived from date) and practice (random).

export const PUZZLE_COUNT = 200;
export const LAUNCH_DATE = "2026-10-01"; // first daily puzzle day, UTC

const MS_PER_DAY = 86_400_000;

export function daysSinceLaunch(now: Date = new Date()): number {
  const launch = Date.parse(`${LAUNCH_DATE}T00:00:00Z`);
  return Math.floor((now.getTime() - launch) / MS_PER_DAY);
}

/** Daily puzzle id — same for every player on the same UTC day. */
export function dailyPuzzleId(now: Date = new Date()): number {
  const days = daysSinceLaunch(now);
  return ((days % PUZZLE_COUNT) + PUZZLE_COUNT) % PUZZLE_COUNT;
}

/** Practice puzzle id — random, optionally avoiding recently played ids. */
export function practicePuzzleId(
  recent: number[] = [],
  random: () => number = Math.random,
): number {
  if (recent.length >= PUZZLE_COUNT) return Math.floor(random() * PUZZLE_COUNT);
  const avoid = new Set(recent);
  let id = Math.floor(random() * PUZZLE_COUNT);
  let guard = 0;
  while (avoid.has(id) && guard < PUZZLE_COUNT * 4) {
    id = Math.floor(random() * PUZZLE_COUNT);
    guard++;
  }
  return id;
}
