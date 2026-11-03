package vn.edu.uit.careerhub.integration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RealDatabaseGuardTest {

    @ParameterizedTest
    @ValueSource(strings = {
            "postgresql://uit_user:uit_ci_password@127.0.0.1:5432/uit_career_hub_ci",
            "postgresql://postgres@localhost:55432/uit_career_hub_test",
            "postgres://u:p@[::1]:5432/test",
            "postgresql://u:p@localhost/career-test-db?sslmode=disable",
    })
    void acceptsDedicatedLocalDatabases(String url) {
        assertThatCode(() -> RealDatabaseIntegrationTest.assertSafeTestDatabase(url)).doesNotThrowAnyException();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "postgresql://uit_user:uit_local_password@localhost:5432/uit_career_hub",
            "postgresql://u:p@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/uit_career_hub_test?sslmode=require",
            "postgresql://u:p@db.internal:5432/uit_career_hub_ci",
            "postgresql://u:p@localhost:5432/latest_contest",
            "postgresql://u:p@localhost:5432/",
    })
    void rejectsSharedOrRemoteDatabases(String url) {
        assertThatThrownBy(() -> RealDatabaseIntegrationTest.assertSafeTestDatabase(url))
                .isInstanceOf(IllegalStateException.class);
    }
}
