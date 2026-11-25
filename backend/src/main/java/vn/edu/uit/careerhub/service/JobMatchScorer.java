package vn.edu.uit.careerhub.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import vn.edu.uit.careerhub.entity.JobMatch;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.entity.NamedRef;

/**
 * Scores a job for a student with fixed weights, so a score can be explained and reproduced without AI.
 *
 * <p>Skills are worth 70 points (50 required, 20 nice-to-have; a job listing only one kind gives it all
 * 70), preferred category 20, preferred opportunity type 10. Preferences the student left empty are not
 * counted. A job without any skill tag keeps its 70 skill points in the total but earns none of them:
 * there is no evidence that it fits.
 */
final class JobMatchScorer {
    static final int REQUIRED_WEIGHT = 50;
    static final int OPTIONAL_WEIGHT = 20;
    static final int CATEGORY_WEIGHT = 20;
    static final int TYPE_WEIGHT = 10;

    private JobMatchScorer() {}

    record Skill(UUID id, String name, boolean required) {}

    static JobMatch score(JobPreferences student, List<Skill> skills, Set<UUID> categoryIds, String opportunityType) {
        Set<UUID> owned = student.skills().stream().map(NamedRef::id).collect(Collectors.toSet());
        List<Skill> required = skills.stream().filter(Skill::required).toList();
        List<Skill> optional = skills.stream().filter(skill -> !skill.required()).toList();

        List<JobMatch.Criterion> criteria = new ArrayList<>();
        int skillWeight = REQUIRED_WEIGHT + OPTIONAL_WEIGHT;
        if (!required.isEmpty() || optional.isEmpty()) {
            int weight = optional.isEmpty() ? skillWeight : REQUIRED_WEIGHT;
            criteria.add(new JobMatch.Criterion("REQUIRED_SKILLS", weight, weight * ratio(required, owned)));
        }
        if (!optional.isEmpty()) {
            int weight = required.isEmpty() ? skillWeight : OPTIONAL_WEIGHT;
            criteria.add(new JobMatch.Criterion("OPTIONAL_SKILLS", weight, weight * ratio(optional, owned)));
        }
        if (!student.categories().isEmpty()) {
            boolean match = student.categories().stream().anyMatch(category -> categoryIds.contains(category.id()));
            criteria.add(new JobMatch.Criterion("CATEGORY", CATEGORY_WEIGHT, match ? CATEGORY_WEIGHT : 0));
        }
        if (!student.opportunityTypes().isEmpty()) {
            boolean match = student.opportunityTypes().stream().anyMatch(type -> type.name().equals(opportunityType));
            criteria.add(new JobMatch.Criterion("OPPORTUNITY_TYPE", TYPE_WEIGHT, match ? TYPE_WEIGHT : 0));
        }
        double earned = criteria.stream().mapToDouble(JobMatch.Criterion::earned).sum();
        int total = criteria.stream().mapToInt(JobMatch.Criterion::weight).sum();
        return new JobMatch((int) Math.round(100 * earned / total), criteria,
                names(skills, owned, true), names(required, owned, false), names(optional, owned, false));
    }

    /** Sharing a category or opportunity type alone is not a reason to recommend a job. */
    static boolean worthRecommending(JobMatch match) { return !match.matchedSkills().isEmpty(); }

    static List<Skill> skills(Map<String, Object> job) {
        return ((List<?>) job.get("skills")).stream().map(item -> (Map<?, ?>) item)
                .map(item -> new Skill(UUID.fromString(item.get("id").toString()), item.get("name").toString(),
                        Boolean.TRUE.equals(item.get("isRequired")))).toList();
    }

    static Set<UUID> categoryIds(Map<String, Object> job) {
        return ((List<?>) job.get("categories")).stream().map(item -> UUID.fromString(((Map<?, ?>) item).get("id").toString()))
                .collect(Collectors.toSet());
    }

    private static double ratio(List<Skill> skills, Set<UUID> owned) {
        return skills.isEmpty() ? 0 : (double) skills.stream().filter(skill -> owned.contains(skill.id())).count() / skills.size();
    }

    private static List<String> names(List<Skill> skills, Set<UUID> owned, boolean have) {
        return skills.stream().filter(skill -> owned.contains(skill.id()) == have).map(Skill::name).toList();
    }
}
