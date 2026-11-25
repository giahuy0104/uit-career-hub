package vn.edu.uit.careerhub.repository;

import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.entity.NamedRef;
import vn.edu.uit.careerhub.enums.OpportunityType;

@Repository
public class JobPreferenceRepository {
    private final JdbcClient database;

    public JobPreferenceRepository(JdbcClient database) { this.database = database; }

    public List<NamedRef> activeSkills() { return refs(database.sql("SELECT id,name FROM skills WHERE is_active ORDER BY name,id")); }

    public List<NamedRef> activeCategories() { return refs(database.sql("SELECT id,name FROM categories WHERE is_active ORDER BY name,id")); }

    public JobPreferences find(UUID studentProfileId) {
        List<NamedRef> skills = refs(database.sql("""
          SELECT s.id,s.name FROM student_skills ss JOIN skills s ON s.id=ss.skill_id
          WHERE ss.student_profile_id=:id AND s.is_active ORDER BY s.name,s.id
          """).param("id", studentProfileId));
        List<NamedRef> categories = refs(database.sql("""
          SELECT c.id,c.name FROM student_preferred_categories sc JOIN categories c ON c.id=sc.category_id
          WHERE sc.student_profile_id=:id AND c.is_active ORDER BY c.name,c.id
          """).param("id", studentProfileId));
        String types = database.sql("SELECT array_to_string(preferred_opportunity_types,',') FROM student_profiles WHERE id=:id")
                .param("id", studentProfileId).query(String.class).single();
        return new JobPreferences(skills, categories, types.isEmpty() ? List.of()
                : Arrays.stream(types.split(",")).map(OpportunityType::valueOf).toList());
    }

    public void replace(UUID studentProfileId, List<UUID> skillIds, List<UUID> categoryIds, List<OpportunityType> types) {
        database.sql("DELETE FROM student_skills WHERE student_profile_id=:id").param("id", studentProfileId).update();
        for (UUID skill : new LinkedHashSet<>(skillIds)) {
            database.sql("INSERT INTO student_skills(student_profile_id,skill_id) VALUES(:id,:ref)")
                    .param("id", studentProfileId).param("ref", skill).update();
        }
        database.sql("DELETE FROM student_preferred_categories WHERE student_profile_id=:id").param("id", studentProfileId).update();
        for (UUID category : new LinkedHashSet<>(categoryIds)) {
            database.sql("INSERT INTO student_preferred_categories(student_profile_id,category_id) VALUES(:id,:ref)")
                    .param("id", studentProfileId).param("ref", category).update();
        }
        String values = types.stream().distinct().map(Enum::name).collect(Collectors.joining(",", "{", "}"));
        database.sql("UPDATE student_profiles SET preferred_opportunity_types=CAST(:types AS text[]) WHERE id=:id")
                .param("types", values).param("id", studentProfileId).update();
    }

    private static List<NamedRef> refs(JdbcClient.StatementSpec statement) {
        return statement.query((row, number) -> new NamedRef(row.getObject("id", UUID.class), row.getString("name"))).list();
    }
}
