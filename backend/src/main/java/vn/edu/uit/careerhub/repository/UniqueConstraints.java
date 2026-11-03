package vn.edu.uit.careerhub.repository;

import java.util.Optional;

import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;

/** Hides the PostgreSQL driver details of a unique-constraint violation from the service layer. */
public final class UniqueConstraints {
    private static final String UNIQUE_VIOLATION = "23505";

    private UniqueConstraints() {}

    /** Returns the violated constraint name ("" if unnamed), or empty when it is not a unique violation. */
    public static Optional<String> violatedBy(DataIntegrityViolationException error) {
        if (error.getMostSpecificCause() instanceof PSQLException postgres
                && UNIQUE_VIOLATION.equals(postgres.getSQLState())) {
            String constraint = postgres.getServerErrorMessage() == null ? "" : postgres.getServerErrorMessage().getConstraint();
            return Optional.of(constraint == null ? "" : constraint);
        }
        return Optional.empty();
    }
}
