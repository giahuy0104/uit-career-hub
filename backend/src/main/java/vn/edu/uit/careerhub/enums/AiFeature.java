package vn.edu.uit.careerhub.enums;

/** Every AI capability in the system. LLM / EMBEDDING ones call Gemini; MODEL ones run a trained model in the backend. */
public enum AiFeature {
    /** AI1: feedback on a student's plan draft before submission. */
    PLAN_REVIEW(Kind.LLM),
    /** AI2: summary of submitted weekly logs for company and UIT reviewers. */
    WEEKLY_LOG_SUMMARY(Kind.LLM),
    /** AI3: explanation of the jobs the system ranked for a student. */
    JOB_MATCH(Kind.LLM),
    /** Learned ranking of recommended jobs (falls back to the formula when off). */
    JOB_RANKER(Kind.MODEL),
    /** Early warning for internships at risk. */
    INTERNSHIP_RISK(Kind.MODEL),
    /** Suggested skills and categories while a company writes a job post (embeddings + trained scorer). */
    SKILL_SUGGEST(Kind.EMBEDDING),
    /** Students search jobs by meaning (embeddings mixed with keywords). */
    SEMANTIC_SEARCH(Kind.EMBEDDING);

    /** LLM and EMBEDDING call Gemini and can have a per-user daily limit; MODEL runs only in the backend. */
    public enum Kind { LLM, MODEL, EMBEDDING }

    private final Kind kind;

    AiFeature(Kind kind) { this.kind = kind; }

    public Kind kind() { return kind; }
}
