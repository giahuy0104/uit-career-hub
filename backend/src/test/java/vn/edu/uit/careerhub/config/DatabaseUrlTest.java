package vn.edu.uit.careerhub.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class DatabaseUrlTest {
    @Test void parsesLocalUrlAndCredentials(){var value=DatabaseUrl.parse("postgresql://uit_user:uit%40password@localhost:5432/uit_career_hub");assertThat(value.jdbcUrl()).isEqualTo("jdbc:postgresql://localhost:5432/uit_career_hub");assertThat(value.username()).isEqualTo("uit_user");assertThat(value.password()).isEqualTo("uit@password");assertThat(value.local()).isTrue();assertThat(value.neonPooler()).isFalse();}
    @Test void usesJvmTrustStoreForVerifyFullAndDetectsNeonPooler(){var value=DatabaseUrl.parse("postgresql://owner:secret@ep-demo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=verify-full");assertThat(value.jdbcUrl()).endsWith("?sslmode=verify-full&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory");assertThat(value.neonPooler()).isTrue();assertThat(value.local()).isFalse();}
    @Test void preservesExplicitSslTrustConfiguration(){var value=DatabaseUrl.parse("postgresql://owner:secret@example.com/neondb?sslmode=verify-full&sslrootcert=/run/secrets/root.crt");assertThat(value.jdbcUrl()).endsWith("?sslmode=verify-full&sslrootcert=/run/secrets/root.crt");}
    @Test void acceptsJdbcPrefix(){assertThat(DatabaseUrl.parse("jdbc:postgresql://localhost/test").jdbcUrl()).isEqualTo("jdbc:postgresql://localhost:5432/test");}
    @Test void rejectsNonPostgresScheme(){assertThatThrownBy(()->DatabaseUrl.parse("mysql://localhost/test")).isInstanceOf(IllegalArgumentException.class);}
    @Test void rejectsMissingUrl(){assertThatThrownBy(()->DatabaseUrl.parse(" ")).isInstanceOf(IllegalArgumentException.class);}
}
