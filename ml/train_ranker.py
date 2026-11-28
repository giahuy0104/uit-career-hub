"""AI3 v2: learn to rank jobs for a student, compared with the hand-written formula.

The system has too few real interactions to train on, so the data is simulated with known hidden
factors (true interest revealed only by application history, company popularity, freshness). The
report says so: the experiment shows the model can learn signals the formula ignores; it does not
claim accuracy on real users. Retrain on real events with --data once interaction logs accumulate.

Usage: ml/.venv/Scripts/python ml/train_ranker.py
"""
import argparse
import json
import math
import os
import random
import sys

import lightgbm as lgb
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(__file__))
from export_model import gbdt_json, logistic_json, write  # noqa: E402
from features import RANKER_FEATURES, ranker_features  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(ROOT, "backend", "src", "main", "resources", "ml", "job-ranker.json")
REPORT_DIR = os.path.join(ROOT, "ml", "reports")
SEED = 20261128

CATEGORIES = {
    "software": ["java", "spring", "sql", "git", "docker", "testing"],
    "frontend": ["javascript", "react", "css", "typescript", "git", "testing"],
    "data": ["python", "sql", "pandas", "statistics", "ml", "visualization"],
    "devops": ["docker", "linux", "cloud", "networking", "git", "python"],
    "mobile": ["kotlin", "swift", "flutter", "git", "testing", "ui"],
    "security": ["networking", "linux", "python", "cryptography", "testing", "cloud"],
}
TYPES = ["INTERNSHIP", "FRESHER", "FULL_TIME", "PART_TIME"]


def simulate(rng, students=1600, jobs=320, companies=45, shown=15):
    names = list(CATEGORIES)
    popularity = [rng.gauss(0, 1) for _ in range(companies)]
    apps30 = [np.random.default_rng(SEED + c).poisson(math.exp(1.4 + 0.8 * p)) for c, p in enumerate(popularity)]
    job_list = []
    for j in range(jobs):
        cat = rng.choice(names)
        pool = CATEGORIES[cat]
        req = rng.sample(pool, rng.randint(1, 3))
        opt = rng.sample([s for s in pool if s not in req], rng.randint(0, 2))
        cats = [cat] + ([rng.choice(names)] if rng.random() < 0.2 else [])
        company = rng.randrange(companies)
        job_list.append({
            "id": j, "company": company, "skills": req + opt, "required": {**{s: True for s in req}, **{s: False for s in opt}},
            "categories": list(dict.fromkeys(cats)), "type": rng.choices(TYPES, [0.55, 0.2, 0.15, 0.1])[0],
            "days_since_published": rng.randint(0, 60), "days_to_deadline": rng.randint(3, 90),
        })
    rows, labels, groups, students_of = [], [], [], []
    for s in range(students):
        primary = rng.choice(names)
        interest = primary if rng.random() < 0.5 else rng.choice(names)   # hidden from the profile
        skills = set(rng.sample(CATEGORIES[primary], rng.randint(2, 5)))
        if rng.random() < 0.5:
            skills |= set(rng.sample(CATEGORIES[interest], rng.randint(1, 3)))
        student = {
            "skills": sorted(skills),
            "categories": [primary] if rng.random() < 0.7 else [],
            "types": ["INTERNSHIP"] if rng.random() < 0.6 else [],
        }
        history = [[interest if rng.random() < 0.7 else rng.choice(names)] for _ in range(rng.randint(0, 5))]
        candidates = [job for job in job_list if skills & set(job["skills"])]
        if len(candidates) < 5:
            continue
        for job in rng.sample(candidates, min(shown, len(candidates))):
            features = ranker_features(student, job, history, apps30[job["company"]])
            utility = (2.4 * features[0] + 1.0 * features[1] + 0.9 * features[4]
                       + 1.6 * (1.0 if interest in job["categories"] else 0.0) + 0.5 * features[6]
                       + 0.55 * popularity[job["company"]] - 0.025 * job["days_since_published"] - 3.4)
            rows.append(features)
            labels.append(1 if rng.random() < 1 / (1 + math.exp(-utility)) else 0)
            groups.append(s)
        students_of.append(s)
    return np.array(rows), np.array(labels), np.array(groups)


def ndcg_at(scores, labels, k):
    order = np.argsort(-scores, kind="stable")[:k]
    gains = labels[order] / np.log2(np.arange(2, len(order) + 2))
    ideal = np.sort(labels)[::-1][:k] / np.log2(np.arange(2, min(k, len(labels)) + 2))
    return gains.sum() / ideal.sum() if ideal.sum() > 0 else None


def evaluate(scores, labels, groups):
    ndcg5, ndcg10, p5 = [], [], []
    for g in np.unique(groups):
        mask = groups == g
        if labels[mask].sum() == 0:
            continue
        ndcg5.append(ndcg_at(scores[mask], labels[mask], 5))
        ndcg10.append(ndcg_at(scores[mask], labels[mask], 10))
        top = np.argsort(-scores[mask], kind="stable")[:5]
        p5.append(labels[mask][top].mean())
    return {"ndcg@5": float(np.mean(ndcg5)), "ndcg@10": float(np.mean(ndcg10)), "precision@5": float(np.mean(p5)),
            "students": len(ndcg5)}


def per_student_ndcg(scores, labels, groups, k=5):
    values = {}
    for g in np.unique(groups):
        mask = groups == g
        if labels[mask].sum() > 0:
            values[g] = ndcg_at(scores[mask], labels[mask], k)
    return values


def bootstrap_gain(model_scores, base_scores, labels, groups, rounds=2000):
    """Paired bootstrap over students: 95% interval of NDCG@5(model) - NDCG@5(baseline)."""
    a = per_student_ndcg(model_scores, labels, groups)
    b = per_student_ndcg(base_scores, labels, groups)
    keys = sorted(a)
    diff = np.array([a[k] - b[k] for k in keys])
    rng = np.random.default_rng(SEED)
    samples = [diff[rng.integers(0, len(diff), len(diff))].mean() for _ in range(rounds)]
    return {"mean": float(diff.mean()), "ci95": [float(np.percentile(samples, 2.5)), float(np.percentile(samples, 97.5))]}


def train_lgbm(x_train, y_train, x_valid, y_valid, features):
    params = {"objective": "binary", "learning_rate": 0.05, "num_leaves": 15, "min_data_in_leaf": 40,
              "feature_fraction": 0.9, "bagging_fraction": 0.9, "bagging_freq": 1, "lambda_l2": 1.0,
              "verbose": -1, "seed": SEED, "deterministic": True, "force_row_wise": True}
    train = lgb.Dataset(x_train, y_train, feature_name=features)
    valid = lgb.Dataset(x_valid, y_valid, feature_name=features, reference=train)
    return lgb.train(params, train, num_boost_round=400, valid_sets=[valid],
                     callbacks=[lgb.early_stopping(30, verbose=False)])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", help="CSV exported from real events (features..., label, group)")
    args = parser.parse_args()
    rng = random.Random(SEED)
    if args.data:
        raw = np.genfromtxt(args.data, delimiter=",", skip_header=1)
        x, y, groups, source = raw[:, :-2], raw[:, -2].astype(int), raw[:, -1].astype(int), "real"
    else:
        x, y, groups = simulate(rng)
        source = "simulated"

    ids = np.unique(groups)
    np.random.default_rng(SEED).shuffle(ids)
    test_ids, valid_ids = set(ids[: len(ids) // 5]), set(ids[len(ids) // 5: len(ids) // 5 + len(ids) // 10])
    test = np.array([g in test_ids for g in groups])
    valid = np.array([g in valid_ids for g in groups])
    train = ~test & ~valid

    rule = RANKER_FEATURES.index("rule_score")
    results = {"random": evaluate(np.random.default_rng(SEED).random(test.sum()), y[test], groups[test]),
               "rule_formula": evaluate(x[test, rule], y[test], groups[test])}

    scaler = StandardScaler().fit(x[train])
    logistic = LogisticRegression(max_iter=2000).fit(scaler.transform(x[train]), y[train])
    results["logistic_regression"] = evaluate(logistic.predict_proba(scaler.transform(x[test]))[:, 1], y[test], groups[test])

    booster = train_lgbm(x[train], y[train], x[valid], y[valid], RANKER_FEATURES)
    results["lightgbm"] = evaluate(booster.predict(x[test]), y[test], groups[test])

    # Pick the deployed model on the validation split, never on the test split.
    valid_scores = {
        "logistic_regression": evaluate(logistic.predict_proba(scaler.transform(x[valid]))[:, 1], y[valid], groups[valid]),
        "lightgbm": evaluate(booster.predict(x[valid]), y[valid], groups[valid]),
    }
    chosen = max(valid_scores, key=lambda name: valid_scores[name]["ndcg@5"])
    chosen_test = (booster.predict(x[test]) if chosen == "lightgbm"
                   else logistic.predict_proba(scaler.transform(x[test]))[:, 1])
    significance = {
        "lightgbm_vs_rule": bootstrap_gain(booster.predict(x[test]), x[test, rule], y[test], groups[test]),
        "logistic_vs_rule": bootstrap_gain(logistic.predict_proba(scaler.transform(x[test]))[:, 1], x[test, rule], y[test], groups[test]),
        "lightgbm_vs_logistic": bootstrap_gain(booster.predict(x[test]), logistic.predict_proba(scaler.transform(x[test]))[:, 1], y[test], groups[test]),
    }

    ablation = {}
    for name, drop in {"without_history": ["history_category_share"], "without_popularity": ["company_popularity"],
                       "without_freshness": ["days_since_published", "days_to_deadline"]}.items():
        keep = [i for i, f in enumerate(RANKER_FEATURES) if f not in drop]
        model = train_lgbm(x[train][:, keep], y[train], x[valid][:, keep], y[valid], [RANKER_FEATURES[i] for i in keep])
        ablation[name] = evaluate(model.predict(x[test][:, keep]), y[test], groups[test])

    importance = dict(zip(RANKER_FEATURES, booster.feature_importance("gain").round(1).tolist()))
    meta = {"name": "job-ranker", "version": f"{source}-{SEED}-{chosen}", "trainedOn": source,
            "rows": int(train.sum()), "positiveRate": round(float(y.mean()), 4), "test": results[chosen]}
    write(MODEL_PATH, gbdt_json(booster, RANKER_FEATURES, meta) if chosen == "lightgbm"
          else logistic_json(scaler, logistic, RANKER_FEATURES, meta))

    os.makedirs(REPORT_DIR, exist_ok=True)
    report = {"source": source, "rows": int(len(y)), "students": int(len(ids)), "positive_rate": float(y.mean()),
              "trees": booster.num_trees(), "results": results, "validation": valid_scores, "deployed": chosen,
              "significance_ndcg@5": significance, "ablation_lightgbm": ablation,
              "feature_importance_gain": importance,
              "logistic_coefficients": dict(zip(RANKER_FEATURES, np.round(logistic.coef_[0], 3).tolist()))}
    with open(os.path.join(REPORT_DIR, "ranker-metrics.json"), "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    plot(results, importance)

    # Parity cases: Java must turn the same raw inputs into the same features and probabilities.
    predict = (lambda rows: booster.predict(rows)) if chosen == "lightgbm" else (
        lambda rows: logistic.predict_proba(scaler.transform(rows))[:, 1])
    cases = []
    for raw in parity_inputs():
        features = ranker_features(raw["student"], raw["job"], raw["history"], raw["company_apps_30d"])
        cases.append({**raw, "features": features, "probability": float(predict(np.array([features]))[0])})
    write(os.path.join(ROOT, "backend", "src", "test", "resources", "ml", "job-ranker-cases.json"), {"cases": cases})
    print(json.dumps({k: v for k, v in report.items() if k in ("deployed", "validation", "significance_ndcg@5")}, indent=1))


def parity_inputs():
    job = lambda skills, required, cats, kind, published, deadline: {
        "skills": skills, "required": {s: s in required for s in skills}, "categories": cats, "type": kind,
        "days_since_published": published, "days_to_deadline": deadline}
    student = lambda skills, cats, types: {"skills": skills, "categories": cats, "types": types}
    return [
        {"student": student(["java", "spring", "sql"], ["software"], ["INTERNSHIP"]),
         "job": job(["java", "spring", "docker"], ["java", "spring"], ["software"], "INTERNSHIP", 3, 40),
         "history": [["software"], ["data"]], "company_apps_30d": 12},
        {"student": student(["python"], [], []), "job": job(["python", "sql"], ["sql"], ["data", "software"], "FRESHER", 120, 200),
         "history": [], "company_apps_30d": 0},
        {"student": student(["react", "css", "git", "testing"], ["frontend"], ["PART_TIME", "INTERNSHIP"]),
         "job": job(["react", "typescript"], [], ["frontend"], "FULL_TIME", 0, 2), "history": [["frontend"]] * 3,
         "company_apps_30d": 140},
        {"student": student(["linux"], ["devops"], ["INTERNSHIP"]), "job": job([], [], ["devops"], "INTERNSHIP", 10, 10),
         "history": [["security"]], "company_apps_30d": 4},
    ]


def plot(results, importance):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    names = ["random", "rule_formula", "logistic_regression", "lightgbm"]
    labels = ["Ngẫu nhiên", "Công thức cũ", "Logistic Regression", "LightGBM"]
    fig, ax = plt.subplots(figsize=(7, 3.6))
    ax.bar(labels, [results[n]["ndcg@5"] for n in names], color=["#cbd5e1", "#8fb8f5", "#5a8fd6", "#063b7a"])
    ax.set_ylabel("NDCG@5 (tập kiểm tra)")
    ax.set_ylim(0, 1)
    for i, n in enumerate(names):
        ax.text(i, results[n]["ndcg@5"] + 0.02, f"{results[n]['ndcg@5']:.3f}", ha="center")
    fig.tight_layout()
    fig.savefig(os.path.join(REPORT_DIR, "ranker-ndcg.png"), dpi=150)
    fig, ax = plt.subplots(figsize=(7, 4))
    items = sorted(importance.items(), key=lambda kv: kv[1])
    ax.barh([k for k, _ in items], [v for _, v in items], color="#063b7a")
    ax.set_xlabel("Mức đóng góp (gain)")
    fig.tight_layout()
    fig.savefig(os.path.join(REPORT_DIR, "ranker-importance.png"), dpi=150)


if __name__ == "__main__":
    main()
