package vn.edu.uit.careerhub.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.config.AiProperties;

class GeminiAiClientTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final GeminiAiClient client = new GeminiAiClient(
            new AiProperties("", "gemini-test", "https://example.invalid/v1beta", 30, 30), mapper);

    @Test void requestAsksForJsonFollowingTheSchema() throws Exception {
        String body = client.requestBody(new AiPrompt("sys", "user", Map.of("type", "OBJECT")));

        var root = mapper.readTree(body);
        assertThat(root.at("/systemInstruction/parts/0/text").asText()).isEqualTo("sys");
        assertThat(root.at("/contents/0/parts/0/text").asText()).isEqualTo("user");
        assertThat(root.at("/generationConfig/responseMimeType").asText()).isEqualTo("application/json");
        assertThat(root.at("/generationConfig/responseSchema/type").asText()).isEqualTo("OBJECT");
    }

    @Test void parseJoinsTextPartsSkipsThoughtsAndReadsUsage() {
        AiCompletion completion = client.parse("""
                {"candidates":[{"content":{"parts":[{"text":"hidden","thought":true},{"text":"{\\"a\\":"},{"text":"1}"}]},
                  "finishReason":"STOP"}],
                 "usageMetadata":{"promptTokenCount":120,"candidatesTokenCount":45}}
                """);

        assertThat(completion.text()).isEqualTo("{\"a\":1}");
        assertThat(completion.promptTokens()).isEqualTo(120);
        assertThat(completion.outputTokens()).isEqualTo(45);
    }

    @Test void parseReportsBlockedAndEmptyAnswers() {
        assertThatThrownBy(() -> client.parse("{\"promptFeedback\":{\"blockReason\":\"SAFETY\"}}"))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("BLOCKED");
        assertThatThrownBy(() -> client.parse("{\"candidates\":[{\"finishReason\":\"MAX_TOKENS\"}]}"))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("EMPTY_MAX_TOKENS");
    }

    @Test void generateRefusesWithoutAnApiKey() {
        assertThatThrownBy(() -> client.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("NOT_CONFIGURED");
    }
}
