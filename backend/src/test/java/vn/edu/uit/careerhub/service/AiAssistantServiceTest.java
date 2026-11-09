package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.enums.WeeklyLogStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.repository.AiRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.util.JsonSupport;

/**
 * Covers the AI guard rails from the thesis outline: ownership, masking, graceful fallback
 * (disabled / not configured / provider error / bad output), caching and the daily limit.
 * The model is a fake, so no request leaves the machine.
 */
@ExtendWith(MockitoExtension.class)
class AiAssistantServiceTest {
    @Mock private AiRepository repository;

    private final FakeClient client = new FakeClient();
    private final UUID placementId = UUID.randomUUID();
    private final UUID studentProfileId = UUID.randomUUID();
    private final UUID companyId = UUID.randomUUID();
    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), "an@gm.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), studentProfileId, null);
    private final AuthPrincipal company = new AuthPrincipal(UUID.randomUUID(), "hr@acme.vn", UserRole.COMPANY, UUID.randomUUID(), null, companyId);
    private final AiPlanReviewRequest draft = new AiPlanReviewRequest("Tôi là Nguyễn Văn An, MSSV 25410230, muốn học Spring Boot", "Viết API", "Java");

    private AiAssistantService service;

    @BeforeEach void wire() {
        service = service("key");
        // Slots are free unless a test says otherwise.
        lenient().when(repository.reserveProviderCall(any(), anyInt())).thenReturn(true);
    }

    private AiAssistantService service(String apiKey) {
        return new AiAssistantService(repository, client, new AiProperties(apiKey, "gemini-test", "https://x", 30, 3),
                new JsonSupport(new ObjectMapper()));
    }

    @Test void planReviewSendsMaskedTextAndStoresTheResult() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(eq(AiFeature.PLAN_REVIEW), eq(placementId), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(eq(AiFeature.PLAN_REVIEW), eq(placementId), anyString(), eq("gemini-test"), any()))
                .thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Khá rõ\",\"strengths\":[],\"issues\":[]}";

        AiSuggestion result = service.reviewPlan(student, placementId, draft);

        assertThat(result.available()).isTrue();
        assertThat(result.status()).isEqualTo("SUCCESS");
        assertThat(result.result()).containsEntry("overall", "Khá rõ");
        assertThat(client.lastPrompt.user()).doesNotContain("Nguyễn Văn An", "25410230").contains("Spring Boot");
        verify(repository).logCall(eq(student.userId()), eq(UserRole.STUDENT), eq(AiFeature.PLAN_REVIEW), eq(placementId),
                eq(AiCallStatus.SUCCESS), eq("gemini-test"), any(), eq(100), eq(20), isNull());
    }

    @Test void planReviewIsOnlyForTheOwnerAndOnlyWhileEditable() {
        AuthPrincipal stranger = new AuthPrincipal(UUID.randomUUID(), "x@gm.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), UUID.randomUUID(), null);
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.PENDING_UIT_REVIEW)));

        assertThatThrownBy(() -> service.reviewPlan(stranger, placementId, draft))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("INTERNSHIP_PLACEMENT_NOT_FOUND");
        assertThatThrownBy(() -> service.reviewPlan(student, placementId, draft))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("AI_PLAN_REVIEW_NOT_EDITABLE");
        assertThat(client.calls).isZero();
    }

    @Test void disabledOrUnconfiguredAiReturnsNoSuggestionInsteadOfAnError() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(false);

        AiSuggestion disabled = service.reviewPlan(student, placementId, draft);
        AiSuggestion unconfigured = service("").reviewPlan(student, placementId, draft);

        assertThat(disabled.available()).isFalse();
        assertThat(disabled.status()).isEqualTo("DISABLED");
        assertThat(unconfigured.status()).isEqualTo("NOT_CONFIGURED");
        assertThat(client.calls).isZero();
    }

    @Test void providerErrorsAndMalformedOutputAreLoggedAndSwallowed() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());

        client.failure = new AiClientException("TIMEOUT", "slow");
        assertThat(service.reviewPlan(student, placementId, draft).status()).isEqualTo("FAILED");

        client.failure = null;
        client.answer = "not json";
        assertThat(service.reviewPlan(student, placementId, draft).status()).isEqualTo("FAILED");

        verify(repository).logCall(any(), any(), any(), any(), eq(AiCallStatus.FAILED), any(), any(), isNull(), isNull(), eq("TIMEOUT"));
        verify(repository).logCall(any(), any(), any(), any(), eq(AiCallStatus.FAILED), any(), any(), eq(100), eq(20), eq("INVALID_OUTPUT"));
        verify(repository, never()).saveSuggestion(any(), any(), any(), any(), any());
    }

    @Test void cachedSuggestionSkipsTheProviderAndTheDailyLimit() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(eq(AiFeature.PLAN_REVIEW), eq(placementId), anyString()))
                .thenReturn(Optional.of(new AiCachedSuggestion("gemini-test", Map.of("overall", "cũ"), OffsetDateTime.now())));

        AiSuggestion result = service.reviewPlan(student, placementId, draft);

        assertThat(result.status()).isEqualTo("CACHED");
        assertThat(client.calls).isZero();
        verify(repository, never()).reserveProviderCall(any(), anyInt());
    }

    @Test void aSlotIsReservedBeforeTheProviderIsCalled() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        when(repository.reserveProviderCall(student.userId(), 3)).thenAnswer(invocation -> {
            assertThat(client.calls).as("slot must be taken before Gemini is called").isZero();
            return true;
        });
        client.answer = "{\"overall\":\"Ổn\"}";

        assertThat(service.reviewPlan(student, placementId, draft).status()).isEqualTo("SUCCESS");
        verify(repository).reserveProviderCall(student.userId(), 3);
        assertThat(client.calls).isEqualTo(1);
    }

    @Test void dailyLimitStopsFurtherProviderCalls() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.reserveProviderCall(student.userId(), 3)).thenReturn(false);

        AiSuggestion result = service.reviewPlan(student, placementId, draft);

        assertThat(result.status()).isEqualTo("RATE_LIMITED");
        assertThat(client.calls).isZero();
        verify(repository).logCall(eq(student.userId()), any(), eq(AiFeature.PLAN_REVIEW), eq(placementId),
                eq(AiCallStatus.RATE_LIMITED), any(), isNull(), isNull(), isNull(), isNull());
    }

    @Test void logSummaryIsLimitedToTheHostCompanyAndNeedsSubmittedLogs() {
        AuthPrincipal otherCompany = new AuthPrincipal(UUID.randomUUID(), "hr@other.vn", UserRole.COMPANY, UUID.randomUUID(), null, UUID.randomUUID());
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.APPROVED)));

        assertThatThrownBy(() -> service.summarizeWeeklyLogs(otherCompany, placementId)).isInstanceOf(AppException.class);
        assertThatThrownBy(() -> service.summarizeWeeklyLogs(student, placementId)).isInstanceOf(AppException.class);

        when(repository.lastSubmittedLogs(placementId)).thenReturn(List.of());
        assertThat(service.summarizeWeeklyLogs(company, placementId).status()).isEqualTo("NO_DATA");
        assertThat(client.calls).isZero();
    }

    @Test void logSummaryReturnsNormalizedFlags() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.APPROVED)));
        when(repository.lastSubmittedLogs(placementId)).thenReturn(List.of(
                new AiWeeklyLogEntry(1, WeeklyLogStatus.COMPANY_CONFIRMED, "Nguyễn Văn An dựng môi trường", "Xong", null, "Viết API"),
                new AiWeeklyLogEntry(2, WeeklyLogStatus.SUBMITTED, "Viết API", "Xong 2 endpoint", "Chưa có quyền DB", "Test")));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = """
                {"overview":"Tiến độ đều","keyPoints":["API"],
                 "flags":[{"weekNumber":2,"type":"NEEDS_SUPPORT","detail":"Thiếu quyền DB"},{"weekNumber":7,"type":"REPEATED","detail":"x"}]}
                """;

        AiSuggestion result = service.summarizeWeeklyLogs(company, placementId);

        assertThat(result.available()).isTrue();
        assertThat((List<?>) result.result().get("flags")).hasSize(1);
        assertThat(client.lastPrompt.user()).doesNotContain("Nguyễn Văn An");
    }

    @Test void unknownPlacementIsNotFound() {
        when(repository.placement(placementId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.reviewPlan(student, placementId, draft))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("INTERNSHIP_PLACEMENT_NOT_FOUND");
        assertThatThrownBy(() -> service.summarizeWeeklyLogs(company, placementId))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("INTERNSHIP_PLACEMENT_NOT_FOUND");
    }

    @Test void planReviewNeedsSomeContentAndAnOpenPlacement() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        assertThatThrownBy(() -> service.reviewPlan(student, placementId, new AiPlanReviewRequest(" ", null, "")))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("AI_PLAN_REVIEW_EMPTY");

        when(repository.placement(placementId)).thenReturn(Optional.of(placement(PlacementStatus.COMPLETED, InternshipPlanStatus.DRAFT)));
        assertThatThrownBy(() -> service.reviewPlan(student, placementId, draft))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("AI_PLAN_REVIEW_NOT_EDITABLE");
        assertThat(client.calls).isZero();
    }

    @Test void planReviewIsAllowedWithoutAPlanOrWhenRevisionIsRequested() {
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Ổn\"}";

        for (InternshipPlanStatus status : new InternshipPlanStatus[] {null,
                InternshipPlanStatus.COMPANY_REVISION_REQUIRED, InternshipPlanStatus.UIT_REVISION_REQUIRED}) {
            when(repository.placement(placementId)).thenReturn(Optional.of(placement(status)));
            assertThat(service.reviewPlan(student, placementId, draft).available()).as(String.valueOf(status)).isTrue();
        }
        assertThat(client.calls).isEqualTo(3);
    }

    @Test void promptMasksSupervisorAndContactDetailsToo() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Ổn\"}";

        service.reviewPlan(student, placementId, new AiPlanReviewRequest(
                "Anh Trần Bình (binh@acme.vn) hướng dẫn", "Gọi 0912345678 khi cần", "Email riêng an@gm.uit.edu.vn"));

        assertThat(client.lastPrompt.user()).doesNotContain("Trần Bình", "binh@acme.vn", "0912345678", "an@gm.uit.edu.vn")
                .contains("[đã ẩn]", "[số điện thoại]");
    }

    @Test void namesOutsideTheKnownListAndTheJobTitleAreMaskedToo() {
        when(repository.placement(placementId)).thenReturn(Optional.of(new AiPlacementContext(placementId, PlacementStatus.STARTED,
                studentProfileId, companyId, "Nguyễn Văn An", "25410230", "an@gm.uit.edu.vn",
                "Thực tập Backend - liên hệ chị Ngọc Hân", "Báo cáo cho anh Phạm Quốc Huy", "Java", InternshipPlanStatus.DRAFT,
                "Trần Bình", "binh@acme.vn")));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Ổn\"}";

        service.reviewPlan(student, placementId, new AiPlanReviewRequest(
                "Học từ mentor Đức và bạn Lê Thị Mai", "Pair với Võ Minh Khoa", "Spring Boot"));

        assertThat(client.lastPrompt.user())
                .doesNotContain("Ngọc Hân", "Phạm Quốc Huy", "Đức", "Lê Thị Mai", "Võ Minh Khoa")
                .contains("Thực tập Backend", "[tên người]", "Spring Boot");
    }

    @Test void logSummaryMasksColleaguesNamedInTheLogs() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.APPROVED)));
        when(repository.lastSubmittedLogs(placementId)).thenReturn(List.of(new AiWeeklyLogEntry(1, WeeklyLogStatus.SUBMITTED,
                "Họp với anh Tuấn và chị Hoàng Thu Trang", "Xong", "Cần anh Khánh cấp quyền", "Test")));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overview\":\"Ổn\"}";

        service.summarizeWeeklyLogs(company, placementId);

        assertThat(client.lastPrompt.user()).doesNotContain("Tuấn", "Thu Trang", "Khánh").contains("anh [tên người]");
    }

    @Test void changedContentIsACacheMissWhileSameContentReusesTheKey() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Ổn\"}";

        service.reviewPlan(student, placementId, draft);
        service.reviewPlan(student, placementId, draft);
        service.reviewPlan(student, placementId, new AiPlanReviewRequest("Mục tiêu khác", "Viết API", "Java"));

        ArgumentCaptor<String> hashes = ArgumentCaptor.forClass(String.class);
        verify(repository, times(3)).cached(eq(AiFeature.PLAN_REVIEW), eq(placementId), hashes.capture());
        assertThat(hashes.getAllValues().get(0)).hasSize(64).isEqualTo(hashes.getAllValues().get(1));
        assertThat(hashes.getAllValues().get(2)).isNotEqualTo(hashes.getAllValues().get(0));
    }

    @Test void zeroDailyLimitMeansUnlimited() {
        service = new AiAssistantService(repository, client, new AiProperties("key", "gemini-test", "https://x", 30, 0),
                new JsonSupport(new ObjectMapper()));
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overall\":\"Ổn\"}";

        assertThat(service.reviewPlan(student, placementId, draft).status()).isEqualTo("SUCCESS");
        verify(repository, never()).reserveProviderCall(any(), anyInt());
    }

    @Test void literalNullOrWrongShapeFromTheModelIsAFailureNotAServerError() {
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.DRAFT)));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());

        for (String answer : new String[] {"null", "[1,2]", "{\"overall\":\"\"}"}) {
            client.answer = answer;
            AiSuggestion result = service.reviewPlan(student, placementId, draft);
            assertThat(result.available()).as(answer).isFalse();
            assertThat(result.status()).as(answer).isEqualTo("FAILED");
        }
        verify(repository, never()).saveSuggestion(any(), any(), any(), any(), any());
    }

    @Test void uitStaffCanSummarizeAnyPlacement() {
        AuthPrincipal admin = new AuthPrincipal(UUID.randomUUID(), "admin@uit.edu.vn", UserRole.UIT_ADMIN, UUID.randomUUID(), null, null);
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.APPROVED)));
        when(repository.lastSubmittedLogs(placementId)).thenReturn(List.of(
                new AiWeeklyLogEntry(1, WeeklyLogStatus.SUBMITTED, "Làm API", "Xong", null, "Test")));
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = "{\"overview\":\"Ổn\"}";

        AiSuggestion result = service.summarizeWeeklyLogs(admin, placementId);

        assertThat(result.available()).isTrue();
        verify(repository).logCall(eq(admin.userId()), eq(UserRole.UIT_ADMIN), eq(AiFeature.WEEKLY_LOG_SUMMARY), eq(placementId),
                eq(AiCallStatus.SUCCESS), any(), any(), any(), any(), isNull());
    }

    @Test void flagsOnlyPointAtWeeksThatWereActuallySent() {
        List<AiWeeklyLogEntry> logs = new ArrayList<>();
        for (int week = 1; week <= AiPrompts.MAX_LOG_WEEKS + 5; week++) {
            logs.add(new AiWeeklyLogEntry(week, WeeklyLogStatus.COMPANY_CONFIRMED, "Tuần " + week, "Xong", null, "Tiếp"));
        }
        when(repository.placement(placementId)).thenReturn(Optional.of(placement(InternshipPlanStatus.APPROVED)));
        when(repository.lastSubmittedLogs(placementId)).thenReturn(logs);
        when(repository.enabled()).thenReturn(true);
        when(repository.cached(any(), any(), anyString())).thenReturn(Optional.empty());
        when(repository.saveSuggestion(any(), any(), anyString(), any(), any())).thenReturn(OffsetDateTime.now());
        client.answer = """
                {"overview":"Ổn","flags":[{"weekNumber":1,"type":"TOO_SHORT","detail":"đã bị cắt"},
                                          {"weekNumber":25,"type":"TOO_SHORT","detail":"tuần cuối"}]}
                """;

        AiSuggestion result = service.summarizeWeeklyLogs(company, placementId);

        assertThat(client.lastPrompt.user()).doesNotContain("<nhat_ky tuan=\"5\"").contains("<nhat_ky tuan=\"6\"", "<nhat_ky tuan=\"25\"");
        assertThat((List<?>) result.result().get("flags")).hasSize(1);
        assertThat(result.result()).containsEntry("weekCount", AiPrompts.MAX_LOG_WEEKS);
    }

    @Test void settingsCombineTheSwitchWithServerConfigurationAndUsage() {
        when(repository.settings()).thenReturn(Map.of("enabled", true));
        when(repository.usage(AiAssistantService.USAGE_WINDOW_DAYS)).thenReturn(List.of(Map.of("feature", "PLAN_REVIEW")));

        Map<String, Object> settings = service.settings();

        assertThat(settings).containsEntry("enabled", true).containsEntry("configured", true)
                .containsEntry("model", "gemini-test").containsEntry("dailyLimitPerUser", 3)
                .containsEntry("usageWindowDays", 30).containsKey("usage");
        assertThat(service("").settings()).containsEntry("configured", false);
    }

    @Test void updatingSettingsRecordsTheActor() {
        AuthPrincipal admin = new AuthPrincipal(UUID.randomUUID(), "admin@uit.edu.vn", UserRole.UIT_ADMIN, UUID.randomUUID(), null, null);
        RequestMetadata request = new RequestMetadata("127.0.0.1", "test");
        when(repository.settings()).thenReturn(Map.of("enabled", false));

        Map<String, Object> settings = service.updateSettings(admin, false, request);

        verify(repository).updateSettings(false, admin.userId(), request);
        assertThat(settings).containsEntry("enabled", false);
    }

    private AiPlacementContext placement(InternshipPlanStatus planStatus) {
        return placement(PlacementStatus.STARTED, planStatus);
    }

    private AiPlacementContext placement(PlacementStatus placementStatus, InternshipPlanStatus planStatus) {
        return new AiPlacementContext(placementId, placementStatus, studentProfileId, companyId,
                "Nguyễn Văn An", "25410230", "an@gm.uit.edu.vn", "Backend Intern", "Phát triển API", "Java, SQL",
                planStatus, "Trần Bình", "binh@acme.vn");
    }

    private static final class FakeClient implements AiClient {
        String answer = "{}";
        AiClientException failure;
        AiPrompt lastPrompt;
        int calls;

        @Override public String model() { return "gemini-test"; }

        @Override public AiCompletion generate(AiPrompt prompt) {
            calls++;
            lastPrompt = prompt;
            if (failure != null) throw failure;
            return new AiCompletion(answer, 100, 20);
        }
    }
}
