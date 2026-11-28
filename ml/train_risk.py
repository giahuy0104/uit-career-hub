"""Early warning: which interns are likely to end badly (low company rating, not recommended, or not finished).

Data is simulated at the feature level from a hidden "diligence" and "needs support" per student,
because the system has no finished internships yet. Retrain with --data on real exports later.
Baseline = what UIT sees today: the share of weekly logs not submitted on time.

Usage: ml/.venv/Scripts/python ml/train_risk.py
"""
import argparse
import json
import math
import os
import sys

import lightgbm as lgb
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, roc_auc_score
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, os.path.dirname(__file__))
from export_model import gbdt_json, logistic_json, write  # noqa: E402
from features import RISK_FEATURES, risk_features  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MIN_SUBMITTED_WEEKS = 2   # below this the backend reports "not enough data" instead of a score
MODEL_PATH = os.path.join(ROOT, "backend", "src", "main", "resources", "ml", "internship-risk.json")
REPORT_DIR = os.path.join(ROOT, "ml", "reports")
SEED = 20261128


def sigmoid(value):
    return 1 / (1 + math.exp(-value))


def simulate(rng, placements=2400):
    rows, labels = [], []
    for _ in range(placements):
        diligence = rng.normal()
        support = rng.normal()
        due = int(rng.integers(2, 9))
        submit = sigmoid(1.6 + 1.5 * diligence)
        late = sigmoid(-1.4 - 1.1 * diligence)
        revise = sigmoid(-1.7 - 0.9 * diligence)
        words = []
        submitted = [rng.random() < submit for _ in range(due)]
        n = sum(submitted)
        for week in range(n):
            # Real logs in the demo data have about 15-30 words (summary + outcomes), so the simulation stays there.
            drift = -2.5 * week if diligence < -0.5 else 0.8 * week
            words.append(float(np.clip(rng.normal(26 + 9 * diligence + drift, 7), 2, 300)))
        avg = float(np.mean(words)) if words else 0.0
        trend = 0.0
        if n >= 4:
            first, last = (words[0] + words[1]) / 2, (words[-1] + words[-2]) / 2
            trend = (last - first) / (first + 10)
        repeat = float(np.clip(rng.beta(2, 6) + (0.35 if diligence < -0.7 and rng.random() < 0.6 else 0), 0, 1)) if n >= 2 else 0.0
        difficulty = float(np.mean([rng.random() < sigmoid(-1.0 + 0.9 * support) for _ in range(n)])) if n else 0.0
        days_since = float(np.clip(rng.exponential(4 + 6 * sigmoid(-diligence)), 0, 30))
        plan_revisions = float(min(5, rng.poisson(math.exp(-0.4 - 0.6 * diligence))))
        rows.append([
            n / due, float(np.mean([rng.random() < late for _ in range(n)])) if n else 0.0,
            float(np.mean([rng.random() < revise for _ in range(n)])) if n else 0.0,
            avg, trend, repeat, difficulty, days_since, plan_revisions,
        ])
        labels.append(1 if rng.random() < sigmoid(-1.7 - 1.9 * diligence + 0.5 * support) else 0)
    return np.array(rows), np.array(labels)


def recall_at(scores, labels, share=0.2):
    top = np.argsort(-scores)[: max(1, int(len(scores) * share))]
    return float(labels[top].sum() / max(1, labels.sum()))


def summary(scores, labels):
    return {"auc": float(roc_auc_score(labels, scores)), "pr_auc": float(average_precision_score(labels, scores)),
            "recall@top20%": recall_at(scores, labels)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", help="CSV exported from finished internships (features..., label)")
    args = parser.parse_args()
    rng = np.random.default_rng(SEED)
    if args.data:
        raw = np.genfromtxt(args.data, delimiter=",", skip_header=1)
        x, y, source = raw[:, :-1], raw[:, -1].astype(int), "real"
    else:
        x, y = simulate(rng)
        source = "simulated"
    order = rng.permutation(len(y))
    test, valid, train = order[: len(y) // 5], order[len(y) // 5: len(y) * 3 // 10], order[len(y) * 3 // 10:]

    baseline = 1 - x[:, RISK_FEATURES.index("submit_ratio")]   # today: missing/overdue logs
    results = {"baseline_missing_logs": summary(baseline[test], y[test])}

    scaler = StandardScaler().fit(x[train])
    logistic = LogisticRegression(max_iter=2000, class_weight="balanced").fit(scaler.transform(x[train]), y[train])
    lr_scores = lambda rows: logistic.predict_proba(scaler.transform(rows))[:, 1]
    results["logistic_regression"] = summary(lr_scores(x[test]), y[test])

    params = {"objective": "binary", "learning_rate": 0.05, "num_leaves": 8, "min_data_in_leaf": 40,
              "lambda_l2": 1.0, "verbose": -1, "seed": SEED, "deterministic": True, "force_row_wise": True}
    booster = lgb.train(params, lgb.Dataset(x[train], y[train], feature_name=RISK_FEATURES), num_boost_round=400,
                        valid_sets=[lgb.Dataset(x[valid], y[valid], feature_name=RISK_FEATURES)],
                        callbacks=[lgb.early_stopping(30, verbose=False)])
    results["lightgbm"] = summary(booster.predict(x[test]), y[test])

    validation = {"logistic_regression": roc_auc_score(y[valid], lr_scores(x[valid])),
                  "lightgbm": roc_auc_score(y[valid], booster.predict(x[valid]))}
    chosen = max(validation, key=validation.get)
    score = (lambda rows: booster.predict(rows)) if chosen == "lightgbm" else lr_scores

    # Thresholds from the validation split: HIGH catches the top 15% of risk, MEDIUM the next 20%.
    valid_scores = np.sort(score(x[valid]))[::-1]
    high = float(valid_scores[int(len(valid_scores) * 0.15)])
    medium = float(valid_scores[int(len(valid_scores) * 0.35)])
    flagged = score(x[test]) >= high
    meta = {"name": "internship-risk", "version": f"{source}-{SEED}-{chosen}", "trainedOn": source,
            "rows": int(len(train)), "minSubmittedWeeks": MIN_SUBMITTED_WEEKS, "positiveRate": round(float(y.mean()), 4), "thresholds": {"high": high, "medium": medium},
            "test": results[chosen]}
    write(MODEL_PATH, gbdt_json(booster, RISK_FEATURES, meta) if chosen == "lightgbm"
          else logistic_json(scaler, logistic, RISK_FEATURES, meta))

    report = {"source": source, "rows": int(len(y)), "positive_rate": float(y.mean()), "results": results,
              "validation_auc": validation, "deployed": chosen, "thresholds": meta["thresholds"],
              "high_risk_precision": float(y[test][flagged].mean()) if flagged.any() else None,
              "high_risk_recall": float(y[test][flagged].sum() / max(1, y[test].sum())),
              "logistic_coefficients": dict(zip(RISK_FEATURES, np.round(logistic.coef_[0], 3).tolist()))}
    os.makedirs(REPORT_DIR, exist_ok=True)
    with open(os.path.join(REPORT_DIR, "risk-metrics.json"), "w", encoding="utf-8") as file:
        json.dump(report, file, ensure_ascii=False, indent=2)
    plot(x[test], y[test], baseline[test], lr_scores(x[test]), booster.predict(x[test]))

    # Parity: raw weekly logs -> features -> probability, replayed by the Java test.
    cases = []
    for raw in parity_inputs():
        features = risk_features(raw["weeks"], raw["days_since_last"], raw["plan_revisions"])
        cases.append({**raw, "features": features, "probability": float(score(np.array([features]))[0])})
    write(os.path.join(ROOT, "backend", "src", "test", "resources", "ml", "internship-risk-cases.json"), {"cases": cases})
    print(json.dumps({k: report[k] for k in ("rows", "positive_rate", "results", "validation_auc", "deployed",
                                              "high_risk_precision", "high_risk_recall")}, indent=1))


def parity_inputs():
    week = lambda summary, outcomes="", difficulties="", submitted=True, late=False, revised=False: {
        "submitted": submitted, "late": late, "revised": revised, "work_summary": summary, "outcomes": outcomes,
        "difficulties": difficulties}
    return [
        {"weeks": [], "days_since_last": 3, "plan_revisions": 0},
        {"weeks": [week("Làm quen dự án, cài môi trường.", "Chạy được dự án.")], "days_since_last": 2, "plan_revisions": 1},
        {"weeks": [week("Viết API đăng nhập bằng Spring Boot", "Hoàn thành API, có kiểm thử", "Chưa quen JWT, cần mentor hướng dẫn thêm về bảo mật"),
                   week("Viết API đăng nhập bằng Spring Boot", "Sửa lỗi", late=True, revised=True),
                   week("", submitted=False),
                   week("Fix bug", "ok", late=True)], "days_since_last": 12, "plan_revisions": 2},
        {"weeks": [week("Thiết kế cơ sở dữ liệu cho module báo cáo, viết migration và seed dữ liệu mẫu", "Hoàn thành 3 bảng, review với mentor"),
                   week("Xây dựng API báo cáo theo khoa, ngành; tối ưu truy vấn bằng index", "API chạy dưới 200ms"),
                   week("Viết kiểm thử tích hợp cho API báo cáo và sửa lỗi phân trang", "Đạt 85% coverage"),
                   week("Làm giao diện React cho báo cáo, thêm bộ lọc và xuất CSV", "Demo cho team, được góp ý UI"),
                   week("Hoàn thiện giao diện theo góp ý, viết tài liệu hướng dẫn", "Merge vào nhánh chính")],
         "days_since_last": 1, "plan_revisions": 0},
        {"weeks": [week("Học Docker. Đọc tài liệu!", "Cài được Docker Desktop", "Máy yếu, Docker chạy chậm và hay bị treo khi build image"),
                   week("Học Docker, đọc tài liệu", "Cài được", "Máy vẫn yếu"),
                   week("học docker đọc tài liệu", "", "", late=True)], "days_since_last": 40, "plan_revisions": 9},
    ]


def plot(x, y, baseline, lr, gbdt):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from sklearn.metrics import roc_curve
    fig, ax = plt.subplots(figsize=(5.2, 4.6))
    for name, scores, color in [("Nhật ký thiếu (hiện tại)", baseline, "#8593a6"), ("Logistic Regression", lr, "#063b7a"),
                                ("LightGBM", gbdt, "#16764c")]:
        fpr, tpr, _ = roc_curve(y, scores)
        ax.plot(fpr, tpr, label=f"{name} (AUC {roc_auc_score(y, scores):.3f})", color=color)
    ax.plot([0, 1], [0, 1], "--", color="#cbd5e1")
    ax.set_xlabel("Tỉ lệ báo nhầm")
    ax.set_ylabel("Tỉ lệ phát hiện")
    ax.legend(loc="lower right", fontsize=8)
    fig.tight_layout()
    fig.savefig(os.path.join(REPORT_DIR, "risk-roc.png"), dpi=150)


if __name__ == "__main__":
    main()
