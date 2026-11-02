package vn.edu.uit.careerhub.repository;

import java.sql.Types;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class StudentProfileRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public StudentProfileRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public Optional<Map<String,Object>> studentProfile(UUID id){return database.sql("""
      SELECT (jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,'faculty',sp.faculty,
        'major',sp.major,'cohort',sp.cohort,'gpa',sp.gpa,'phone',sp.phone,'academicStatus',sp.academic_status,'email',u.email))::text
      FROM student_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.id=:id
      """).param("id",id).query(String.class).optional().map(json::object);}

    public int updatePhone(UUID id, String phone) {
        return database.sql("UPDATE student_profiles SET phone=:phone WHERE id=:id")
                .param("phone", phone, Types.VARCHAR).param("id", id).update();
    }

    public Optional<String> academicStatusForShare(UUID id) {
        return database.sql("SELECT academic_status FROM student_profiles WHERE id=:id FOR SHARE")
                .param("id", id).query(String.class).optional();
    }

    public void lock(UUID id) {
        database.sql("SELECT id FROM student_profiles WHERE id=:id FOR UPDATE").param("id", id).query(UUID.class).single();
    }
}
