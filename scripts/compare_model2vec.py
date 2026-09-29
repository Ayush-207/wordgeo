#!/usr/bin/env python3
"""Compare GloVe 6B rank tables against Model2Vec (potion-base-8M) ranks.

Reuses the same pipeline as build.py (same vocab filter, same cosine/argsort),
swaps only the embedding source. Prints top-10 neighbor diffs per secret and
a summary. Writes nothing into data/ — read-only over the shipped artifacts.
"""

import json
import zipfile
from pathlib import Path

import numpy as np
from model2vec import StaticModel

HERE = Path(__file__).parent
ROOT = HERE.parent
CACHE = HERE / "cache"
GLOVE_ZIP = CACHE / "glove.6B.zip"
GLOVE_300D = "glove.6B.300d.txt"
SECRETS_FILE = HERE / "secrets.txt"
VOCAB_OUT = ROOT / "data" / "vocab.json"

VOCAB_SIZE = 50_000
EMBED_DIM = 300
TOP_N = 10


def load_glove_vocab_and_vectors() -> tuple[list[str], np.ndarray]:
    """Same filter as build.py: top-50k frequency-ordered lowercase alphabetic ASCII."""
    vectors: dict[str, np.ndarray] = {}
    with zipfile.ZipFile(GLOVE_ZIP) as zf:
        with zf.open(GLOVE_300D) as fh:
            for raw in fh:
                parts = raw.decode("utf-8").rstrip().split(" ")
                word = parts[0]
                if word in vectors:
                    continue
                vec = np.asarray(parts[1:], dtype=np.float32)
                if vec.shape[0] != EMBED_DIM:
                    continue
                vectors[word] = vec
    vocab = []
    for word in vectors:
        if len(vocab) >= VOCAB_SIZE:
            break
        if word.isascii() and word.isalpha() and word.islower():
            vocab.append(word)
    return vocab, np.stack([vectors[w] for w in vocab])


def model2vec_matrix(vocab: list[str]) -> np.ndarray:
    """Embed the vocab with potion-base-8M token embeddings, L2-normalized.
    Words not in the model's 29.5k token vocab fall back to the UNK token."""
    model = StaticModel.from_pretrained("minishlab/potion-base-8M")
    tid = model.tokenizer.get_vocab()
    unk = model.unk_token_id
    rows = []
    for w in vocab:
        idx = tid.get(w, unk)
        rows.append(model.embedding[idx])
    return np.asarray(rows, dtype=np.float64)


def top_neighbors(mat: np.ndarray, secret_idx: int, n: int) -> list[int]:
    """Top-n vocab indices by cosine for one secret row (excluding itself)."""
    mat_norm = mat / np.linalg.norm(mat, axis=1, keepdims=True)
    s = mat_norm[secret_idx]
    sims = mat_norm @ s
    sims[secret_idx] = -np.inf
    return np.argsort(-sims)[:n]


def main() -> None:
    secrets = [w.strip() for w in SECRETS_FILE.read_text().splitlines() if w.strip()]
    assert len(secrets) == 200, f"expected 200 secrets, got {len(secrets)}"

    print("loading GloVe...")
    glove_vocab, glove_mat = load_glove_vocab_and_vectors()
    glove_vocab_idx = {w: i for i, w in enumerate(glove_vocab)}

    print("loading Model2Vec potion-base-8M...")
    m2v_mat = model2vec_matrix(glove_vocab)

    # keep only secrets present in the vocab (all 200 should be)
    missing = [w for w in secrets if w not in glove_vocab_idx]
    if missing:
        raise SystemExit(f"secrets missing from vocab: {missing}")
    secret_rows = [glove_vocab_idx[w] for w in secrets]

    print(f"\n{'='*72}\ntop-{TOP_N} neighbor comparison (GloVe 6B vs Model2Vec)\n{'='*72}")
    for w, row in zip(secrets, secret_rows):
        g = top_neighbors(glove_mat, row, TOP_N)
        m = top_neighbors(m2v_mat, row, TOP_N)
        g_words = [glove_vocab[i] for i in g]
        m_words = [glove_vocab[i] for i in m]
        overlap = len(set(g_words) & set(m_words))
        print(f"\n--- {w}  (shared: {overlap}/10)")
        print(f"  glove:    {', '.join(g_words)}")
        print(f"  model2vec:{', '.join(m_words)}")


if __name__ == "__main__":
    main()
