package vn.edu.uit.careerhub.filter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.regex.Pattern;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Resolves the client IP once per request. Each proxy appends the address it received the request from
 * to X-Forwarded-For, so only the last {@code trustedProxyHops} entries were written by our own proxies;
 * anything further left is client-supplied and must not be believed.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class ClientIpFilter extends OncePerRequestFilter {
    public static final String ATTRIBUTE = "clientIp";

    private static final Pattern IPV4 = Pattern.compile("((25[0-5]|2[0-4]\\d|1?\\d?\\d)\\.){3}(25[0-5]|2[0-4]\\d|1?\\d?\\d)");
    private static final Pattern IPV6 = Pattern.compile("[0-9a-fA-F:.]*:[0-9a-fA-F:.]*");

    private final int trustedProxyHops;

    public ClientIpFilter(@Value("${app.security.trusted-proxy-hops:0}") int trustedProxyHops) {
        this.trustedProxyHops = trustedProxyHops;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        request.setAttribute(ATTRIBUTE, resolve(request.getHeader("X-Forwarded-For"), request.getRemoteAddr(), trustedProxyHops));
        chain.doFilter(request, response);
    }

    /** Returns a valid IP literal, or null, so that it is always safe to cast to PostgreSQL inet. */
    public static String resolve(String forwardedFor, String remoteAddress, int trustedProxyHops) {
        if (trustedProxyHops > 0 && forwardedFor != null) {
            String[] chain = forwardedFor.split(",");
            int index = chain.length - trustedProxyHops;
            if (index >= 0 && isIpLiteral(chain[index].strip())) return chain[index].strip();
        }
        return isIpLiteral(remoteAddress) ? remoteAddress : null;
    }

    private static boolean isIpLiteral(String value) {
        if (value == null) return false;
        if (IPV4.matcher(value).matches()) return true;
        if (!IPV6.matcher(value).matches()) return false;
        try {
            InetAddress.getByName(value); // contains ':' so this parses the literal and never queries DNS
            return true;
        } catch (UnknownHostException error) {
            return false;
        }
    }
}
