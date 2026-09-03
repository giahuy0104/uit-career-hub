package vn.edu.uit.careerhub.reporting;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.time.LocalDate;

import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.reporting.ReportingService.Filters;

/**
 * Exercises the pure formatting/validation logic behind the UIT recruitment report export
 * (docs/domain/reporting.md, section 5 of the handoff: date-range validation and CSV formula
 * injection protection). These methods are private and side-effect free, so they are invoked via
 * reflection rather than mocking the JdbcClient the service also depends on.
 */
class ReportingServiceTest {
    private final ReportingService service = new ReportingService(null, null);

    @Test void rejectsFromDateAfterToDate() {
        Filters filters = filters(LocalDate.of(2026, 2, 1), LocalDate.of(2026, 1, 1));
        assertThatThrownBy(() -> validate(filters))
                .isInstanceOf(AppException.class)
                .extracting(error -> ((AppException) error).code())
                .isEqualTo("VALIDATION_ERROR");
    }

    @Test void acceptsFromDateOnOrBeforeToDate() {
        assertThatCode(() -> validate(filters(LocalDate.of(2026, 1, 1), LocalDate.of(2026, 1, 1))))
                .doesNotThrowAnyException();
        assertThatCode(() -> validate(filters(null, null))).doesNotThrowAnyException();
    }

    @Test void plainValuesPassThroughUnescaped() throws Throwable {
        assertThat(csvCell("Nguyễn Văn A")).isEqualTo("Nguyễn Văn A");
    }

    @Test void leadingFormulaCharactersAreNeutralized() throws Throwable {
        assertThat(csvCell("=SUM(A1:A2)")).isEqualTo("'=SUM(A1:A2)");
        assertThat(csvCell("+84123456789")).isEqualTo("'+84123456789");
        assertThat(csvCell("-1")).isEqualTo("'-1");
        assertThat(csvCell("@cmd")).isEqualTo("'@cmd");
        assertThat(csvCell(" =cmd|' /C calc'!A0")).startsWith("'");
    }

    @Test void valuesWithCommaOrQuoteAreQuotedAndEscaped() throws Throwable {
        assertThat(csvCell("Công ty A, Chi nhánh 1")).isEqualTo("\"Công ty A, Chi nhánh 1\"");
        assertThat(csvCell("Say \"hi\"")).isEqualTo("\"Say \"\"hi\"\"\"");
    }

    @Test void formulaCharacterInsideQuotedValueIsBothEscapedAndQuoted() throws Throwable {
        assertThat(csvCell("=A1,B1")).isEqualTo("\"'=A1,B1\"");
    }

    private Filters filters(LocalDate from, LocalDate to) {
        return new Filters(from, to, null, null, null, null, null, null, null);
    }

    private void validate(Filters filters) throws Throwable {
        invokePrivate("validate", new Class<?>[] {Filters.class}, filters);
    }

    private String csvCell(String value) throws Throwable {
        return (String) invokePrivate("csvCell", new Class<?>[] {String.class}, value);
    }

    private Object invokePrivate(String name, Class<?>[] parameterTypes, Object... args) throws Throwable {
        Method method = ReportingService.class.getDeclaredMethod(name, parameterTypes);
        method.setAccessible(true);
        try {
            return method.invoke(service, args);
        } catch (InvocationTargetException error) {
            throw error.getCause();
        }
    }
}
