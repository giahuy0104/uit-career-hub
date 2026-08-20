package vn.edu.uit.careerhub.common;

import java.util.List;
import java.util.Map;

import org.springframework.http.HttpStatus;

public class AppException extends RuntimeException {
    private final HttpStatus status;
    private final String code;
    private final List<Map<String, Object>> details;

    public AppException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    public AppException(HttpStatus status, String code, String message, List<Map<String, Object>> details) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = List.copyOf(details);
    }

    public HttpStatus status() { return status; }
    public String code() { return code; }
    public List<Map<String, Object>> details() { return details; }
}
