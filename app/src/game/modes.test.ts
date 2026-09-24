import { describe, expect, it } from "vitest";
import { dailyPuzzleId, practicePuzzleId, PUZZLE_COUNT } from "./modes";

describe("dailyPuzzleId", () => {
  it("is 0 on launch day", () => {
    expect(dailyPuzzleId(new Date("2026-10-01T12:00:00Z"))).toBe(0);
  });

  it("increments per UTC day and is stable within a day", () => {
    expect(dailyPuzzleId(new Date("2026-10-02T00:00:01Z"))).toBe(1);
    expect(dailyPuzzleId(new Date("2026-10-02T23:59:59Z"))).toBe(1);
    expect(dailyPuzzleId(new Date("2026-10-03T00:00:01Z"))).toBe(2);
  });

  it("wraps modulo PUZZLE_COUNT", () => {
    // 200 days after launch = id 200 = wraps to 0
    expect(dailyPuzzleId(new Date("2027-04-19T00:00:01Z"))).toBe(0);
  });

  it("is always in range", () => {
    const id = dailyPuzzleId(new Date("2030-06-15T00:00:00Z"));
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThan(PUZZLE_COUNT);
  });
});

describe("practicePuzzleId", () => {
  it("stays in range", () => {
    const seq = () => 0.999;
    const id = practicePuzzleId([], seq);
    expect(id).toBeGreaterThanOrEqual(0);
    expect(id).toBeLessThan(PUZZLE_COUNT);
  });

  it("avoids recent ids when possible", () => {
    // deterministic sequence: first draw 0.5 -> 100, then 0.5 again must move on
    let calls = 0;
    const seq = () => (calls++ === 0 ? 100 / PUZZLE_COUNT : 5 / PUZZLE_COUNT);
    const id = practicePuzzleId([100], seq);
    expect(id).not.toBe(100);
    expect(id).toBe(5);
  });
});
