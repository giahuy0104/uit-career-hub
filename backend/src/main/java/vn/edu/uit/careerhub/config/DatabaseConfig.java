package vn.edu.uit.careerhub.config;

import javax.sql.DataSource;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DatabaseConfig {
    @Bean(destroyMethod = "close")
    HikariDataSource dataSource(AppProperties properties) {
        DatabaseUrl database = DatabaseUrl.parse(properties.database().url());
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(database.jdbcUrl());
        if (database.username() != null) config.setUsername(database.username());
        if (database.password() != null) config.setPassword(database.password());
        config.setMaximumPoolSize(properties.database().poolMax());
        config.setConnectionTimeout(5_000);
        config.setPoolName("uit-career-hub-java");
        config.addDataSourceProperty("ApplicationName", "uit-career-hub-java");
        return new HikariDataSource(config);
    }
}
