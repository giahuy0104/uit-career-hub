package vn.edu.uit.careerhub.email;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Map;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.config.AppProperties;

/**
 * Covers the outbox short-circuit when email is disabled (dispatchPending must not touch the
 * database at all) and the HTML-escaping used when rendering notification title/body into the
 * transactional email template, since that is the one thing standing between a stored
 * notification and a stored-XSS-in-email bug.
 */
class EmailDeliveryServiceTest {
    @Test void dispatchPendingIsANoOpWhenEmailIsDisabled() {
        AppProperties properties = properties(false);
        EmailDeliveryService service = new EmailDeliveryService(null, properties, null);

        Map<String, Object> result = service.dispatchPending(null);

        assertThat(result).isEqualTo(Map.of("enabled", false, "claimed", 0, "sent", 0, "failed", 0));
    }

    @Test void escapeNeutralizesHtmlSpecialCharacters() throws Throwable {
        EmailDeliveryService service = new EmailDeliveryService(null, properties(false), null);
        Method escape = EmailDeliveryService.class.getDeclaredMethod("escape", String.class);
        escape.setAccessible(true);

        String result = invoke(escape, service, "<script>alert('x')</script> & \"quoted\"");

        assertThat(result).isEqualTo("&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt; &amp; &quot;quoted&quot;");
    }

    private String invoke(Method method, Object target, Object... args) throws Throwable {
        try {
            return (String) method.invoke(target, args);
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }

    private AppProperties properties(boolean emailEnabled) {
        return new AppProperties("test", "http://localhost:5173", "http://localhost:5173",
                new AppProperties.Database("postgresql://localhost/test", "", 5),
                new AppProperties.Security("0123456789abcdefghijklmnopqrstuvwxyz", "issuer", "audience", 900, 7,
                        "refresh", false, "lax", "student.uit.edu.vn"),
                new AppProperties.Email(emailEnabled, "re_test", "notifications@example.com", 10, 5),
                new AppProperties.Storage(false, "", "", "", "bucket", 600, 300), "cron-secret");
    }
}
