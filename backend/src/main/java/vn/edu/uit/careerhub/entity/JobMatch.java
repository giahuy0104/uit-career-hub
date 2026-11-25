package vn.edu.uit.careerhub.entity;

import java.util.List;

/**
 * How well one job fits a student.
 *
 * @param score          0-100
 * @param matchedSkills  skills of the job the student has
 * @param missingSkills  required skills the student does not have
 * @param optionalSkills nice-to-have skills the student does not have
 */
public record JobMatch(int score, List<Criterion> criteria, List<String> matchedSkills, List<String> missingSkills,
        List<String> optionalSkills) {

    /** One line of the score: {@code earned} out of {@code weight} points. */
    public record Criterion(String key, int weight, double earned) {}
}
