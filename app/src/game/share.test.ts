import { describe, expect, it } from "vitest";
import { buildShareText } from "./share";
import type { GameState } from "./storage";

describe("buildShareText", () => {
  it("reports solved count and best non-winning guess", () => {
    const state: GameState = {
      guesses: [
        { word: "ocean", rank: 2841 },
        { word: "river", rank: 188 },
        { word: "creek", rank: 1 },
      ],
      solved: true,
    };
    expect(buildShareText(47, state)).toBe(
      "wordgeo #47 — solved in 3 guesses · best: #188 river",
    );
  });

  it("handles a first-guess win", () => {
    const state: GameState = { guesses: [{ word: "creek", rank: 1 }], solved: true };
    expect(buildShareText(3, state)).toBe("wordgeo #3 — solved in 1 guesses");
  });

  it("handles giving up mid-game (not revealed)", () => {
    const state: GameState = { guesses: [{ word: "ocean", rank: 9000 }], solved: false };
    expect(buildShareText(12, state)).toBe("wordgeo #12 — gave up after 1 guesses");
  });

  it("reveals the word when the player gave up", () => {
    const state: GameState = {
      guesses: [
        { word: "ocean", rank: 9000 },
        { word: "creek", rank: 1, hint: true },
      ],
      solved: false,
      gaveUp: true,
    };
    expect(buildShareText(12, state)).toBe(
      "wordgeo #12 — gave up after 2 guesses — the word was creek · 1 hint",
    );
  });

  it("counts hints in solved games", () => {
    const state: GameState = {
      guesses: [
        { word: "river", rank: 188, hint: true },
        { word: "creek", rank: 1 },
      ],
      solved: true,
    };
    expect(buildShareText(5, state)).toBe(
      "wordgeo #5 — solved in 2 guesses · best: #188 river · 1 hint",
    );
  });
});
