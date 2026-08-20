package vn.edu.uit.careerhub.taxonomy;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.CategoryDto;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Kind;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.ListResult;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.LockedItem;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.SkillDto;
import vn.edu.uit.careerhub.taxonomy.TaxonomyModels.Status;

@Repository
public class TaxonomyRepository {
    private static final String OPEN_STATUSES = "'DRAFT','PENDING_UIT_REVIEW','REVISION_REQUIRED','RECRUITING','PAUSED'";
    private final JdbcClient database;
    public TaxonomyRepository(JdbcClient database) { this.database = database; }

    public ListResult<CategoryDto> listCategories(int page, int pageSize, String query, Status status) {
        Config config = config(Kind.CATEGORY);
        var result = list(config, page, pageSize, query, status, this::category);
        return new ListResult<>(result.items(), result.total());
    }

    public ListResult<SkillDto> listSkills(int page, int pageSize, String query, Status status) {
        Config config = config(Kind.SKILL);
        var result = list(config, page, pageSize, query, status, this::skill);
        return new ListResult<>(result.items(), result.total());
    }

    private <T> ListResult<T> list(Config config, int page, int pageSize, String query, Status status,
            org.springframework.jdbc.core.RowMapper<T> mapper) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        if (query != null && !query.isBlank()) where.append(" AND (").append(config.alias).append(".name ILIKE :query OR ")
                .append(config.alias).append('.').append(config.keyColumn).append(" ILIKE :query)");
        if (status != null) where.append(" AND ").append(config.alias).append(".is_active = :active");
        JdbcClient.StatementSpec count = database.sql("SELECT count(*) FROM " + config.table + " " + config.alias + where);
        JdbcClient.StatementSpec items = database.sql(select(config) + where + " GROUP BY " + config.alias
                + ".id ORDER BY " + config.alias + ".is_active DESC, " + config.alias
                + ".name ASC, " + config.alias + ".id ASC LIMIT :limit OFFSET :offset");
        if (query != null && !query.isBlank()) {
            count = count.param("query", "%" + query.strip() + "%");
            items = items.param("query", "%" + query.strip() + "%");
        }
        if (status != null) {
            count = count.param("active", status == Status.ACTIVE);
            items = items.param("active", status == Status.ACTIVE);
        }
        long total = count.query(Long.class).single();
        return new ListResult<>(items.param("limit", pageSize).param("offset", (page - 1) * pageSize).query(mapper).list(), total);
    }

    public Optional<CategoryDto> findCategory(UUID id) {
        Config config = config(Kind.CATEGORY);
        return database.sql(select(config) + " WHERE c.id = :id GROUP BY c.id").param("id", id).query(this::category).optional();
    }
    public Optional<SkillDto> findSkill(UUID id) {
        Config config = config(Kind.SKILL);
        return database.sql(select(config) + " WHERE s.id = :id GROUP BY s.id").param("id", id).query(this::skill).optional();
    }

    public UUID create(Kind kind, String key, String name) {
        Config config = config(kind);
        return database.sql("INSERT INTO " + config.table + " (" + config.keyColumn + ", name) VALUES (:key, :name) RETURNING id")
                .param("key", key).param("name", name).query(UUID.class).single();
    }

    public Optional<LockedItem> lock(Kind kind, UUID id) {
        Config config = config(kind);
        return database.sql("SELECT id, " + config.keyColumn + " AS item_key, name, is_active, version FROM "
                + config.table + " WHERE id = :id FOR UPDATE").param("id", id)
                .query((result, row) -> new LockedItem(result.getObject("id", UUID.class), result.getString("item_key"),
                        result.getString("name"), result.getBoolean("is_active"), result.getInt("version"))).optional();
    }

    public void updateName(Kind kind, UUID id, String name) {
        database.sql("UPDATE " + config(kind).table + " SET name = :name, version = version + 1 WHERE id = :id")
                .param("name", name).param("id", id).update();
    }

    public void updateState(Kind kind, UUID id, boolean active) {
        database.sql("UPDATE " + config(kind).table + " SET is_active = :active, version = version + 1 WHERE id = :id")
                .param("active", active).param("id", id).update();
    }

    public long countOpenJobReferences(Kind kind, UUID id) {
        Config config = config(kind);
        Long count = database.sql("SELECT count(*) FROM " + config.linkTable + " link JOIN job_posts j ON j.id = link.job_post_id "
                + "WHERE link." + config.foreignKey + " = :id AND j.status IN (" + OPEN_STATUSES + ")")
                .param("id", id).query(Long.class).single();
        return count == null ? 0 : count;
    }

    private String select(Config config) {
        return "SELECT " + config.alias + ".id, " + config.alias + "." + config.keyColumn + ", " + config.alias
                + ".name, " + config.alias + ".is_active, " + config.alias + ".version, "
                + "count(DISTINCT " + config.linkAlias + ".job_post_id) AS job_count, "
                + "count(DISTINCT " + config.linkAlias + ".job_post_id) FILTER (WHERE j.status IN (" + OPEN_STATUSES
                + ")) AS open_job_count, " + config.alias + ".created_at, " + config.alias + ".updated_at FROM "
                + config.table + " " + config.alias + " LEFT JOIN " + config.linkTable + " " + config.linkAlias + " ON "
                + config.linkAlias + "." + config.foreignKey + " = " + config.alias + ".id LEFT JOIN job_posts j ON j.id = "
                + config.linkAlias + ".job_post_id";
    }

    private CategoryDto category(ResultSet result, int row) throws SQLException {
        return new CategoryDto(result.getObject("id", UUID.class), result.getString("code"), result.getString("name"),
                status(result), result.getInt("version"), result.getLong("job_count"), result.getLong("open_job_count"),
                instant(result, "created_at"), instant(result, "updated_at"));
    }
    private SkillDto skill(ResultSet result, int row) throws SQLException {
        return new SkillDto(result.getObject("id", UUID.class), result.getString("slug"), result.getString("name"),
                status(result), result.getInt("version"), result.getLong("job_count"), result.getLong("open_job_count"),
                instant(result, "created_at"), instant(result, "updated_at"));
    }
    private Status status(ResultSet result) throws SQLException { return result.getBoolean("is_active") ? Status.ACTIVE : Status.INACTIVE; }
    private java.time.Instant instant(ResultSet result, String column) throws SQLException {
        Timestamp value = result.getTimestamp(column); return value == null ? null : value.toInstant();
    }

    private Config config(Kind kind) {
        return kind == Kind.CATEGORY
                ? new Config("categories", "c", "code", "job_post_categories", "jpc", "category_id")
                : new Config("skills", "s", "slug", "job_post_skills", "jps", "skill_id");
    }
    private record Config(String table, String alias, String keyColumn, String linkTable, String linkAlias, String foreignKey) {}
}
