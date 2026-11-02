package vn.edu.uit.careerhub.web;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

import vn.edu.uit.careerhub.exception.ErrorType;

class ErrorStatusMapperTest {
    @Test void keepsTheHttpContractForEveryErrorType() {
        Map<ErrorType, HttpStatus> expected = Map.of(
                ErrorType.INVALID_INPUT, HttpStatus.BAD_REQUEST,
                ErrorType.UNAUTHENTICATED, HttpStatus.UNAUTHORIZED,
                ErrorType.FORBIDDEN, HttpStatus.FORBIDDEN,
                ErrorType.NOT_FOUND, HttpStatus.NOT_FOUND,
                ErrorType.CONFLICT, HttpStatus.CONFLICT,
                ErrorType.EXPIRED, HttpStatus.GONE,
                ErrorType.LOCKED, HttpStatus.LOCKED,
                ErrorType.LIMIT_EXCEEDED, HttpStatus.UNPROCESSABLE_ENTITY,
                ErrorType.UNAVAILABLE, HttpStatus.SERVICE_UNAVAILABLE);

        assertThat(expected).hasSameSizeAs(ErrorType.values());
        expected.forEach((type, status) -> assertThat(ErrorStatusMapper.statusOf(type)).isEqualTo(status));
    }
}
