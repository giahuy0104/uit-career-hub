package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.JobEventRequest;
import vn.edu.uit.careerhub.dto.request.JobPreferencesRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.entity.AiJobMatchEntry;
import vn.edu.uit.careerhub.entity.JobMatch;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.entity.NamedRef;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.ml.JobRankingFeatures;
import vn.edu.uit.careerhub.ml.MlModel;
import vn.edu.uit.careerhub.ml.MlModels;
import vn.edu.uit.careerhub.repository.AiRepository;
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
    static final ZoneId VIETNAM = ZoneId.of("Asia/Ho_Chi_Minh");
    /** Features a student can act on or recognise; the rest still count but are not shown as reasons. */
    static final Set<String> SHOWN_FACTORS = Set.of("req_skill_ratio", "opt_skill_ratio", "skill_jaccard", "category_match",
            "type_match", "days_since_published", "days_to_deadline", "company_popularity", "history_category_share");

    private final JobPreferenceRepository preferences;
    private final JobRepository jobs;
    private final StudentProfileRepository profiles;
    private final AuditRepository audit;
    private final AiAssistantService ai;
    private final MlModels models;
    private final AiRepository aiSettings;

    public JobRecommendationService(JobPreferenceRepository preferences, JobRepository jobs, StudentProfileRepository profiles,
            AuditRepository audit, AiAssistantService ai, MlModels models, AiRepository aiSettings) {
        this.preferences = preferences;
        this.jobs = jobs;
        this.profiles = profiles;
        this.audit = audit;
        this.ai = ai;
        this.models = models;
        this.aiSettings = aiSettings;
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
        MlModel model = ranker();
        result.put("ranking", model == null ? "RULE" : "MODEL");
        result.put("model", model == null ? null : model.describe());
        result.put("items", rank(principal.studentProfileId(), student).stream().map(item -> {
            Map<String, Object> view = new LinkedHashMap<>();
            view.put("job", item.job());
            view.put("score", item.probability() == null ? item.match().score() : (int) Math.round(100 * item.probability()));
            view.put("ruleScore", item.match().score());
            view.put("factors", item.factors());
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

    public void recordEvent(AuthPrincipal principal, JobEventRequest input) {
        if (jobs.recordEvent(principal.studentProfileId(), input.jobId(), input.type().name(), input.source().name(),
                input.position(), input.modelVersion()) == 0) {
            throw new AppException(ErrorType.NOT_FOUND, "JOB_NOT_FOUND", "Không tìm thấy tin tuyển dụng.");
        }
    }

    private List<Ranked> rank(UUID studentProfileId, JobPreferences student) {
        if (student.skills().isEmpty()) return List.of();
        List<Ranked> candidates = jobs.recruitingNotAppliedBy(studentProfileId).stream()
                .map(job -> new Ranked(job, JobMatchScorer.score(student, JobMatchScorer.skills(job),
                        JobMatchScorer.categoryIds(job), job.get("opportunityType").toString()), null, List.of()))
                .filter(item -> JobMatchScorer.worthRecommending(item.match())).toList();
        MlModel model = ranker();
        if (model == null || candidates.isEmpty()) {
            return candidates.stream().sorted(Comparator.comparingInt((Ranked item) -> -item.match().score())
                    .thenComparing(item -> text(item, "deadline")).thenComparing(item -> text(item, "id")))
                    .limit(MAX_RECOMMENDATIONS).toList();
        }
        LocalDate today = LocalDate.now(VIETNAM);
        List<Set<String>> history = jobs.applicationCategories(studentProfileId);
        Map<UUID, Long> popularity = jobs.companyApplications30d();
        Set<String> skills = ids(student.skills());
        Set<String> categories = ids(student.categories());
        Set<String> types = student.opportunityTypes().stream().map(Enum::name).collect(Collectors.toSet());
        return candidates.stream().map(item -> {
            double[] features = features(item, skills, categories, types, history, popularity, today);
            List<Map<String, Object>> factors = model.topFactors(features, features.length).stream()
                    .filter(factor -> SHOWN_FACTORS.contains(factor.feature())).limit(3)
                    .map(factor -> Map.<String, Object>of("feature", factor.feature(), "value", factor.value())).toList();
            return new Ranked(item.job(), item.match(), model.probability(features), factors);
        }).sorted(Comparator.comparingDouble((Ranked item) -> -item.probability())
                .thenComparing(item -> text(item, "deadline")).thenComparing(item -> text(item, "id")))
                .limit(MAX_RECOMMENDATIONS).toList();
    }

    /** The learned ranker, unless UIT switched it off (then the formula ranks). */
    private MlModel ranker() {
        return models.jobRanker().filter(model -> aiSettings.featureEnabled(AiFeature.JOB_RANKER)).orElse(null);
    }

    static double[] features(Ranked item, Set<String> skills, Set<String> categories, Set<String> types,
            List<Set<String>> history, Map<UUID, Long> popularity, LocalDate today) {
        Map<String, Object> job = item.job();
        List<JobRankingFeatures.JobSkill> jobSkills = JobMatchScorer.skills(job).stream()
                .map(skill -> new JobRankingFeatures.JobSkill(skill.id().toString(), skill.required())).toList();
        Set<String> jobCategories = JobMatchScorer.categoryIds(job).stream().map(UUID::toString).collect(Collectors.toSet());
        Object published = job.get("reviewedAt") != null ? job.get("reviewedAt") : job.get("createdAt");
        LocalDate publishedOn = published == null ? today : OffsetDateTime.parse(published.toString()).atZoneSameInstant(VIETNAM).toLocalDate();
        UUID company = UUID.fromString(((Map<?, ?>) job.get("company")).get("id").toString());
        return JobRankingFeatures.compute(skills, categories, types, jobSkills, jobCategories, job.get("opportunityType").toString(),
                ChronoUnit.DAYS.between(publishedOn, today), ChronoUnit.DAYS.between(today, LocalDate.parse(job.get("deadline").toString())),
                history, popularity.getOrDefault(company, 0L), item.match().score() / 100.0);
    }

    private static Set<String> ids(List<NamedRef> refs) {
        Set<String> result = new HashSet<>();
        refs.forEach(ref -> result.add(ref.id().toString()));
        return result;
    }

    private static String text(Ranked item, String key) { return item.job().get(key).toString(); }

    record Ranked(Map<String, Object> job, JobMatch match, Double probability, List<Map<String, Object>> factors) {}
}
