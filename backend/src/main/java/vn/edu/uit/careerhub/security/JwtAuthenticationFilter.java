package vn.edu.uit.careerhub.security;

import java.io.IOException;
import java.util.List;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import vn.edu.uit.careerhub.entity.AuthUser;
import vn.edu.uit.careerhub.enums.UserStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.web.ApiErrorWriter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String CRON_PATH = "/api/v1/cron/daily-pending-notifications";

    private final TokenService tokens;
    private final UserLookup users;
    private final ApiErrorWriter errors;

    public JwtAuthenticationFilter(TokenService tokens, UserLookup users, ApiErrorWriter errors) {
        this.tokens = tokens;
        this.users = users;
        this.errors = errors;
    }

    /** The cron endpoint authenticates with a shared secret in the Bearer header, checked by its controller. */
    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return "GET".equals(request.getMethod()) && CRON_PATH.equals(request.getRequestURI());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization == null || authorization.isBlank()) {
            chain.doFilter(request, response);
            return;
        }
        if (!authorization.startsWith("Bearer ") || authorization.substring(7).isBlank()
                || authorization.substring(7).contains(" ")) {
            errors.write(request, response, missing());
            return;
        }
        try {
            AuthPrincipal principal = tokens.verifyAccessToken(authorization.substring(7));
            AuthUser current = users.findById(principal.userId()).orElse(null);
            if (!isCurrent(current, principal)) {
                throw new AppException(ErrorType.UNAUTHENTICATED, "AUTH_ACCESS_REVOKED",
                        "Phiên đăng nhập không còn hiệu lực. Vui lòng đăng nhập lại.");
            }
            var authentication = new UsernamePasswordAuthenticationToken(principal, authorization.substring(7),
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.role().name())));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            chain.doFilter(request, response);
        } catch (AppException error) {
            SecurityContextHolder.clearContext();
            errors.write(request, response, error);
        }
    }

    private boolean isCurrent(AuthUser user, AuthPrincipal principal) {
        return user != null && user.status() == UserStatus.ACTIVE && user.role() == principal.role()
                && java.util.Objects.equals(user.studentProfileId(), principal.studentProfileId())
                && java.util.Objects.equals(user.companyId(), principal.companyId());
    }

    private AppException missing() {
        return new AppException(ErrorType.UNAUTHENTICATED, "AUTH_ACCESS_TOKEN_MISSING",
                "Vui lòng đăng nhập để tiếp tục.");
    }
}
