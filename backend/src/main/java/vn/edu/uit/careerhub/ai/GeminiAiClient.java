package vn.edu.uit.careerhub.ai;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.config.AiProperties;

/** Google Gemini generateContent API, asked to answer as JSON that follows a schema. */
@Component
public class GeminiAiClient implements AiClient {
    private final AiProperties properties;
    private final ObjectMapper mapper;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public GeminiAiClient(AiProperties properties, ObjectMapper mapper) {
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    public String model() { return properties.model(); }

    @Override
    public AiCompletion generate(AiPrompt prompt) {
        if (!properties.configured()) {
            throw new AiClientException("NOT_CONFIGURED", "Chưa cấu hình GEMINI_API_KEY.");
        }
        String base = properties.baseUrl().replaceAll("/+$", "");
        URI uri = URI.create(base + "/models/" + URLEncoder.encode(properties.model(), StandardCharsets.UTF_8) + ":generateContent");
        HttpRequest request = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(Math.max(5, properties.timeoutSeconds())))
                .header("Content-Type", "application/json")
                .header("x-goog-api-key", properties.apiKey())
                .POST(HttpRequest.BodyPublishers.ofString(requestBody(prompt), StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (HttpTimeoutException error) {
            throw new AiClientException("TIMEOUT", "Gemini phản hồi quá thời gian chờ.", error);
        } catch (IOException error) {
            throw new AiClientException("NETWORK", "Không kết nối được Gemini.", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AiClientException("INTERRUPTED", "Yêu cầu AI bị gián đoạn.", error);
        }
        int status = response.statusCode();
        if (status == 429) throw new AiClientException("PROVIDER_RATE_LIMITED", "Gemini đang giới hạn số lần gọi.");
        if (status < 200 || status >= 300) throw new AiClientException("HTTP_" + status, "Gemini trả về HTTP " + status + ".");
        return parse(response.body());
    }

    String requestBody(AiPrompt prompt) {
        Map<String, Object> generationConfig = new LinkedHashMap<>();
        generationConfig.put("temperature", 0.2);
        generationConfig.put("responseMimeType", "application/json");
        generationConfig.put("responseSchema", prompt.responseSchema());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("systemInstruction", Map.of("parts", List.of(Map.of("text", prompt.system()))));
        body.put("contents", List.of(Map.of("role", "user", "parts", List.of(Map.of("text", prompt.user())))));
        body.put("generationConfig", generationConfig);
        try {
            return mapper.writeValueAsString(body);
        } catch (IOException error) {
            throw new AiClientException("SERIALIZE", "Không tạo được yêu cầu AI.", error);
        }
    }

    /** Extracts the answer text and token usage; package-private for tests. */
    AiCompletion parse(String body) {
        JsonNode root;
        try {
            root = mapper.readTree(body);
        } catch (IOException error) {
            throw new AiClientException("INVALID_RESPONSE", "Phản hồi Gemini không phải JSON.", error);
        }
        if (root.path("promptFeedback").hasNonNull("blockReason")) {
            throw new AiClientException("BLOCKED", "Gemini từ chối xử lý nội dung.");
        }
        JsonNode candidate = root.path("candidates").path(0);
        StringBuilder text = new StringBuilder();
        for (JsonNode part : candidate.path("content").path("parts")) {
            if (part.path("thought").asBoolean(false)) continue;
            text.append(part.path("text").asText(""));
        }
        if (text.isEmpty()) {
            String reason = candidate.path("finishReason").asText("EMPTY");
            throw new AiClientException("EMPTY_" + reason, "Gemini không trả về nội dung.");
        }
        JsonNode usage = root.path("usageMetadata");
        return new AiCompletion(text.toString(), intOrNull(usage, "promptTokenCount"), intOrNull(usage, "candidatesTokenCount"));
    }

    private static Integer intOrNull(JsonNode node, String field) {
        return node.hasNonNull(field) ? node.get(field).asInt() : null;
    }
}
