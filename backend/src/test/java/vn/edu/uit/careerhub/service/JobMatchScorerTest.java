package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Set;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.entity.JobMatch;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.entity.NamedRef;
import vn.edu.uit.careerhub.enums.OpportunityType;
import vn.edu.uit.careerhub.service.JobMatchScorer.Skill;

class JobMatchScorerTest {
    private final NamedRef java = new NamedRef(UUID.randomUUID(), "Java");
    private final NamedRef sql = new NamedRef(UUID.randomUUID(), "PostgreSQL");
    private final NamedRef react = new NamedRef(UUID.randomUUID(), "React");
    private final NamedRef software = new NamedRef(UUID.randomUUID(), "Kỹ thuật phần mềm");

    private Skill required(NamedRef ref) { return new Skill(ref.id(), ref.name(), true); }
    private Skill optional(NamedRef ref) { return new Skill(ref.id(), ref.name(), false); }
    private JobPreferences student(List<NamedRef> skills) { return new JobPreferences(skills, List.of(software), List.of(OpportunityType.INTERNSHIP)); }

    @Test void everythingMatchingScoresOneHundred() {
        JobMatch match = JobMatchScorer.score(student(List.of(java, react)), List.of(required(java), optional(react)),
                Set.of(software.id()), "INTERNSHIP");

        assertThat(match.score()).isEqualTo(100);
        assertThat(match.matchedSkills()).containsExactly("Java", "React");
        assertThat(match.missingSkills()).isEmpty();
    }

    @Test void weightsAreFiftyTwentyTwentyTen() {
        // 1 of 2 required = 25, optional = 0, category = 20, type = 0
        JobMatch match = JobMatchScorer.score(student(List.of(java)), List.of(required(java), required(sql), optional(react)),
                Set.of(software.id()), "FULL_TIME");

        assertThat(match.score()).isEqualTo(45);
        assertThat(match.missingSkills()).containsExactly("PostgreSQL");
        assertThat(match.optionalSkills()).containsExactly("React");
    }

    @Test void aJobListingOnlyOneKindOfSkillGivesItAllSkillPoints() {
        assertThat(JobMatchScorer.score(student(List.of(java)), List.of(required(java)), Set.of(), "FULL_TIME").score()).isEqualTo(70);
        assertThat(JobMatchScorer.score(student(List.of(java)), List.of(optional(java)), Set.of(), "FULL_TIME").score()).isEqualTo(70);
    }

    @Test void preferencesLeftEmptyAreNotCounted() {
        JobPreferences onlySkills = new JobPreferences(List.of(java), List.of(), List.of());

        assertThat(JobMatchScorer.score(onlySkills, List.of(required(java)), Set.of(), "INTERNSHIP").score()).isEqualTo(100);
    }

    @Test void aJobWithoutSkillTagsCannotScoreHigh() {
        JobMatch match = JobMatchScorer.score(student(List.of(java)), List.of(), Set.of(software.id()), "INTERNSHIP");

        assertThat(match.score()).isEqualTo(30);
    }

    @Test void aJobIsOnlyRecommendedWhenAtLeastOneSkillMatches() {
        JobMatch noSkill = JobMatchScorer.score(student(List.of(java)), List.of(required(react)), Set.of(software.id()), "INTERNSHIP");
        JobMatch oneSkill = JobMatchScorer.score(student(List.of(java)), List.of(required(react), optional(java)), Set.of(), "FULL_TIME");

        assertThat(JobMatchScorer.worthRecommending(noSkill)).isFalse();
        assertThat(JobMatchScorer.worthRecommending(oneSkill)).isTrue();
    }
}
