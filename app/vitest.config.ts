import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // e2e/play.test.js is a manual script (needs a preview server + a
    // downloaded browser); keep it out of vitest's unit-test discovery.
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
