import { describe, expect, it } from "vitest";
import { createLookup, parsePuzzle } from "./puzzle";

function makePuzzleBuf(vocabSize: number, ranks: number[], secretIndex = 0): ArrayBuffer {
  const buf = new ArrayBuffer(12 + vocabSize * 2);
  const bytes = new Uint8Array(buf, 0, 4);
  "WG01".split("").forEach((c, i) => (bytes[i] = c.charCodeAt(0)));
  const view = new DataView(buf);
  view.setUint32(4, vocabSize, true);
  view.setUint32(8, secretIndex, true);
  const u16 = new Uint16Array(buf, 12, vocabSize);
  ranks.forEach((r, i) => (u16[i] = r));
  return buf;
}

describe("parsePuzzle", () => {
  it("parses a valid puzzle", () => {
    const buf = makePuzzleBuf(3, [1, 2, 3], 1);
    const p = parsePuzzle(buf);
    expect(p.vocabSize).toBe(3);
    expect([...p.ranks]).toEqual([1, 2, 3]);
  });

  it("rejects a bad magic", () => {
    const buf = new ArrayBuffer(12);
    new Uint8Array(buf).set([88, 88, 88, 88]);
    expect(() => parsePuzzle(buf)).toThrow(/bad puzzle magic/);
  });

  it("rejects a truncated body", () => {
    const buf = makePuzzleBuf(5, [1, 2, 3, 4, 5]);
    const truncated = buf.slice(0, 12 + 3 * 2); // claims 5, has 3
    expect(() => parsePuzzle(truncated)).toThrow(/truncated/);
  });
});

describe("createLookup", () => {
  it("returns the rank for known words, case-insensitively", () => {
    const buf = makePuzzleBuf(3, [3, 1, 2]);
    const lookup = createLookup(["alpha", "beta", "gamma"], parsePuzzle(buf));
    expect(lookup.lookupGuess("beta")).toBe(1);
    expect(lookup.lookupGuess("BETA")).toBe(1);
    expect(lookup.lookupGuess("alpha")).toBe(3);
  });

  it("returns null for unknown words", () => {
    const buf = makePuzzleBuf(1, [1]);
    const lookup = createLookup(["alpha"], parsePuzzle(buf));
    expect(lookup.lookupGuess("zeta")).toBeNull();
  });
});
