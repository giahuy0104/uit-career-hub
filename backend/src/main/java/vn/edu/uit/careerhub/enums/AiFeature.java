package vn.edu.uit.careerhub.enums;

/** Every AI capability in the system. LLM ones call Gemini; MODEL ones run a trained model in the backend. */
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
    INTERNSHIP_RISK(Kind.MODEL);

    public enum Kind { LLM, MODEL }

    private final Kind kind;

    AiFeature(Kind kind) { this.kind = kind; }

    public Kind kind() { return kind; }
}
