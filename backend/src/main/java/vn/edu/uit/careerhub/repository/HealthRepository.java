package vn.edu.uit.careerhub.repository;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class HealthRepository {
    private final JdbcClient database;

    public HealthRepository(JdbcClient database) { this.database = database; }

    public void ping() { database.sql("SELECT 1").query(Integer.class).single(); }
}
