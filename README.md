# wordgeo

A word-guessing game based on semantic similarity — Contexto-style.

A secret word is chosen; you guess words and each guess returns a **rank** (1 = the secret word, 500 = the 500th-closest word in the vocabulary). Sort your guesses by rank and navigate the semantic space to find the answer.

## How it works

- Embeddings: GloVe 6B, 300 dimensions
- Vocabulary: top ~50,000 frequent words (shipped once, browser-cached)
- Each puzzle is a full ranking of the vocabulary against one secret word, precomputed offline and shipped as a compact binary file (~100KB)
- Single score per guess — just the rank
- **Daily mode**: puzzle derived from the date, everyone gets the same word, no server
- **Practice mode**: random puzzle from the pool

## Structure

```
scripts/   Python build pipeline: download embeddings, build vocab, generate puzzles
data/      vocab.json + puzzles/*.bin (committed artifacts)
app/       React + Vite + TypeScript frontend
```

## Development

```bash
# build pipeline (one-time, downloads GloVe ~800MB)
cd scripts && python3 build.py

# frontend
cd app && npm install && npm run dev
```
