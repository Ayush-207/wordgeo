#!/usr/bin/env python3
"""wordgeo build pipeline.

Steps:
  1. build the vocabulary from the Model2Vec potion-base-32M tokenizer:
     whole lowercase alphabetic words, in tokenizer id order
  2. load two embedding models over that vocabulary:
       - Model2Vec potion-base-32M (distilled from a sentence transformer)
       - GloVe 6B 300d (co-occurrence)
  3. load the curated secret-word list (secrets.txt, exactly 200 words)
  4. score each secret against the vocab with BOTH models, z-score each
     model's cosines against its own random-pair noise floor, average them,
     argsort each row -> rank tables
  5. write data/vocab.json and data/puzzles/puzzle-<id>.bin (uint16 ranks)

Why an ensemble: on human similarity benchmarks the average beats either model
alone on relatedness (MEN-3000 Spearman 0.84 vs 0.77 M2V / 0.75 GloVe), which
is what a Contexto-style game rewards. See benchmark.py.

Validates loudly: every secret must be in vocab, ranks must be a permutation.
"""

import json
import sys
import zipfile
from pathlib import Path

import numpy as np
from model2vec import StaticModel

HERE = Path(__file__).parent
ROOT = HERE.parent
CACHE = HERE / "cache"
DATA = ROOT / "data"
PUZZLES_DIR = DATA / "puzzles"
M2V_MODEL = "minishlab/potion-base-32M"
GLOVE_ZIP = CACHE / "glove.6B.zip"
GLOVE_300D = "glove.6B.300d.txt"
GLOVE_DIM = 300

VOCAB_SIZE = 39_210  # potion-base-32M tokenizer words passing the filter; see load_model2vec

# random word pairs sampled to estimate each model's cosine noise floor
NOISE_PAIRS = 50_000
NOISE_SEED = 0

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


def unit_rows(mat: np.ndarray) -> np.ndarray:
    return mat / np.linalg.norm(mat, axis=1, keepdims=True)


def load_model2vec() -> tuple[list[str], np.ndarray]:
    """Load potion-base-32M and return (vocab, unit-normalized matrix).

    The vocab is the set of model tokenizer words that pass the plain-lowercase
    filter, ordered by tokenizer id (roughly frequency order).
    """
    model = StaticModel.from_pretrained(M2V_MODEL)
    tok_vocab = model.tokenizer.get_vocab()

    words = [w for w in tok_vocab
             if w.isascii() and w.isalpha() and w.islower()]
    words.sort(key=tok_vocab.get)  # tokenizer id order

    if len(words) < VOCAB_SIZE:
        fail(f"model tokenizer yielded only {len(words)} filtered words "
             f"(wanted {VOCAB_SIZE})")
    words = words[:VOCAB_SIZE]

    mat = np.stack([model.embedding[tok_vocab[w]] for w in words]).astype(np.float64)
    print(f"loaded {M2V_MODEL}: {len(words):,} vocab words, {mat.shape[1]} dims")
    return words, unit_rows(mat)


def load_glove(vocab: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Return (unit-normalized matrix aligned to vocab, has-vector mask).

    Scans the full 400k GloVe file; vocab words GloVe lacks get a zero row and
    mask False, and are scored by Model2Vec alone.
    """
    if not GLOVE_ZIP.exists():
        fail(f"GloVe zip not found at {GLOVE_ZIP}. Download it first:\n"
             "  curl -L -o scripts/cache/glove.6B.zip https://nlp.stanford.edu/data/glove.6B.zip")
    index = {w: i for i, w in enumerate(vocab)}
    mat = np.zeros((len(vocab), GLOVE_DIM))
    has = np.zeros(len(vocab), dtype=bool)
    with zipfile.ZipFile(GLOVE_ZIP) as zf, zf.open(GLOVE_300D) as fh:
        for raw in fh:
            word, _, rest = raw.decode("utf-8").rstrip().partition(" ")
            i = index.get(word)
            if i is None or has[i]:
                continue
            vec = np.asarray(rest.split(" "), dtype=np.float64)
            if vec.shape[0] != GLOVE_DIM:
                continue
            mat[i] = vec
            has[i] = True
    mat[has] = unit_rows(mat[has])
    print(f"loaded GloVe 6B {GLOVE_DIM}d: {has.sum():,}/{len(vocab):,} vocab words covered")
    return mat, has


def noise_floor(mat: np.ndarray, mask: np.ndarray) -> tuple[float, float]:
    """Mean and std of cosine between random pairs of covered words."""
    rng = np.random.default_rng(NOISE_SEED)
    rows = np.flatnonzero(mask)
    pairs = rng.choice(rows, size=(NOISE_PAIRS, 2))
    cos = (mat[pairs[:, 0]] * mat[pairs[:, 1]]).sum(axis=1)
    return float(cos.mean()), float(cos.std())


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


def ensemble_scores(m2v: np.ndarray, glove: np.ndarray, has_glove: np.ndarray,
                    vocab: list[str], secrets: list[str]) -> np.ndarray:
    """scores[secret_i, vocab_j] = mean of the two models' z-scored cosines.

    Each model's cosines are standardized against its own random-pair noise
    floor, so neither model dominates just by having a wider cosine spread.
    Pairs GloVe can't score fall back to the Model2Vec z-score alone.
    """
    vocab_idx = {w: i for i, w in enumerate(vocab)}
    rows = [vocab_idx[w] for w in secrets]
    missing = [w for w in secrets if not has_glove[vocab_idx[w]]]
    if missing:
        fail(f"secrets missing from GloVe: {missing}")

    m_mu, m_sd = noise_floor(m2v, np.ones(len(vocab), dtype=bool))
    g_mu, g_sd = noise_floor(glove, has_glove)
    print(f"noise floor: Model2Vec {m_mu:+.3f} ± {m_sd:.3f}, GloVe {g_mu:+.3f} ± {g_sd:.3f}")

    z_m = (m2v[rows] @ m2v.T - m_mu) / m_sd            # (200, VOCAB_SIZE)
    z_g = (glove[rows] @ glove.T - g_mu) / g_sd
    return np.where(has_glove[None, :], (z_m + z_g) / 2, z_m)


def compute_ranks(scores: np.ndarray) -> np.ndarray:
    """Return ranks[secret_i, vocab_j] = 1-based rank of vocab word j for secret i."""
    order = np.argsort(-scores, axis=1)                 # vocab indices, best first
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
    vocab, m2v = load_model2vec()
    glove, has_glove = load_glove(vocab)
    secrets = load_secrets(vocab)
    scores = ensemble_scores(m2v, glove, has_glove, vocab, secrets)
    ranks = compute_ranks(scores)
    validate_ranks(ranks, secrets, vocab)
    write_outputs(vocab, secrets, ranks)
    print("build complete")


if __name__ == "__main__":
    main()
