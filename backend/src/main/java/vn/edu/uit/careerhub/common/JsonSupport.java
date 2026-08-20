package vn.edu.uit.careerhub.common;

import java.util.Collections;
import java.util.Map;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.postgresql.util.PGobject;
import org.springframework.stereotype.Component;

@Component
public class JsonSupport {
    private final ObjectMapper mapper;

    public JsonSupport(ObjectMapper mapper) { this.mapper = mapper; }

    public Map<String, Object> object(Object value) {
        if (value == null) return Collections.emptyMap();
        if (value instanceof Map<?, ?> map) return mapper.convertValue(map, new TypeReference<>() {});
        String json = value instanceof PGobject pg ? pg.getValue() : value.toString();
        try { return mapper.readValue(json, new TypeReference<>() {}); }
        catch (Exception error) { throw new IllegalStateException("JSON database không hợp lệ.", error); }
    }
    public String stringify(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception error) { throw new IllegalArgumentException("Không thể mã hóa JSON.", error); }
    }
}
