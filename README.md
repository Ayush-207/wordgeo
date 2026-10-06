# wordgeo

A Contexto-style word-guessing game built on semantic similarity.

**Play:** https://ayush-207.github.io/wordgeo/

There's a secret word. Every guess gets a **rank**: 1 is the secret word itself, and 500 means your guess is the 500th-closest word to it in the vocabulary. Lower is warmer. Use your best guesses to work your way toward the answer.

- **Daily mode**: everyone gets the same puzzle, derived from the date
- **Practice mode**: a random puzzle that avoids your 30 most recent ones
- **Hint**: reveals a word ranked at about ¾ of your best guess's rank (your first hint lands near #4000)
- **Give up**: reveals the answer, after a confirm click
- Progress is saved in the browser, and you can copy a shareable result

## How it works

Rankings are computed offline and shipped as static files. The browser never runs a model, and there is no backend.

- **Embeddings:** [Model2Vec `potion-base-32M`](https://huggingface.co/minishlab/potion-base-32M), static 512-dimensional embeddings distilled from a sentence transformer. Similarity reflects meaning rather than co-occurrence in news text (`bush` → shrub, not clinton).
- **Vocabulary:** 39,210 words, which are all the plain lowercase words in the model's tokenizer
- **Puzzles:** 200 curated secret words (`scripts/secrets.txt`). For each one, the build computes the cosine similarity against the whole vocabulary, sorts it, and writes one rank table.
- **Daily id:** `days since LAUNCH_DATE % 200` (`app/src/game/modes.ts`)

### Puzzle file format

`data/puzzles/puzzle-NNN.bin` is about 78 KB. All integers are little-endian.

| bytes | field |
|---|---|
| 0–3 | magic `WG01` |
| 4–7 | `vocab_size` uint32 |
| 8–11 | `secret_index` uint32, the secret's index into `vocab.json` |
| 12– | `ranks` uint16 × `vocab_size`, where `ranks[i]` is the 1-based rank of `vocab[i]` |

The format doesn't depend on the embedding model. You can swap the model in `scripts/build.py` without touching the app.

### A note on cheating

The answers can be read from the shipped files: every puzzle file contains `secret_index`. That's a deliberate tradeoff for a static, serverless game. If it ever matters, `createLookup()` in `app/src/game/puzzle.ts` is where a server-side rank API would plug in.

## Structure

```
scripts/
  build.py              embeddings → vocab + 200 rank tables (validates every row is a permutation, secret = #1)
  secrets.txt           the 200 secret words
  compare_model2vec.py  harness for comparing top-10 neighbours between GloVe and Model2Vec
data/                   vocab.json + puzzles/*.bin (committed build artifacts)
app/
  src/game/             puzzle parsing, modes, hints, storage, share text (unit-tested)
  src/components/       guess input + guess list
  e2e/play.test.js      Playwright playtest
.github/workflows/      test → build → deploy to GitHub Pages on every push to main
```

## Development

### Rebuild the puzzles

```bash
cd scripts
uv venv .venv && uv pip install --python .venv/bin/python numpy==2.5.3 model2vec==0.9.0
.venv/bin/python build.py   # downloads potion-base-32M (~130 MB) from Hugging Face on first run
```

`build.py` rewrites `data/`, so commit the result. Changing the model or `secrets.txt` changes every rank, and saved games will then mix the old and new rankings. Do it deliberately.

`compare_model2vec.py` also needs the GloVe 6B zip in `scripts/cache/` (822 MB, gitignored):
`curl -L -o scripts/cache/glove.6B.zip https://nlp.stanford.edu/data/glove.6B.zip`

### Frontend

```bash
cd app
npm install
npm run dev        # http://localhost:5173/wordgeo/
npm test           # unit tests (vitest)
npm run build && npm run preview &
node e2e/play.test.js   # e2e playtest against the preview server on :4173
```

`app/public/data` is a symlink to `../../data`. In CI, the workflow copies `data/` into `dist/` instead.

## Deployment

Every push to `main` runs the GitHub Actions workflow, which tests, builds, and publishes to GitHub Pages. The Vite `base` defaults to `/wordgeo/` and can be overridden with `VITE_BASE`.
