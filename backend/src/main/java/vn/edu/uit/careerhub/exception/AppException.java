package vn.edu.uit.careerhub.exception;

import java.util.List;
import java.util.Map;

public class AppException extends RuntimeException {
    private final ErrorType type;
    private final String code;
    private final List<Map<String, Object>> details;

    public AppException(ErrorType type, String code, String message) {
        this(type, code, message, List.of());
    }

    public AppException(ErrorType type, String code, String message, List<Map<String, Object>> details) {
        super(message);
        this.type = type;
        this.code = code;
        this.details = List.copyOf(details);
    }

    public ErrorType type() { return type; }
    public String code() { return code; }
    public List<Map<String, Object>> details() { return details; }
}
