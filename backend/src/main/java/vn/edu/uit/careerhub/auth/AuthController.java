package vn.edu.uit.careerhub.auth;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import vn.edu.uit.careerhub.common.ApiEnvelope;
import vn.edu.uit.careerhub.config.AppProperties;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService service;
    private final AppProperties.Security configuration;

    public AuthController(AuthService service, AppProperties properties) {
        this.service = service;
        this.configuration = properties.security();
    }

    @PostMapping("/login")
    ApiEnvelope<AuthService.Session> login(@Valid @RequestBody LoginRequest input,
            HttpServletRequest request, HttpServletResponse response) {
        AuthService.IssuedSession result = service.login(input.email().strip().toLowerCase(), input.password(), RequestMetadata.from(request));
        setRefreshCookie(response, result.refreshToken());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiEnvelope.of(result.session());
    }

    @PostMapping("/refresh")
    ApiEnvelope<AuthService.Session> refresh(HttpServletRequest request, HttpServletResponse response) {
        AuthService.IssuedSession result = service.refresh(cookie(request), RequestMetadata.from(request));
        setRefreshCookie(response, result.refreshToken());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiEnvelope.of(result.session());
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response) {
        service.logout(cookie(request), RequestMetadata.from(request));
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder("").maxAge(0).build().toString());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/company-activation")
    ResponseEntity<Void> activate(@Valid @RequestBody CompanyActivationRequest input, HttpServletRequest request) {
        service.activateCompanyAccount(input.token(), input.password(), RequestMetadata.from(request));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    ApiEnvelope<UserDto> me(@AuthenticationPrincipal AuthPrincipal principal, HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        return ApiEnvelope.of(service.getCurrentUser(principal.userId()));
    }

    private void setRefreshCookie(HttpServletResponse response, String value) {
        response.addHeader(HttpHeaders.SET_COOKIE, cookieBuilder(value)
                .maxAge(java.time.Duration.ofDays(configuration.refreshTokenTtlDays())).build().toString());
    }

    private ResponseCookie.ResponseCookieBuilder cookieBuilder(String value) {
        String sameSite = configuration.refreshCookieSameSite();
        sameSite = sameSite.substring(0, 1).toUpperCase() + sameSite.substring(1).toLowerCase();
        return ResponseCookie.from(configuration.refreshCookieName(), value)
                .httpOnly(true).secure(configuration.refreshCookieSecure()).sameSite(sameSite).path("/api/v1/auth");
    }

    private String cookie(HttpServletRequest request) {
        if (request.getCookies() == null) return null;
        for (Cookie cookie : request.getCookies()) {
            if (configuration.refreshCookieName().equals(cookie.getName())) return cookie.getValue();
        }
        return null;
    }
}
