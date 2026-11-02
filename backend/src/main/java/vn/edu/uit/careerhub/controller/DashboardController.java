package vn.edu.uit.careerhub.controller;

import java.util.Map;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.dto.response.ApiEnvelope;
import vn.edu.uit.careerhub.enums.UserRole;
import vn.edu.uit.careerhub.security.AuthContext;
import vn.edu.uit.careerhub.security.AuthPrincipal;
import vn.edu.uit.careerhub.service.DashboardService;

@RestController
@RequestMapping("/api/v1")
public class DashboardController {
    private final DashboardService dashboards;
    public DashboardController(DashboardService dashboards) { this.dashboards = dashboards; }

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
