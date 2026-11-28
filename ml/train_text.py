"""Đợt B: understanding job text with embeddings.

1. Skill and category tagging. For every (job, label) pair a logistic regression scores four
   label-agnostic features (semantic similarity of the whole post and of the title to the label name,
   exact mention, share of the label's words present), so labels UIT adds later work without retraining.
2. Semantic search: rank posts for a student's sentence by mixing embedding similarity with keyword overlap.

Both are compared with plain keyword matching on a held-out split of the Gemini-generated corpus.
Usage: python ml/train_text.py --env-file .env
"""
import argparse
import hashlib
import json
import os
import sys

import numpy as np
from sklearn.linear_model import LogisticRegression

sys.path.insert(0, os.path.dirname(__file__))
import gemini  # noqa: E402
from export_model import write  # noqa: E402
from features import tokens  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(HERE, "datasets", "jobs_synthetic_vi.jsonl")
CACHE = os.path.join(HERE, "data", "text-embeddings.json")
RESOURCES = os.path.join(ROOT, "backend", "src", "main", "resources", "ml")
REPORT_DIR = os.path.join(HERE, "reports")
SEED = 20261128
TAG_FEATURES = ["cos_full", "cos_title", "exact_mention", "token_share", "cos_vs_reference", "share_below"]
# The last two compare the label with a fixed reference set (the training labels), shipped with the model,
# so they mean the same thing at runtime whatever skills UIT has in its taxonomy.
from generate_jobs import CATEGORIES, SKILLS  # noqa: E402


def job_text(job):
    return f"{job['title']}. {job['description']} {job['requirements']}"


def mention_features(text, label):
    """exact_mention: every word of one of the label's spellings appears in order; token_share: share of label words present."""
    text_tokens = tokens(text)
    joined = " " + " ".join(text_tokens) + " "
    spellings = [label] + [part for part in label.split("/") if part != label]
    exact = any((" " + " ".join(tokens(s)) + " ") in joined for s in spellings if tokens(s))
    label_tokens = set(tokens(label))
    share = len(label_tokens & set(text_tokens)) / len(label_tokens) if label_tokens else 0.0
    return [1.0 if exact else 0.0, share]


def keyword_score(query, text):
    """Share of the query's words that appear in the post (same function in Java)."""
    query_tokens = set(tokens(query))
    return len(query_tokens & set(tokens(text))) / len(query_tokens) if query_tokens else 0.0


class Embeddings:
    def __init__(self, key):
        self.key = key
        self.store = json.load(open(CACHE, encoding="utf-8")) if os.path.exists(CACHE) else {}

    def get(self, texts, offline=False):
        missing = [t for t in dict.fromkeys(texts) if self.hash(t) not in self.store]
        if missing and offline:
            return np.array([self.store.get(self.hash(t), [np.nan] * gemini.DIMENSIONS) for t in texts])
        if missing:
            os.makedirs(os.path.dirname(CACHE), exist_ok=True)

            def keep(chunk, vectors):   # saved after every batch, so a stopped run resumes where it left off
                for text, vector in zip(chunk, vectors):
                    self.store[self.hash(text)] = vector
                json.dump(self.store, open(CACHE, "w", encoding="utf-8"))
            gemini.embed(self.key, missing, on_batch=keep)
        return np.array([self.store[self.hash(t)] for t in texts])

    @staticmethod
    def hash(text):
        return hashlib.sha256((gemini.EMBEDDING_MODEL + "\n" + text).encode("utf-8")).hexdigest()


def relative(cos, reference_cos):
    """cos_vs_reference: cos minus the post's mean similarity to the reference labels;
    share_below: share of reference labels the post is less similar to."""
    return [cos - float(np.mean(reference_cos)), float(np.mean(reference_cos < cos))]


def pair_rows(jobs, labels, job_vectors, title_vectors, label_vectors, truth, reference_vectors):
    rows, ys = [], []
    for j, job in enumerate(jobs):
        text = job_text(job)
        reference_cos = reference_vectors @ job_vectors[j]
        for l, label in enumerate(labels):
            cos = float(job_vectors[j] @ label_vectors[l])
            rows.append([cos, float(title_vectors[j] @ label_vectors[l]), *mention_features(text, label),
                         *relative(cos, reference_cos)])
            ys.append(1 if label in truth(job) else 0)
    return np.array(rows), np.array(ys)


def best_threshold(scores, labels):
    best = (0.0, 0.5)
    for threshold in np.unique(np.round(scores, 3)):
        predicted = scores >= threshold
        tp = (predicted & (labels == 1)).sum()
        precision = tp / max(1, predicted.sum())
        recall = tp / max(1, labels.sum())
        f1 = 2 * precision * recall / max(1e-9, precision + recall)
        best = max(best, (f1, float(threshold)))
    return best[1]


def prf(predicted, labels, mask=None):
    if mask is not None:
        predicted, labels = predicted[mask], labels[mask]
    tp = int((predicted & (labels == 1)).sum())
    precision = tp / max(1, int(predicted.sum()))
    recall = tp / max(1, int(labels.sum()))
    return {"precision": precision, "recall": recall, "f1": 2 * precision * recall / max(1e-9, precision + recall)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file")
    parser.add_argument("--offline", action="store_true",
                        help="no API calls; search is evaluated only on posts whose query is already embedded")
    args = parser.parse_args()
    jobs = [json.loads(line) for line in open(DATA, encoding="utf-8")]
    emb = Embeddings(None if args.offline else gemini.load_key(args.env_file))
    texts = {
        "full": [gemini.as_similarity(job_text(j)) for j in jobs],
        "titles": [gemini.as_similarity(j["title"]) for j in jobs],
        "skills": [gemini.as_similarity(s) for s in SKILLS],
        "categories": [gemini.as_similarity(c) for c in CATEGORIES],
        "documents": [gemini.as_document(j["title"], f"{j['description']} {j['requirements']}") for j in jobs],
        "queries": [gemini.as_query(j["query"]) for j in jobs],
    }
    if not args.offline:
        emb.get([t for group in texts.values() for t in group])   # one pass, resumable
    full, titles, skill_vectors, category_vectors, documents, queries = (emb.get(texts[k], offline=args.offline) for k in texts)
    for name, vectors in (("full", full), ("titles", titles), ("skills", skill_vectors), ("categories", category_vectors)):
        assert not np.isnan(vectors).any(), f"thiếu embedding {name}; chạy lại không có --offline"
    has_query = ~np.isnan(queries).any(axis=1) & ~np.isnan(documents).any(axis=1)

    order = np.random.default_rng(SEED).permutation(len(jobs))
    test, valid, train = order[: len(jobs) // 5], order[len(jobs) // 5: 2 * len(jobs) // 5], order[2 * len(jobs) // 5:]
    split = lambda idx: [jobs[i] for i in idx]

    report = {"jobs": len(jobs), "skills": len(SKILLS), "categories": len(CATEGORIES),
              "split": {"train": len(train), "valid": len(valid), "test": len(test)}}

    # ---- skill tagging ------------------------------------------------------------------
    def skill_pairs(idx):
        return pair_rows(split(idx), SKILLS, full[idx], titles[idx], skill_vectors, lambda job: job["skills"], skill_vectors)
    x_train, y_train = skill_pairs(train)
    x_valid, y_valid = skill_pairs(valid)
    x_test, y_test = skill_pairs(test)
    implied_test = (x_test[:, 2] == 0)   # skills the post never names
    tagger = LogisticRegression(max_iter=2000, class_weight="balanced").fit(x_train, y_train)
    threshold = best_threshold(tagger.predict_proba(x_valid)[:, 1], y_valid)
    cos_threshold = best_threshold(x_valid[:, 0], y_valid)
    methods = {
        "keyword_exact": x_test[:, 2] == 1,
        "embedding_cosine": x_test[:, 0] >= cos_threshold,
        "logistic_regression": tagger.predict_proba(x_test)[:, 1] >= threshold,
    }
    report["skill_tagging"] = {name: {"all": prf(p, y_test), "implied_only_recall": prf(p, y_test, implied_test)["recall"]}
                               for name, p in methods.items()}
    report["skill_tagging"]["thresholds"] = {"logistic_regression": threshold, "embedding_cosine": cos_threshold}
    report["skill_tagging"]["implied_share_of_true_skills"] = float(((y_test == 1) & implied_test).sum() / max(1, y_test.sum()))
    report["skill_tagging"]["coefficients"] = dict(zip(TAG_FEATURES, np.round(tagger.coef_[0], 3).tolist()))

    # ---- category tagging: one label per post ---------------------------------------------
    def category_pairs(idx):
        return pair_rows(split(idx), CATEGORIES, full[idx], titles[idx], category_vectors, lambda job: [job["category"]], category_vectors)
    cx_train, cy_train = category_pairs(train)
    cx_valid, cy_valid = category_pairs(valid)
    cx_test, cy_test = category_pairs(test)
    category_model = LogisticRegression(max_iter=2000, class_weight="balanced").fit(cx_train, cy_train)
    k = len(CATEGORIES)

    def accuracy(x, y, method):
        truth = y.reshape(-1, k).argmax(1)
        if method == "keyword_exact":
            keyword = x[:, 2].reshape(-1, k)
            return float(np.mean([row.any() and row.argmax() == t for row, t in zip(keyword, truth)]))
        scores = x[:, 0] if method == "embedding_cosine" else category_model.predict_proba(x)[:, 1]
        return float(np.mean(scores.reshape(-1, k).argmax(1) == truth))
    methods_c = ("keyword_exact", "embedding_cosine", "logistic_regression")
    report["category_accuracy"] = {m: accuracy(cx_test, cy_test, m) for m in methods_c}
    category_method = max(methods_c[1:], key=lambda m: accuracy(cx_valid, cy_valid, m))
    report["category_accuracy"]["chosen_on_validation"] = category_method

    # ---- semantic search: each test query among the test posts ------------------------------
    test_search = np.array([i for i in test if has_query[i]])
    valid_search = np.array([i for i in valid if has_query[i]])

    def search_metrics(idx, alpha):
        ranks = []
        texts = [job_text(jobs[i]) for i in idx]
        for a, i in enumerate(idx):
            semantic = documents[idx] @ queries[i]
            keyword_scores = np.array([keyword_score(jobs[i]["query"], t) for t in texts])
            score = alpha * semantic + (1 - alpha) * keyword_scores
            ranks.append(int((score > score[a]).sum()) + 1)
        ranks = np.array(ranks)
        return {"recall@1": float((ranks <= 1).mean()), "recall@5": float((ranks <= 5).mean()), "mrr": float((1 / ranks).mean())}
    alphas = np.round(np.arange(0, 1.01, 0.1), 1)
    best_alpha = float(max(alphas, key=lambda a: (search_metrics(valid_search, a)["mrr"], a)))
    report["search"] = {"keyword_only": search_metrics(test_search, 0.0), "embedding_only": search_metrics(test_search, 1.0),
                        "hybrid": search_metrics(test_search, best_alpha), "hybrid_alpha": best_alpha,
                        "candidates": len(test_search), "valid_queries": len(valid_search),
                        "complete": bool(has_query.all())}

    meta = {"trainedOn": "gemini-generated", "embeddingModel": gemini.EMBEDDING_MODEL, "dimensions": gemini.DIMENSIONS}
    write(os.path.join(RESOURCES, "text-models.json"), {
        "skillTagger": {"type": "logistic", "features": TAG_FEATURES, "coef": tagger.coef_[0].tolist(),
                        "intercept": float(tagger.intercept_[0]), "threshold": threshold},
        "categoryTagger": {"type": "logistic", "features": TAG_FEATURES, "coef": category_model.coef_[0].tolist(),
                           "intercept": float(category_model.intercept_[0]), "method": category_method},
        "skillReference": np.round(skill_vectors, 6).tolist(), "categoryReference": np.round(category_vectors, 6).tolist(),
        "search": {"alpha": best_alpha}, **meta,
        "version": f"gemini-generated-{SEED}", "test": {"skillF1": report["skill_tagging"]["logistic_regression"]["all"]["f1"],
                                                        "searchMrr": report["search"]["hybrid"]["mrr"]}})
    os.makedirs(REPORT_DIR, exist_ok=True)
    json.dump(report, open(os.path.join(REPORT_DIR, "text-metrics.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)

    # Parity: the Java side recomputes mention features and keyword scores from raw text.
    cases = [{"text": job_text(jobs[i]), "label": label, "mention": mention_features(job_text(jobs[i]), label)}
             for i in test[:12] for label in ("Java", "Spring Boot", "HTML/CSS", "Vue.js", "CI/CD", "Kiểm thử tự động")]
    keyword_cases = [{"query": jobs[i]["query"], "text": job_text(jobs[j]), "score": keyword_score(jobs[i]["query"], job_text(jobs[j]))}
                     for i in test[:6] for j in test[:6]]
    probe = [[0.71, 0.55, 1.0, 1.0, 0.08, 0.95], [0.62, 0.48, 0.0, 0.0, -0.01, 0.4], [0.58, 0.60, 0.0, 0.5, 0.03, 0.7]]
    # Reference-relative features from a real post, replayed with the shipped reference vectors.
    i = int(test[0])
    reference_cases = [{"job": full[i].tolist(), "label": skill_vectors[s].tolist(),
                        "relative": relative(float(full[i] @ skill_vectors[s]), np.round(skill_vectors, 6) @ full[i])}
                       for s in (0, 5, 10)]
    write(os.path.join(ROOT, "backend", "src", "test", "resources", "ml", "text-cases.json"), {
        "mention": cases, "keyword": keyword_cases,
        "tagger": [{"features": f, "probability": float(tagger.predict_proba([f])[0, 1])} for f in probe],
        "reference": reference_cases})
    print(json.dumps({k: report[k] for k in ("skill_tagging", "category_accuracy", "search")}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
