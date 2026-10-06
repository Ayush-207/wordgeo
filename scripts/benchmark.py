#!/usr/bin/env python3
"""Score GloVe, Model2Vec, and the shipped ensemble against human word-similarity
ratings (Spearman rho), using the same loaders and scoring as build.py.

Only pairs where both words are in the game vocab and in GloVe are scored.
Benchmark files are downloaded once into scripts/cache/wordsim/.
"""

import urllib.request

import numpy as np

from build import CACHE, load_glove, load_model2vec, noise_floor

WORDSIM = CACHE / "wordsim"
SOURCE = "https://raw.githubusercontent.com/mfaruqui/eval-word-vectors/master/data/word-sim/"
SETS = {
    "SimLex-999 (similarity)": "EN-SIMLEX-999.txt",
    "WS-353 sim": "EN-WS-353-SIM.txt",
    "WS-353 rel (relatedness)": "EN-WS-353-REL.txt",
    "WS-353 all": "EN-WS-353-ALL.txt",
    "MEN-3000 (relatedness)": "EN-MEN-TR-3k.txt",
}
BOOTSTRAP = 2000


def fetch(name: str) -> list[str]:
    path = WORDSIM / name
    if not path.exists():
        WORDSIM.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(SOURCE + name, path)
    return path.read_text().splitlines()


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    # ties are rare in cosines and human means; ordinal ranks are close enough
    ra = np.argsort(np.argsort(a))
    rb = np.argsort(np.argsort(b))
    return float(np.corrcoef(ra, rb)[0, 1])


def main() -> None:
    vocab, m2v = load_model2vec()
    glove, has_glove = load_glove(vocab)
    idx = {w: i for i, w in enumerate(vocab)}
    m_mu, m_sd = noise_floor(m2v, np.ones(len(vocab), dtype=bool))
    g_mu, g_sd = noise_floor(glove, has_glove)
    rng = np.random.default_rng(0)

    print(f"\n{'benchmark':26} {'pairs':>9}  {'GloVe':>6}  {'M2V':>6}  {'ensemble':>8}"
          f"   95% CI (ensemble - M2V)")
    for name, fn in SETS.items():
        human, a_idx, b_idx, total = [], [], [], 0
        for line in fetch(fn):
            parts = line.split()
            if len(parts) < 3:
                continue
            total += 1
            a, b = parts[0].lower(), parts[1].lower()
            if a in idx and b in idx and has_glove[idx[a]] and has_glove[idx[b]]:
                human.append(float(parts[2]))
                a_idx.append(idx[a])
                b_idx.append(idx[b])
        human = np.array(human)
        g = (glove[a_idx] * glove[b_idx]).sum(axis=1)
        m = (m2v[a_idx] * m2v[b_idx]).sum(axis=1)
        ens = ((m - m_mu) / m_sd + (g - g_mu) / g_sd) / 2

        n = len(human)
        diffs = []
        for _ in range(BOOTSTRAP):
            s = rng.integers(0, n, n)
            diffs.append(spearman(human[s], ens[s]) - spearman(human[s], m[s]))
        lo, hi = np.percentile(diffs, [2.5, 97.5])
        print(f"{name:26} {n:>4}/{total:<4}  {spearman(human, g):6.3f}  {spearman(human, m):6.3f}"
              f"  {spearman(human, ens):8.3f}   [{lo:+.3f}, {hi:+.3f}]")


if __name__ == "__main__":
    main()
