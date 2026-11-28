package vn.edu.uit.careerhub.ml;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Java twin of ranker_features() in ml/features.py; JobRankingParityTest keeps them identical. */
public final class JobRankingFeatures {
    public static final List<String> NAMES = List.of("req_skill_ratio", "opt_skill_ratio", "skill_jaccard", "job_skill_count",
            "category_match", "has_category_pref", "type_match", "has_type_pref", "days_since_published", "days_to_deadline",
            "company_popularity", "history_category_share", "student_skill_count", "rule_score");

    private JobRankingFeatures() {}

    public record JobSkill(String id, boolean required) {}

    /**
     * @param history        category ids of each job the student applied to before
     * @param ruleScore      JobMatchScorer score divided by 100
     */
    public static double[] compute(Set<String> studentSkills, Set<String> studentCategories, Set<String> studentTypes,
            List<JobSkill> jobSkills, Set<String> jobCategories, String jobType, long daysSincePublished,
            long daysToDeadline, List<Set<String>> history, long companyApplications30d, double ruleScore) {
        List<JobSkill> required = jobSkills.stream().filter(JobSkill::required).toList();
        List<JobSkill> optional = jobSkills.stream().filter(skill -> !skill.required()).toList();
        Set<String> jobSkillIds = new HashSet<>();
        jobSkills.forEach(skill -> jobSkillIds.add(skill.id()));
        Set<String> union = new HashSet<>(studentSkills);
        union.addAll(jobSkillIds);
        Set<String> shared = new HashSet<>(studentSkills);
        shared.retainAll(jobSkillIds);
        long sameCategory = history.stream().filter(past -> past.stream().anyMatch(jobCategories::contains)).count();
        return new double[] {
            ratio(required, studentSkills), ratio(optional, studentSkills),
            union.isEmpty() ? 0 : (double) shared.size() / union.size(), jobSkillIds.size(),
            studentCategories.stream().anyMatch(jobCategories::contains) ? 1 : 0, studentCategories.isEmpty() ? 0 : 1,
            studentTypes.contains(jobType) ? 1 : 0, studentTypes.isEmpty() ? 0 : 1,
            clamp(daysSincePublished, 0, 90), clamp(daysToDeadline, 0, 120), Math.log1p(companyApplications30d),
            history.isEmpty() ? 0 : (double) sameCategory / history.size(), studentSkills.size(), ruleScore,
        };
    }

    private static double ratio(List<JobSkill> skills, Set<String> owned) {
        return skills.isEmpty() ? 0 : (double) skills.stream().filter(skill -> owned.contains(skill.id())).count() / skills.size();
    }

    static double clamp(double value, double low, double high) { return Math.max(low, Math.min(high, value)); }
}
