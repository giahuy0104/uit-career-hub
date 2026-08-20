package vn.edu.uit.careerhub.dashboard;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.auth.AuthContext;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.UserRole;
import vn.edu.uit.careerhub.common.ApiEnvelope;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {
    private final DashboardRepository dashboards;
    public DashboardController(DashboardRepository dashboards) { this.dashboards = dashboards; }

    @GetMapping("/uit/dashboard")
    ApiEnvelope<Map<String, Object>> admin(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN); return ApiEnvelope.of(dashboards.admin());
    }
    @GetMapping("/companies/me/dashboard")
    ApiEnvelope<Map<String, Object>> company(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.COMPANY); return ApiEnvelope.of(dashboards.company(principal.companyId()));
    }
    @GetMapping("/students/me/dashboard")
    ApiEnvelope<Map<String, Object>> student(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.STUDENT); return ApiEnvelope.of(dashboards.student(principal.studentProfileId()));
    }
}
