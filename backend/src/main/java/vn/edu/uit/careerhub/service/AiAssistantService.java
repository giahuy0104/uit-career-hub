package vn.edu.uit.careerhub.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.ai.AiClient;
import vn.edu.uit.careerhub.ai.AiClientException;
import vn.edu.uit.careerhub.ai.AiCompletion;
import vn.edu.uit.careerhub.ai.AiPrompt;
import vn.edu.uit.careerhub.config.AiProperties;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.AiPlanReviewRequest;
import vn.edu.uit.careerhub.dto.response.AiSuggestion;
import vn.edu.uit.careerhub.entity.AiCachedSuggestion;
import vn.edu.uit.careerhub.entity.AiPlacementContext;
import vn.edu.uit.careerhub.entity.AiWeeklyLogEntry;
import vn.edu.uit.careerhub.enums.AiCallStatus;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.enums.InternshipPlanStatus;
import vn.edu.uit.careerhub.enums.PlacementStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AiRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.util.JsonSupport;

/**
 * AI assistant: AI1 (plan feedback for students) and AI2 (weekly log summary for reviewers).
 *
 * <p>Rules from the thesis outline: AI only suggests and never writes to the internship records;
 * it only runs on records the caller may already see; personal data is masked before sending;
 * every call is logged without its content; and when AI is off, slow or failing the caller gets
 * {@code available=false} instead of an error, so the workflow keeps running.
 */
@Service
public class AiAssistantService {
    static final int USAGE_WINDOW_DAYS = 30;

    private final AiRepository repository;
    private final AiClient client;
    private final AiProperties properties;
    private final JsonSupport json;

    public AiAssistantService(AiRepository repository, AiClient client, AiProperties properties, JsonSupport json) {
        this.repository = repository;
        this.client = client;
        this.properties = properties;
        this.json = json;
    }

    /** AI1: feedback on the plan currently in the student's form, before submission. */
    public AiSuggestion reviewPlan(AuthPrincipal principal, UUID placementId, AiPlanReviewRequest input) {
        AiPlacementContext placement = repository.placement(placementId).orElseThrow(this::notFound);
        if (!placement.studentProfileId().equals(principal.studentProfileId())) throw notFound();
        if (placement.placementStatus() == PlacementStatus.COMPLETED || !planEditable(placement.planStatus())) {
            throw new AppException(ErrorType.CONFLICT, "AI_PLAN_REVIEW_NOT_EDITABLE",
                    "Chỉ nhận góp ý AI khi kế hoạch còn là bản nháp hoặc đang cần chỉnh sửa.");
        }
        if (blank(input.objectives()) && blank(input.expectedTasks()) && blank(input.expectedSkills())) {
            throw new AppException(ErrorType.INVALID_INPUT, "AI_PLAN_REVIEW_EMPTY",
                    "Hãy nhập ít nhất mục tiêu, công việc hoặc kỹ năng trước khi nhờ AI góp ý.");
        }
        List<String> known = personalValues(placement);
        AiPrompt prompt = AiPrompts.planReview(PiiMasker.mask(placement.jobTitle(), known),
                PiiMasker.mask(placement.jobDescription(), known), PiiMasker.mask(placement.jobRequirements(), known),
                PiiMasker.mask(input.objectives(), known), PiiMasker.mask(input.expectedTasks(), known),
                PiiMasker.mask(input.expectedSkills(), known));
        return run(principal, AiFeature.PLAN_REVIEW, placementId, prompt, AiPrompts::normalizePlanReview);
    }

    /**
     * AI2: summary of the weekly logs as last submitted, for the host company or UIT staff. A log the
     * company sent back for revision is summarised from its latest submission, not from the edits the
     * student is still making.
     */
    public AiSuggestion summarizeWeeklyLogs(AuthPrincipal principal, UUID placementId) {
        AiPlacementContext placement = repository.placement(placementId).orElseThrow(this::notFound);
        boolean allowed = switch (principal.role()) {
            case COMPANY -> placement.companyId().equals(principal.companyId());
            case UIT_ADMIN -> true;
            case STUDENT -> false;
        };
        if (!allowed) throw notFound();

        List<AiWeeklyLogEntry> logs = repository.lastSubmittedLogs(placementId);
        if (logs.isEmpty()) {
            return unavailable(AiFeature.WEEKLY_LOG_SUMMARY, "NO_DATA", "Sinh viên chưa nộp nhật ký nào để tóm tắt.");
        }
        List<String> known = personalValues(placement);
        List<AiWeeklyLogEntry> masked = logs.stream().map(log -> new AiWeeklyLogEntry(log.weekNumber(), log.status(),
                PiiMasker.mask(log.workSummary(), known), PiiMasker.mask(log.outcomes(), known),
                PiiMasker.mask(log.difficulties(), known), PiiMasker.mask(log.nextPlan(), known))).toList();
        AiPrompt prompt = AiPrompts.weeklyLogSummary(PiiMasker.mask(placement.jobTitle(), known), masked);
        Set<Integer> weeks = masked.stream().skip(Math.max(0, masked.size() - AiPrompts.MAX_LOG_WEEKS))
                .map(AiWeeklyLogEntry::weekNumber).collect(Collectors.toSet());
        return run(principal, AiFeature.WEEKLY_LOG_SUMMARY, placementId, prompt,
                raw -> AiPrompts.normalizeLogSummary(raw, weeks));
    }

    public Map<String, Object> settings() {
        Map<String, Object> result = new LinkedHashMap<>(repository.settings());
        result.put("configured", properties.configured());
        result.put("model", client.model());
        result.put("dailyLimitPerUser", properties.dailyLimitPerUser());
        result.put("usageWindowDays", USAGE_WINDOW_DAYS);
        result.put("usage", repository.usage(USAGE_WINDOW_DAYS));
        return result;
    }

    @Transactional
    public Map<String, Object> updateSettings(AuthPrincipal principal, boolean enabled, RequestMetadata request) {
        repository.updateSettings(enabled, principal.userId(), request);
        return settings();
    }

    private AiSuggestion run(AuthPrincipal principal, AiFeature feature, UUID targetId, AiPrompt prompt,
            Function<Map<String, Object>, Map<String, Object>> normalize) {
        String model = client.model();
        if (!properties.configured()) {
            log(principal, feature, targetId, AiCallStatus.NOT_CONFIGURED, model, null, null, null);
            return unavailable(feature, AiCallStatus.NOT_CONFIGURED.name(), "Hệ thống chưa cấu hình AI nên chưa có gợi ý.");
        }
        if (!repository.enabled()) {
            log(principal, feature, targetId, AiCallStatus.DISABLED, model, null, null, null);
            return unavailable(feature, AiCallStatus.DISABLED.name(), "Nhà trường đang tắt trợ lý AI nên chưa có gợi ý.");
        }

        String hash = sha256(model + "\n" + prompt.system() + "\n" + prompt.user());
        AiCachedSuggestion cached = repository.cached(feature, targetId, hash).orElse(null);
        if (cached != null) {
            log(principal, feature, targetId, AiCallStatus.CACHED, cached.model(), null, null, null);
            return new AiSuggestion(true, feature.name(), AiCallStatus.CACHED.name(), null, cached.result(),
                    cached.model(), cached.createdAt().toString());
        }

        int limit = properties.dailyLimitPerUser();
        // Take the slot before calling the provider, in one atomic statement, so parallel requests
        // cannot both see the last free slot and both reach Gemini.
        if (limit > 0 && !repository.reserveProviderCall(principal.userId(), limit)) {
            log(principal, feature, targetId, AiCallStatus.RATE_LIMITED, model, null, null, null);
            return unavailable(feature, AiCallStatus.RATE_LIMITED.name(),
                    "Bạn đã dùng hết " + limit + " lượt AI hôm nay. Vui lòng thử lại vào ngày mai.");
        }

        long started = System.nanoTime();
        AiCompletion completion = null;
        Map<String, Object> result;
        try {
            completion = client.generate(prompt);
            result = normalize.apply(json.object(completion.text()));
        } catch (AiClientException error) {
            log(principal, feature, targetId, AiCallStatus.FAILED, model, elapsedMs(started), null, error.code());
            return unavailable(feature, AiCallStatus.FAILED.name(),
                    "AI đang lỗi hoặc phản hồi chậm nên chưa có gợi ý. Vui lòng thử lại sau.");
        } catch (RuntimeException error) {
            // Only the provider call and parsing run in this block, so any other failure here means
            // the answer could not be used (e.g. "null", wrong JSON shape) and must not become a 500.
            log(principal, feature, targetId, AiCallStatus.FAILED, model, elapsedMs(started), completion, "INVALID_OUTPUT");
            return unavailable(feature, AiCallStatus.FAILED.name(),
                    "AI trả về kết quả không đúng định dạng nên chưa có gợi ý. Vui lòng thử lại.");
        }
        int latency = elapsedMs(started);
        OffsetDateTime createdAt = repository.saveSuggestion(feature, targetId, hash, model, result);
        log(principal, feature, targetId, AiCallStatus.SUCCESS, model, latency, completion, null);
        return new AiSuggestion(true, feature.name(), AiCallStatus.SUCCESS.name(), null, result, model, createdAt.toString());
    }

    private void log(AuthPrincipal principal, AiFeature feature, UUID targetId, AiCallStatus status, String model,
            Integer latencyMs, AiCompletion completion, String errorCode) {
        repository.logCall(principal.userId(), principal.role(), feature, targetId, status, model, latencyMs,
                completion == null ? null : completion.promptTokens(),
                completion == null ? null : completion.outputTokens(), errorCode);
    }

    private static AiSuggestion unavailable(AiFeature feature, String status, String message) {
        return new AiSuggestion(false, feature.name(), status, message, null, null, null);
    }

    private static List<String> personalValues(AiPlacementContext placement) {
        return Arrays.asList(placement.studentName(), placement.studentCode(), placement.studentEmail(),
                placement.supervisorName(), placement.supervisorEmail());
    }

    private static boolean planEditable(InternshipPlanStatus status) {
        return status == null || status == InternshipPlanStatus.DRAFT
                || status == InternshipPlanStatus.COMPANY_REVISION_REQUIRED
                || status == InternshipPlanStatus.UIT_REVISION_REQUIRED;
    }

    private static int elapsedMs(long startedNanos) {
        return (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startedNanos) / 1_000_000);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private AppException notFound() {
        return new AppException(ErrorType.NOT_FOUND, "INTERNSHIP_PLACEMENT_NOT_FOUND", "Không tìm thấy kỳ thực tập.");
    }
}
