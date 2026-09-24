// E2E playtest: load the app, make guesses, verify ranking + solve flow.
// Run: node e2e/play.test.js  (expects preview server on :4173)

import { chromium } from "playwright";

const BASE = "http://localhost:4173/wordgeo/";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const browser = await chromium.launch();
const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

// 1. app loads
await page.goto(BASE, { waitUntil: "networkidle" });
check("app renders title", (await page.textContent("h1")) === "wordgeo");

// 2. input present, waiting for guesses
const input = page.locator(".guess-form input");
await input.waitFor({ state: "visible", timeout: 5000 });
check("guess input visible", true);

// 3. make a guess — "ocean" for the daily puzzle; expect it to appear with a rank
await input.fill("ocean");
await page.locator(".guess-form button").click();
await page.locator(".guess:has-text('ocean')").waitFor({ timeout: 5000 });
const oceanRank = await page.textContent(".guess:has-text('ocean') .rank");
check("ocean ranked", /^#\d[\d,]*$/.test(oceanRank.trim()), oceanRank.trim());

// 4. unknown word shows a message, no new guess row
const guessCount = await page.locator(".guess").count();
await input.fill("asdfghjkl");
await page.locator(".guess-form button").click();
await page.waitForTimeout(300);
check(
  "unknown word rejected",
  (await page.locator(".guess").count()) === guessCount &&
    (await page.textContent(".message")).includes("not in my vocabulary"),
);

// 5. duplicate guess rejected
await input.fill("ocean");
await page.locator(".guess-form button").click();
await page.waitForTimeout(300);
check(
  "duplicate rejected",
  (await page.locator(".guess").count()) === guessCount &&
    (await page.textContent(".message")).includes("already guessed"),
);

// 6. guessing the daily secret solves the game.
// Daily id for today, then read the secret from the puzzle file ourselves
// (this is a playtest, not the app under test doing anything wrong).
const today = Math.floor((Date.now() - Date.parse("2026-10-01T00:00:00Z")) / 86400000);
const puzzleId = ((today % 200) + 200) % 200;
const puzzleResp = await page.request.get(`${BASE}/data/puzzles/puzzle-${String(puzzleId).padStart(3, "0")}.bin`);
const puzzleBuf = new Uint8Array(await puzzleResp.body()).buffer;
const dv = new DataView(puzzleBuf);
const vocabSize = dv.getUint32(4, true);
const secretIndex = dv.getUint32(8, true);
const vocab = await (await page.request.get(`${BASE}/data/vocab.json`)).json();
const secret = vocab[secretIndex];
console.log(`  (daily #${puzzleId}, secret = ${secret})`);

await input.fill(secret);
await page.locator(".guess-form button").click();
await page.locator(".solved").waitFor({ timeout: 5000 });
check("solved panel appears", true);
check(
  "solved guess count includes final guess",
  (await page.textContent(".solved p")).includes("guess"),
);

// 7. input hidden after solve, share button works
check("input gone after solve", (await page.locator(".guess-form").count()) === 0);
await page.locator(".share", { hasText: "copy result" }).click();
await page.waitForTimeout(300);
const clip = await page.evaluate(() => navigator.clipboard.readText());
check("share text copied", clip.startsWith(`wordgeo #${puzzleId}`), clip);

// 8. reload — state persisted
await page.reload({ waitUntil: "networkidle" });
await page.locator(".solved").waitFor({ timeout: 5000 });
check("solved state persists across reload", true);

// 9. practice mode: new puzzle loads and accepts guesses
await page.locator(".modes button", { hasText: "practice" }).click();
await page.locator(".guess-form input").waitFor({ state: "visible", timeout: 5000 });
await input2(page).fill("river");
await page.locator(".guess-form button").click();
await page.locator(".guess:has-text('river')").waitFor({ timeout: 5000 });
check("practice mode playable", true);

function input2(p) {
  return p.locator(".guess-form input");
}

check("no page errors", errors.length === 0, errors.join("; "));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(failed.length === 0 ? "\nALL E2E CHECKS PASSED" : `\n${failed.length} FAILURES`);
process.exit(failed.length === 0 ? 0 : 1);
