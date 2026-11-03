package vn.edu.uit.careerhub.web;

import org.springframework.http.HttpStatus;

import vn.edu.uit.careerhub.exception.ErrorType;

/** The only place that translates business error types to HTTP. */
public final class ErrorStatusMapper {
    private ErrorStatusMapper() {}

    public static HttpStatus statusOf(ErrorType type) {
        return switch (type) {
            case INVALID_INPUT -> HttpStatus.BAD_REQUEST;
            case UNAUTHENTICATED -> HttpStatus.UNAUTHORIZED;
            case FORBIDDEN -> HttpStatus.FORBIDDEN;
            case NOT_FOUND -> HttpStatus.NOT_FOUND;
            case CONFLICT -> HttpStatus.CONFLICT;
            case EXPIRED -> HttpStatus.GONE;
            case LOCKED -> HttpStatus.LOCKED;
            case LIMIT_EXCEEDED -> HttpStatus.UNPROCESSABLE_ENTITY;
            case UNAVAILABLE -> HttpStatus.SERVICE_UNAVAILABLE;
        };
    }
}
