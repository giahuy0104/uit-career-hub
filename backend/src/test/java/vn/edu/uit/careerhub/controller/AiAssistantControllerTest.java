package vn.edu.uit.careerhub.controller;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.UUID;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.dto.request.AiPlanReviewRequest;
import vn.edu.uit.careerhub.dto.request.AiSettingsRequest;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.AiAssistantService;

/** Each AI endpoint is reachable only by the role whose screen shows the button. */
class AiAssistantControllerTest {
    private final AiAssistantService service = mock(AiAssistantService.class);
    private final AiAssistantController controller = new AiAssistantController(service);
    private final UUID placementId = UUID.randomUUID();

    private final AuthPrincipal student = new AuthPrincipal(UUID.randomUUID(), "s@gm.uit.edu.vn", UserRole.STUDENT, UUID.randomUUID(), UUID.randomUUID(), null);
    private final AuthPrincipal company = new AuthPrincipal(UUID.randomUUID(), "hr@acme.vn", UserRole.COMPANY, UUID.randomUUID(), null, UUID.randomUUID());
    private final AuthPrincipal admin = new AuthPrincipal(UUID.randomUUID(), "a@uit.edu.vn", UserRole.UIT_ADMIN, UUID.randomUUID(), null, null);

    @Test void wrongRolesAreForbiddenBeforeTheServiceRuns() {
        AiPlanReviewRequest plan = new AiPlanReviewRequest("a", "b", "c");

        assertForbidden(() -> controller.reviewPlan(company, placementId, plan));
        assertForbidden(() -> controller.reviewPlan(admin, placementId, plan));
        assertForbidden(() -> controller.companyLogSummary(student, placementId));
        assertForbidden(() -> controller.companyLogSummary(admin, placementId));
        assertForbidden(() -> controller.uitLogSummary(company, placementId));
        assertForbidden(() -> controller.uitLogSummary(student, placementId));
        assertForbidden(() -> controller.settings(company));
        assertForbidden(() -> controller.updateSettings(student, new AiSettingsRequest(false), mock(HttpServletRequest.class)));
        verifyNoInteractions(service);
    }

    @Test void anonymousCallsAreRejected() {
        assertThatThrownBy(() -> controller.settings(null))
                .isInstanceOf(AppException.class).extracting(e -> ((AppException) e).code()).isEqualTo("AUTH_ACCESS_TOKEN_MISSING");
        verifyNoInteractions(service);
    }

    private static void assertForbidden(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call).isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).code()).isEqualTo("AUTH_FORBIDDEN");
    }
}
