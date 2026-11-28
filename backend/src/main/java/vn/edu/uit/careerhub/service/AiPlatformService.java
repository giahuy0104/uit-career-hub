package vn.edu.uit.careerhub.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.AiFeatureSettingRequest;
import vn.edu.uit.careerhub.dto.request.AiFeedbackRequest;
import vn.edu.uit.careerhub.entity.AiFeatureSetting;
import vn.edu.uit.careerhub.entity.AiPlacementContext;
import vn.edu.uit.careerhub.entity.AiStoredSuggestion;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.ml.MlModel;
import vn.edu.uit.careerhub.ml.MlModels;
import vn.edu.uit.careerhub.repository.AiRepository;
import vn.edu.uit.careerhub.repository.JobRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/** What every AI feature shares: its own switch and quota, user ratings, and the per-feature dashboard. */
@Service
public class AiPlatformService {
    private final AiRepository repository;
    private final JobRepository jobs;
    private final MlModels models;

    public AiPlatformService(AiRepository repository, JobRepository jobs, MlModels models) {
        this.repository = repository;
        this.jobs = jobs;
        this.models = models;
    }

    public boolean enabled(AiFeature feature) { return repository.featureEnabled(feature); }

    public List<Map<String, Object>> features(int days, List<Map<String, Object>> llmUsage) {
        Map<AiFeature, AiFeatureSetting> settings = repository.featureSettings().stream()
                .collect(Collectors.toMap(AiFeatureSetting::feature, Function.identity()));
        Map<String, Map<String, Object>> usage = llmUsage.stream()
                .collect(Collectors.toMap(row -> row.get("feature").toString(), Function.identity()));
        Map<String, long[]> feedback = repository.feedbackCounts(days);
        List<Map<String, Object>> result = new ArrayList<>();
        for (AiFeature feature : AiFeature.values()) {
            AiFeatureSetting setting = settings.get(feature);
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("feature", feature.name());
            item.put("kind", feature.kind().name());
            item.put("enabled", setting == null || setting.enabled());
            item.put("dailyLimitPerUser", setting == null ? null : setting.dailyLimitPerUser());
            item.put("updatedBy", setting == null ? null : setting.updatedBy());
            item.put("usage", usage.get(feature.name()));
            long[] votes = feedback.getOrDefault(feature.name(), new long[2]);
            item.put("feedback", Map.of("helpful", votes[0], "notHelpful", votes[1]));
            MlModel model = switch (feature) {
                case JOB_RANKER -> models.jobRanker().orElse(null);
                case INTERNSHIP_RISK -> models.internshipRisk().orElse(null);
                default -> null;
            };
            if (model != null) {
                Map<String, Object> info = new LinkedHashMap<>(model.describe());
                info.put("test", model.meta().path("test"));
                info.put("rows", model.meta().path("rows").asLong());
                item.put("model", info);
            }
            if (feature == AiFeature.JOB_RANKER) item.put("online", repository.rankerOnlineStats(days));
            result.add(item);
        }
        return result;
    }

    @Transactional
    public void updateFeature(AuthPrincipal principal, AiFeature feature, AiFeatureSettingRequest input, RequestMetadata request) {
        Integer limit = feature.kind() == AiFeature.Kind.MODEL ? null : input.dailyLimitPerUser();
        repository.updateFeature(feature, input.enabled(), limit, principal.userId(), request);
    }

    /** A user rates only something they were shown: their own suggestion, a job, or (UIT) a placement. */
    public void feedback(AuthPrincipal principal, AiFeedbackRequest input) {
        AiFeature feature = input.feature();
        UUID subject = input.subjectId();
        boolean allowed = switch (feature) {
            case PLAN_REVIEW -> principal.role() == UserRole.STUDENT && suggestion(subject, feature)
                    .flatMap(s -> repository.placement(s.targetId())).map(AiPlacementContext::studentProfileId)
                    .filter(id -> id.equals(principal.studentProfileId())).isPresent();
            case JOB_MATCH -> principal.role() == UserRole.STUDENT && suggestion(subject, feature)
                    .filter(s -> s.targetId().equals(principal.studentProfileId())).isPresent();
            case WEEKLY_LOG_SUMMARY -> suggestion(subject, feature).flatMap(s -> repository.placement(s.targetId()))
                    .filter(p -> principal.role() == UserRole.UIT_ADMIN
                            || principal.role() == UserRole.COMPANY && p.companyId().equals(principal.companyId())).isPresent();
            case JOB_RANKER -> principal.role() == UserRole.STUDENT && jobs.findById(subject).isPresent();
            case INTERNSHIP_RISK -> principal.role() == UserRole.UIT_ADMIN && repository.placement(subject).isPresent();
            case SKILL_SUGGEST, SEMANTIC_SEARCH -> false;   // judged by use (accepted tags, clicks), not by votes
        };
        if (!allowed) throw new AppException(ErrorType.NOT_FOUND, "AI_FEEDBACK_SUBJECT_NOT_FOUND", "Không tìm thấy gợi ý cần đánh giá.");
        repository.saveFeedback(principal.userId(), principal.role(), feature, subject, input.modelVersion(), input.helpful());
    }

    private java.util.Optional<AiStoredSuggestion> suggestion(UUID id, AiFeature feature) {
        return repository.storedSuggestion(id).filter(s -> s.feature().equals(feature.name()));
    }
}
