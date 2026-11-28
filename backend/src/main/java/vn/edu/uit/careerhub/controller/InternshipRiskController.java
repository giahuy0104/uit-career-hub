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
import vn.edu.uit.careerhub.service.InternshipRiskService;

@RestController
@RequestMapping("/api/v1")
public class InternshipRiskController {
    private final InternshipRiskService service;

    public InternshipRiskController(InternshipRiskService service) { this.service = service; }

    @GetMapping("/uit/internship-supervision/risk")
    ApiEnvelope<Map<String, Object>> risk(@AuthenticationPrincipal AuthPrincipal principal) {
        AuthContext.requireRole(principal, UserRole.UIT_ADMIN);
        return ApiEnvelope.of(service.assess());
    }
}
