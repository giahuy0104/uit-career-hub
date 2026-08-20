package vn.edu.uit.careerhub.database;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.config.DatabaseUrl;

@Component
public class DatabaseTasks {
    private static final Pattern MIGRATION_NAME = Pattern.compile("^(\\d{4})_([a-z0-9_]+)\\.sql$");
    private final JdbcClient database;
    private final TransactionTemplate transactions;
    private final AppProperties properties;

    public DatabaseTasks(JdbcClient database, TransactionTemplate transactions, AppProperties properties) {
        this.database = database;
        this.transactions = transactions;
        this.properties = properties;
    }

    public void migrate() {
        assertMigrationConnectionIsSafe();
        database.sql("SELECT pg_advisory_lock(hashtext('uit-career-hub-migrations'))").query(Object.class).optional();
        try {
            database.sql("""
                    CREATE TABLE IF NOT EXISTS schema_migrations (
                      version text PRIMARY KEY,
                      name text NOT NULL,
                      checksum text NOT NULL,
                      applied_at timestamptz NOT NULL DEFAULT now()
                    )
                    """).update();
            Map<String, String> applied = database.sql("SELECT version, checksum FROM schema_migrations")
                    .query((row, number) -> Map.entry(row.getString("version"), row.getString("checksum")))
                    .list().stream().collect(java.util.stream.Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
            for (Migration migration : migrations()) {
                String oldChecksum = applied.get(migration.version());
                if (oldChecksum != null) {
                    if (!oldChecksum.equals(migration.checksum())) {
                        throw new IllegalStateException("Migration " + migration.fileName() + " đã bị thay đổi sau khi áp dụng.");
                    }
                    System.out.println("Bỏ qua " + migration.fileName() + " (đã áp dụng).");
                    continue;
                }
                transactions.executeWithoutResult(status -> {
                    database.sql(migration.sql()).update();
                    database.sql("INSERT INTO schema_migrations (version, name, checksum) VALUES (:version, :name, :checksum)")
                            .param("version", migration.version()).param("name", migration.name())
                            .param("checksum", migration.checksum()).update();
                });
                System.out.println("Đã áp dụng " + migration.fileName() + ".");
            }
        } finally {
            database.sql("SELECT pg_advisory_unlock(hashtext('uit-career-hub-migrations'))").query(Object.class).optional();
        }
    }

    public void seed() {
        if ("production".equals(properties.environment())) {
            throw new IllegalStateException("Không được chạy development seed trong NODE_ENV=production.");
        }
        Resource seed = new org.springframework.core.io.ClassPathResource("database/seeds/development.sql");
        try {
            String sql = seed.getContentAsString(StandardCharsets.UTF_8);
            transactions.executeWithoutResult(status -> database.sql(sql).update());
            System.out.println("Đã nạp dữ liệu demo development.");
        } catch (IOException error) {
            throw new IllegalStateException("Không thể đọc development seed.", error);
        }
    }

    public void resetDemo() {
        if ("production".equals(properties.environment())) {
            throw new IllegalStateException("Không được reset dữ liệu demo trong production.");
        }
        try {
            String resetSql = new org.springframework.core.io.ClassPathResource("database/seeds/demo-reset.sql")
                    .getContentAsString(StandardCharsets.UTF_8);
            String seedSql = new org.springframework.core.io.ClassPathResource("database/seeds/development.sql")
                    .getContentAsString(StandardCharsets.UTF_8);
            transactions.executeWithoutResult(status -> {
                database.sql("SELECT pg_advisory_xact_lock(hashtext('uit-career-hub-demo-reset'))")
                        .query(Object.class).optional();
                database.sql(resetSql).update();
                database.sql(seedSql).update();
            });
            System.out.println("Đã đưa dữ liệu demo về checkpoint ban đầu.");
        } catch (IOException error) {
            throw new IllegalStateException("Không thể đọc demo reset/seed SQL.", error);
        }
    }

    private List<Migration> migrations() {
        try {
            Resource[] resources = new PathMatchingResourcePatternResolver()
                    .getResources("classpath*:database/migrations/*.sql");
            return java.util.Arrays.stream(resources).map(this::migration)
                    .sorted(Comparator.comparing(Migration::fileName)).toList();
        } catch (IOException error) {
            throw new IllegalStateException("Không thể đọc migration SQL.", error);
        }
    }

    private Migration migration(Resource resource) {
        try {
            String fileName = resource.getFilename();
            Matcher matcher = MIGRATION_NAME.matcher(fileName == null ? "" : fileName);
            if (!matcher.matches()) throw new IllegalStateException("Tên migration không hợp lệ: " + fileName);
            byte[] bytes = resource.getContentAsByteArray();
            String checksum = HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
            return new Migration(matcher.group(1), matcher.group(2), fileName, checksum,
                    new String(bytes, StandardCharsets.UTF_8));
        } catch (Exception error) {
            throw new IllegalStateException("Không thể nạp migration " + resource, error);
        }
    }

    private void assertMigrationConnectionIsSafe() {
        DatabaseUrl runtime = DatabaseUrl.parse(properties.database().url());
        String direct = properties.database().directUrl();
        if ((direct == null || direct.isBlank()) && runtime.neonPooler()) {
            throw new IllegalStateException("Thiếu DATABASE_URL_DIRECT. Migration Neon không được chạy bằng pooled URL.");
        }
        if (direct != null && !direct.isBlank()
                && !DatabaseUrl.parse(direct).jdbcUrl().equals(runtime.jdbcUrl())) {
            throw new IllegalStateException("Java migration runner phải được khởi động với DATABASE_URL trỏ tới direct URL.");
        }
    }

    private record Migration(String version, String name, String fileName, String checksum, String sql) {}
}
