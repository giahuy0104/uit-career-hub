package vn.edu.uit.careerhub.exception;

/** Business failure categories, independent of any transport. */
public enum ErrorType {
    INVALID_INPUT,
    UNAUTHENTICATED,
    FORBIDDEN,
    NOT_FOUND,
    CONFLICT,
    EXPIRED,
    LOCKED,
    LIMIT_EXCEEDED,
    UNAVAILABLE
}
