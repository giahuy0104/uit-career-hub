package vn.edu.uit.careerhub.common;

import java.util.List;
import java.util.Map;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingRequestHeaderException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(AppException.class)
    ResponseEntity<Map<String, Object>> appError(AppException error, HttpServletRequest request) {
        return response(error.status(), error.code(), error.getMessage(), error.details(), request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException error, HttpServletRequest request) {
        List<Map<String, Object>> details = error.getBindingResult().getAllErrors().stream().map(item -> {
            String path = item instanceof FieldError field ? field.getField() : item.getObjectName();
            return Map.<String, Object>of("path", path, "message", item.getDefaultMessage() == null ? "Không hợp lệ." : item.getDefaultMessage());
        }).toList();
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", details, request);
    }

    @ExceptionHandler({ConstraintViolationException.class, HttpMessageNotReadableException.class})
    ResponseEntity<Map<String, Object>> malformed(Exception error, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", List.of(), request);
    }

    @ExceptionHandler({MissingRequestHeaderException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<Map<String, Object>> requestValue(Exception error, HttpServletRequest request) {
        return response(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "Tham số hoặc header không hợp lệ.", List.of(), request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<Map<String, Object>> notFound(NoResourceFoundException error, HttpServletRequest request) {
        return response(HttpStatus.NOT_FOUND, "ROUTE_NOT_FOUND", "Không tìm thấy API được yêu cầu.", List.of(), request);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<Map<String, Object>> methodNotAllowed(HttpRequestMethodNotSupportedException error, HttpServletRequest request) {
        return response(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "Phương thức HTTP không được hỗ trợ.", List.of(), request);
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<Map<String, Object>> unexpected(Exception error, HttpServletRequest request) {
        log.error("request_error traceId={} method={} path={}", traceId(request), request.getMethod(), request.getRequestURI(), error);
        return response(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_SERVER_ERROR",
                "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.", List.of(), request);
    }

    private ResponseEntity<Map<String, Object>> response(HttpStatus status, String code, String message,
            List<Map<String, Object>> details, HttpServletRequest request) {
        return ResponseEntity.status(status).body(Map.of("error", Map.of(
                "code", code, "message", message, "details", details, "traceId", traceId(request))));
    }

    private String traceId(HttpServletRequest request) {
        Object value = request.getAttribute(TraceIdFilter.ATTRIBUTE);
        return value == null ? "unknown" : value.toString();
    }
}
