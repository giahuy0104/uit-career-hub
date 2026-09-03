package vn.edu.uit.careerhub.common;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.postgresql.util.PGobject;

class JsonSupportTest {
    private final JsonSupport json = new JsonSupport(new ObjectMapper());

    @Test void nullValueBecomesEmptyMap() {
        assertThat(json.object(null)).isEmpty();
    }

    @Test void mapValueIsConvertedAsIs() {
        assertThat(json.object(Map.of("status", "ACTIVE", "version", 3)))
                .containsEntry("status", "ACTIVE").containsEntry("version", 3);
    }

    @Test void jsonStringIsParsedIntoAMap() {
        assertThat(json.object("{\"code\":\"UIT\",\"active\":true}"))
                .containsEntry("code", "UIT").containsEntry("active", true);
    }

    @Test void pgObjectValueIsParsedFromItsUnderlyingText() throws Exception {
        PGobject value = new PGobject();
        value.setType("jsonb");
        value.setValue("{\"id\":42}");
        assertThat(json.object(value)).containsEntry("id", 42);
    }

    @Test void malformedJsonRaisesAnIllegalStateException() {
        assertThatThrownBy(() -> json.object("{not-json"))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test void stringifyProducesJsonThatObjectCanReadBack() {
        String encoded = json.stringify(Map.of("reason", "TAXONOMY_IN_USE"));
        assertThat(json.object(encoded)).containsEntry("reason", "TAXONOMY_IN_USE");
    }
}
