#!/usr/bin/env python3
"""wordgeo build pipeline.

Steps:
  1. load GloVe 300d embeddings from cache (zip or extracted txt)
  2. build the vocabulary: top-N frequent, lowercase alphabetic, deduplicated
  3. load the curated secret-word list (secrets.txt, exactly 200 words)
  4. normalize vectors, compute S @ V.T, argsort each row -> rank tables
  5. write data/vocab.json and data/puzzles/puzzle-<id>.bin (uint16 ranks)

Validates loudly: every secret must be in vocab, ranks must be a permutation.
"""

import json
import sys
import zipfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
ROOT = HERE.parent
CACHE = HERE / "cache"
DATA = ROOT / "data"
PUZZLES_DIR = DATA / "puzzles"
GLOVE_ZIP = CACHE / "glove.6B.zip"
GLOVE_300D = "glove.6B.300d.txt"

VOCAB_SIZE = 50_000
EMBED_DIM = 300

VOCAB_OUT = DATA / "vocab.json"
SECRETS_FILE = HERE / "secrets.txt"

# puzzle.bin layout: header + rank array
#   magic "WG01" (4 bytes)
#   vocab_size uint32 LE
#   secret_index uint32 LE (index into vocab; rank 1 IS this word)
#   ranks uint16 LE x vocab_size, ranks[vocab_index] = rank of that word (1-based)
MAGIC = b"WG01"


def fail(msg: str) -> None:
    print(f"BUILD FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def load_embeddings() -> dict[str, np.ndarray]:
    """Load word -> vector from the GloVe zip, preferring the 300d file."""
    if not GLOVE_ZIP.exists():
        fail(f"GloVe zip not found at {GLOVE_ZIP}. Download it first:\n"
             "  curl -sL -o scripts/cache/glove.6B.zip http://nlp.stanford.edu/data/glove.6B.zip")
    vectors: dict[str, np.ndarray] = {}
    with zipfile.ZipFile(GLOVE_ZIP) as zf:
        try:
            name = zf.getinfo(GLOVE_300D)
        except KeyError:
            fail(f"{GLOVE_300D} not inside the zip; contains: {zf.namelist()}")
        with zf.open(name) as fh:
            for raw in fh:
                parts = raw.decode("utf-8").rstrip().split(" ")
                word = parts[0]
                # GloVe ordering is by frequency; first occurrence wins.
                if word in vectors:
                    continue
                vec = np.asarray(parts[1:], dtype=np.float32)
                if vec.shape[0] != EMBED_DIM:
                    continue
                vectors[word] = vec
    print(f"loaded {len(vectors):,} embeddings")
    return vectors


def build_vocab(vectors: dict[str, np.ndarray]) -> list[str]:
    """Top-N by GloVe frequency order, filtered to plain lowercase alphabetic."""
    vocab = []
    for word in vectors:  # dict preserves GloVe file order = frequency order
        if len(vocab) >= VOCAB_SIZE:
            break
        if word.isascii() and word.isalpha() and word.islower():
            vocab.append(word)
    if len(vocab) < VOCAB_SIZE:
        fail(f"vocab too small: {len(vocab)} (wanted {VOCAB_SIZE})")
    # validation: no duplicates possible via dict, but assert anyway
    assert len(set(vocab)) == len(vocab)
    print(f"vocab: {len(vocab):,} words")
    return vocab


def load_secrets(vocab: list[str]) -> list[str]:
    if not SECRETS_FILE.exists():
        fail(f"secrets file missing: {SECRETS_FILE}")
    secrets = []
    for line in SECRETS_FILE.read_text().splitlines():
        w = line.strip().lower()
        if w:
            secrets.append(w)
    if len(secrets) != 200:
        fail(f"secrets.txt must contain exactly 200 words, found {len(secrets)}")
    vocab_set = set(vocab)
    missing = [w for w in secrets if w not in vocab_set]
    if missing:
        fail(f"secrets not in vocab: {missing}")
    if len(set(secrets)) != len(secrets):
        fail("secrets.txt contains duplicate words")
    print(f"secrets: {len(secrets)} words, all present in vocab")
    return secrets


def compute_ranks(vectors: dict[str, np.ndarray], vocab: list[str], secrets: list[str]) -> np.ndarray:
    """Return ranks[secret_i, vocab_j] = 1-based rank of vocab word j for secret i."""
    V = np.stack([vectors[w] for w in vocab])          # (VOCAB_SIZE, 300)
    S = np.stack([vectors[w] for w in secrets])        # (200, 300)

    # normalize rows to unit length -> dot product == cosine similarity
    V /= np.linalg.norm(V, axis=1, keepdims=True)
    S /= np.linalg.norm(S, axis=1, keepdims=True)

    sims = S @ V.T                                      # (200, VOCAB_SIZE)
    order = np.argsort(-sims, axis=1)                   # vocab indices, best first
    ranks = np.empty_like(order, dtype=np.uint16)
    rows = np.arange(order.shape[0])[:, None]
    cols = np.arange(order.shape[1])[None, :]
    # rank of the word at position k in the sorted order is k+1
    ranks[rows, order] = (cols + 1).astype(np.uint16)
    return ranks


def validate_ranks(ranks: np.ndarray, secrets: list[str], vocab: list[str]) -> None:
    """Each row must be a permutation of 1..VOCAB_SIZE, secret itself rank 1."""
    for i, secret in enumerate(secrets):
        row = ranks[i]
        sorted_row = np.sort(row)
        expected = np.arange(1, VOCAB_SIZE + 1, dtype=np.uint16)
        if not np.array_equal(sorted_row, expected):
            fail(f"row {i} ({secret}) is not a permutation of 1..{VOCAB_SIZE}")
        if row[vocab.index(secret)] != 1:
            fail(f"secret {secret} does not have rank 1 in its own row")
    print("rank validation passed: all rows are valid permutations, secrets rank 1")


def write_outputs(vocab: list[str], secrets: list[str], ranks: np.ndarray) -> None:
    DATA.mkdir(exist_ok=True)
    PUZZLES_DIR.mkdir(exist_ok=True, parents=True)

    VOCAB_OUT.write_text(json.dumps(vocab))
    print(f"wrote {VOCAB_OUT} ({VOCAB_OUT.stat().st_size:,} bytes)")

    for i, secret in enumerate(secrets):
        secret_index = vocab.index(secret)
        header = MAGIC + VOCAB_SIZE.to_bytes(4, "little") + secret_index.to_bytes(4, "little")
        blob = header + ranks[i].astype("<u2").tobytes()
        out = PUZZLES_DIR / f"puzzle-{i:03d}.bin"
        out.write_bytes(blob)
    print(f"wrote {len(secrets)} puzzle files to {PUZZLES_DIR}")


def main() -> None:
    vectors = load_embeddings()
    vocab = build_vocab(vectors)
    secrets = load_secrets(vocab)
    ranks = compute_ranks(vectors, vocab, secrets)
    validate_ranks(ranks, secrets, vocab)
    write_outputs(vocab, secrets, ranks)
    print("build complete")


if __name__ == "__main__":
    main()
