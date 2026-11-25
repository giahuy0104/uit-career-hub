package vn.edu.uit.careerhub.service;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.JobPreferencesRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.entity.AiJobMatchEntry;
import vn.edu.uit.careerhub.entity.JobMatch;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.JobPreferenceRepository;
import vn.edu.uit.careerhub.repository.JobRepository;
import vn.edu.uit.careerhub.repository.StudentProfileRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/** AI3: jobs that fit a student. The ranking never depends on the AI; the AI only explains it on request. */
@Service
public class JobRecommendationService {
    static final int MAX_RECOMMENDATIONS = 10;
    static final int MAX_EXPLAINED = 5;

    private final JobPreferenceRepository preferences;
    private final JobRepository jobs;
    private final StudentProfileRepository profiles;
    private final AuditRepository audit;
    private final AiAssistantService ai;

    public JobRecommendationService(JobPreferenceRepository preferences, JobRepository jobs, StudentProfileRepository profiles,
            AuditRepository audit, AiAssistantService ai) {
        this.preferences = preferences;
        this.jobs = jobs;
        this.profiles = profiles;
        this.audit = audit;
        this.ai = ai;
    }

    public Map<String, Object> taxonomyOptions() {
        return Map.of("skills", preferences.activeSkills(), "categories", preferences.activeCategories());
    }

    public JobPreferences preferences(AuthPrincipal principal) { return preferences.find(principal.studentProfileId()); }

    @Transactional
    public JobPreferences savePreferences(AuthPrincipal principal, JobPreferencesRequest input, RequestMetadata request) {
        profiles.lock(principal.studentProfileId());
        if (!jobs.referencesValid("skills", input.skillIds()) || !jobs.referencesValid("categories", input.categoryIds())) {
            throw new AppException(ErrorType.INVALID_INPUT, "JOB_PREFERENCE_REFERENCE_INVALID",
                    "Có kỹ năng hoặc nhóm ngành không còn hoạt động. Vui lòng tải lại danh sách.");
        }
        preferences.replace(principal.studentProfileId(), input.skillIds(), input.categoryIds(), input.opportunityTypes());
        audit.record(principal.userId(), "STUDENT_JOB_PREFERENCES_UPDATED", "STUDENT_PROFILE", principal.studentProfileId(),
                Map.of("skills", input.skillIds().size(), "categories", input.categoryIds().size(),
                        "opportunityTypes", input.opportunityTypes().size()), request);
        return preferences.find(principal.studentProfileId());
    }

    public Map<String, Object> recommendations(AuthPrincipal principal) {
        JobPreferences student = preferences.find(principal.studentProfileId());
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("needsSkills", student.skills().isEmpty());
        result.put("items", rank(principal.studentProfileId(), student).stream().map(item -> {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("job", item.job());
            view.put("score", item.match().score());
            view.put("criteria", item.match().criteria());
            view.put("matchedSkills", item.match().matchedSkills());
            view.put("missingSkills", item.match().missingSkills());
            view.put("optionalSkills", item.match().optionalSkills());
            return view;
        }).toList());
        return result;
    }

    public AiSuggestion explain(AuthPrincipal principal) {
        JobPreferences student = preferences.find(principal.studentProfileId());
        List<AiJobMatchEntry> entries = rank(principal.studentProfileId(), student).stream().limit(MAX_EXPLAINED)
                .map(item -> new AiJobMatchEntry(UUID.fromString(text(item, "id")), text(item, "title"), text(item, "description"),
                        text(item, "requirements"), item.match().matchedSkills(), item.match().missingSkills())).toList();
        return ai.explainJobMatches(principal, student, entries);
    }

    private List<Ranked> rank(UUID studentProfileId, JobPreferences student) {
        if (student.skills().isEmpty()) return List.of();
        return jobs.recruitingNotAppliedBy(studentProfileId).stream()
                .map(job -> new Ranked(job, JobMatchScorer.score(student, JobMatchScorer.skills(job),
                        JobMatchScorer.categoryIds(job), job.get("opportunityType").toString())))
                .filter(item -> JobMatchScorer.worthRecommending(item.match()))
                .sorted(Comparator.comparingInt((Ranked item) -> -item.match().score())
                        .thenComparing(item -> text(item, "deadline")).thenComparing(item -> text(item, "id")))
                .limit(MAX_RECOMMENDATIONS).toList();
    }

    private static String text(Ranked item, String key) { return item.job().get(key).toString(); }

    private record Ranked(Map<String, Object> job, JobMatch match) {}
}
