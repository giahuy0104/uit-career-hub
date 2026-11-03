package vn.edu.uit.careerhub.web;

import java.io.IOException;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.filter.TraceIdFilter;

@Component
public class ApiErrorWriter {
    private final ObjectMapper mapper;

    public ApiErrorWriter(ObjectMapper mapper) { this.mapper = mapper; }

    public void write(HttpServletRequest request, HttpServletResponse response, AppException error) throws IOException {
        response.setStatus(ErrorStatusMapper.statusOf(error.type()).value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        Object trace = request.getAttribute(TraceIdFilter.ATTRIBUTE);
        mapper.writeValue(response.getWriter(), Map.of("error", Map.of(
                "code", error.code(), "message", error.getMessage(),
                "details", error.details() == null ? List.of() : error.details(),
                "traceId", trace == null ? "unknown" : trace.toString())));
    }
}
