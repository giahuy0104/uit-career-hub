package vn.edu.uit.careerhub.security;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.web.ApiErrorWriter;

class JwtAuthenticationFilterTest {
    private static final String CRON_PATH = "/api/v1/cron/daily-pending-notifications";

    private final TokenService tokens = mock(TokenService.class);
    private final ApiErrorWriter errors = mock(ApiErrorWriter.class);
    private final FilterChain chain = mock(FilterChain.class);
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(tokens, mock(UserLookup.class), errors);
    private final MockHttpServletResponse response = new MockHttpServletResponse();

    private MockHttpServletRequest bearer(String method, String path) {
        MockHttpServletRequest request = new MockHttpServletRequest(method, path);
        request.addHeader("Authorization", "Bearer not-a-jwt");
        return request;
    }

    @Test
    void cronSecretReachesTheControllerInsteadOfBeingParsedAsJwt() throws Exception {
        MockHttpServletRequest request = bearer("GET", CRON_PATH);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        verify(tokens, never()).verifyAccessToken(any());
    }

    @Test
    void otherRequestsStillRejectAnInvalidBearerToken() throws Exception {
        AppException invalid = new AppException(ErrorType.UNAUTHENTICATED, "AUTH_INVALID_ACCESS_TOKEN", "invalid");
        when(tokens.verifyAccessToken("not-a-jwt")).thenThrow(invalid);

        for (MockHttpServletRequest request : new MockHttpServletRequest[] {
                bearer("GET", "/api/v1/students/me"),
                bearer("POST", CRON_PATH),
                bearer("GET", CRON_PATH + "/other")}) {
            filter.doFilter(request, response, chain);
            verify(errors).write(request, response, invalid);
            verify(chain, never()).doFilter(request, response);
        }
    }
}
