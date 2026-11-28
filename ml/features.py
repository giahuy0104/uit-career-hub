"""Feature definitions shared by training and the Java runtime.

Java mirrors these functions in vn.edu.uit.careerhub.ml (JobRankingFeatures, InternshipRiskFeatures).
`export_parity_cases` writes fixtures that a Java test replays, so both sides stay identical.
"""
import math
import re

RANKER_FEATURES = [
    "req_skill_ratio",        # required skills of the job the student has / required skills
    "opt_skill_ratio",        # same for nice-to-have skills
    "skill_jaccard",          # |student skills ∩ job skills| / |union|
    "job_skill_count",
    "category_match",         # 1 if a preferred category is among the job's categories
    "has_category_pref",
    "type_match",             # 1 if the job's opportunity type is preferred
    "has_type_pref",
    "days_since_published",   # capped at 90
    "days_to_deadline",       # capped at 120
    "company_popularity",     # ln(1 + applications to the company's jobs in the last 30 days)
    "history_category_share", # share of the student's past applications that share a category with the job
    "student_skill_count",
    "rule_score",             # the hand-written formula (0-1), kept as a feature and as the baseline
]

RISK_FEATURES = [
    "submit_ratio",           # submitted weeks / weeks that are due
    "late_ratio",             # late submissions / submitted weeks
    "revision_ratio",         # weeks the company sent back / submitted weeks
    "avg_words",              # mean words of work summary + outcomes, capped at 300
    "words_trend",            # (mean of last 2 weeks - mean of first 2) / (mean of first 2 + 10); 0 if < 4 weeks
    "max_repeat",             # highest token Jaccard between consecutive weeks' work summaries
    "difficulty_ratio",       # weeks whose "difficulties" has >= 8 words / submitted weeks
    "days_since_last",        # days since the last submission (or since start), capped at 30
    "plan_revisions",         # revision requests on the plan, capped at 5
]

TOKEN = re.compile(r"\w+", re.UNICODE)


def tokens(text):
    return TOKEN.findall((text or "").lower())


def clamp(value, low, high):
    return max(low, min(high, value))


def rule_score(student, job):
    """Same formula as JobMatchScorer: skills 70 (50 required + 20 optional), category 20, type 10."""
    owned = set(student["skills"])
    required = [s for s in job["skills"] if job["required"].get(s, True)]
    optional = [s for s in job["skills"] if not job["required"].get(s, True)]
    ratio = lambda items: (sum(1 for s in items if s in owned) / len(items)) if items else 0.0
    criteria = []
    if required or not optional:
        weight = 70 if not optional else 50
        criteria.append((weight, weight * ratio(required)))
    if optional:
        weight = 70 if not required else 20
        criteria.append((weight, weight * ratio(optional)))
    if student["categories"]:
        criteria.append((20, 20 if set(student["categories"]) & set(job["categories"]) else 0))
    if student["types"]:
        criteria.append((10, 10 if job["type"] in student["types"] else 0))
    total = sum(w for w, _ in criteria)
    # Java's Math.round rounds half up; Python's round() would round half to even.
    return math.floor(100 * sum(e for _, e in criteria) / total + 0.5) / 100


def ranker_features(student, job, history, company_apps_30d):
    """student: skills, categories, types; job: skills, required{skill: bool}, categories, type,
    days_since_published, days_to_deadline; history: list of category sets of past applications."""
    owned = set(student["skills"])
    skills = set(job["skills"])
    required = [s for s in job["skills"] if job["required"].get(s, True)]
    optional = [s for s in job["skills"] if not job["required"].get(s, True)]
    req = sum(1 for s in required if s in owned) / len(required) if required else 0.0
    opt = sum(1 for s in optional if s in owned) / len(optional) if optional else 0.0
    union = owned | skills
    jaccard = len(owned & skills) / len(union) if union else 0.0
    cats = set(job["categories"])
    shared = sum(1 for past in history if set(past) & cats) / len(history) if history else 0.0
    return [
        req, opt, jaccard, float(len(skills)),
        1.0 if set(student["categories"]) & cats else 0.0, 1.0 if student["categories"] else 0.0,
        1.0 if job["type"] in student["types"] else 0.0, 1.0 if student["types"] else 0.0,
        float(clamp(job["days_since_published"], 0, 90)), float(clamp(job["days_to_deadline"], 0, 120)),
        math.log1p(company_apps_30d), shared, float(len(owned)), rule_score(student, job),
    ]


def risk_features(weeks, days_since_last, plan_revisions):
    """weeks: ordered due weeks, each {submitted, late, revised, work_summary, outcomes, difficulties}."""
    due = len(weeks)
    submitted = [w for w in weeks if w["submitted"]]
    n = len(submitted)
    words = [min(300, len(tokens(w["work_summary"])) + len(tokens(w["outcomes"]))) for w in submitted]
    avg_words = sum(words) / n if n else 0.0
    trend = 0.0
    if n >= 4:
        first = (words[0] + words[1]) / 2
        last = (words[-1] + words[-2]) / 2
        trend = (last - first) / (first + 10)
    repeat = 0.0
    for a, b in zip(submitted, submitted[1:]):
        ta, tb = set(tokens(a["work_summary"])), set(tokens(b["work_summary"]))
        if ta | tb:
            repeat = max(repeat, len(ta & tb) / len(ta | tb))
    return [
        n / due if due else 1.0,
        sum(1 for w in submitted if w["late"]) / n if n else 0.0,
        sum(1 for w in submitted if w["revised"]) / n if n else 0.0,
        avg_words, trend, repeat,
        sum(1 for w in submitted if len(tokens(w["difficulties"])) >= 8) / n if n else 0.0,
        float(clamp(days_since_last, 0, 30)), float(clamp(plan_revisions, 0, 5)),
    ]
