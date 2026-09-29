#!/usr/bin/env python3
"""wordgeo build pipeline.

Steps:
  1. load Model2Vec potion-base-32M token embeddings (distilled from a
     contrastive teacher; similarity tracks meaning better than GloVe)
  2. build the vocabulary: words present in the model tokenizer, lowercase
     alphabetic, deduplicated
  3. load the curated secret-word list (secrets.txt, exactly 200 words)
  4. normalize vectors, compute S @ V.T, argsort each row -> rank tables
  5. write data/vocab.json and data/puzzles/puzzle-<id>.bin (uint16 ranks)

Validates loudly: every secret must be in vocab, ranks must be a permutation.
"""

import json
import sys
from pathlib import Path

import numpy as np
from model2vec import StaticModel

HERE = Path(__file__).parent
ROOT = HERE.parent
CACHE = HERE / "cache"
DATA = ROOT / "data"
PUZZLES_DIR = DATA / "puzzles"
MODEL_NAME = "minishlab/potion-base-32M"

VOCAB_SIZE = 39_210  # potion-base-32M tokenizer words passing the filter; see load_embeddings

EMBED_DIM = 512

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


def load_embeddings() -> tuple[list[str], np.ndarray]:
    """Load potion-base-32M and return (vocab, matrix).

    The vocab is the set of model tokenizer words that pass the plain-lowercase
    filter, ordered by tokenizer id (roughly frequency order — the distilled
    vocab was itself built from a frequency-ordered source).
    """
    model = StaticModel.from_pretrained(MODEL_NAME)
    tok_vocab = model.tokenizer.get_vocab()
    emb = model.embedding

    words = [w for w in tok_vocab
             if w.isascii() and w.isalpha() and w.islower()]
    words.sort(key=tok_vocab.get)  # tokenizer id order

    if len(words) < VOCAB_SIZE:
        fail(f"model tokenizer yielded only {len(words)} filtered words "
             f"(wanted {VOCAB_SIZE})")
    words = words[:VOCAB_SIZE]

    mat = np.stack([emb[tok_vocab[w]] for w in words]).astype(np.float64)
    print(f"loaded {MODEL_NAME}: {len(words):,} vocab words, {mat.shape[1]} dims")
    return words, mat


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


def compute_ranks(mat: np.ndarray, vocab: list[str], secrets: list[str]) -> np.ndarray:
    """Return ranks[secret_i, vocab_j] = 1-based rank of vocab word j for secret i."""
    vocab_idx = {w: i for i, w in enumerate(vocab)}
    V = mat                                            # (VOCAB_SIZE, DIM)
    S = np.stack([mat[vocab_idx[w]] for w in secrets])  # (200, DIM)

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
    vocab, mat = load_embeddings()
    secrets = load_secrets(vocab)
    ranks = compute_ranks(mat, vocab, secrets)
    validate_ranks(ranks, secrets, vocab)
    write_outputs(vocab, secrets, ranks)
    print("build complete")


if __name__ == "__main__":
    main()
