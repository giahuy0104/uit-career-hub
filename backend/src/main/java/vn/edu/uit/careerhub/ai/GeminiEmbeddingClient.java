package vn.edu.uit.careerhub.ai;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpTimeoutException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import vn.edu.uit.careerhub.config.AiProperties;

/** Gemini batchEmbedContents. Vectors come back normalised, so a dot product is the cosine. */
@Component
public class GeminiEmbeddingClient implements EmbeddingClient {
    static final int DIMENSIONS = 768;
    static final int MAX_BATCH = 20;

    private final AiProperties properties;
    private final ObjectMapper mapper;
    private final String model;
    private final HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public GeminiEmbeddingClient(AiProperties properties, ObjectMapper mapper,
            @Value("${app.ai.embedding-model:gemini-embedding-2}") String model) {
        this.properties = properties;
        this.mapper = mapper;
        this.model = model;
    }

    @Override public String model() { return model; }

    @Override
    public List<float[]> embed(List<String> texts) {
        if (!properties.configured()) throw new AiClientException("NOT_CONFIGURED", "Chưa cấu hình GEMINI_API_KEY.");
        List<float[]> result = new ArrayList<>();
        for (int start = 0; start < texts.size(); start += MAX_BATCH) {
            result.addAll(batch(texts.subList(start, Math.min(texts.size(), start + MAX_BATCH))));
        }
        return result;
    }

    private List<float[]> batch(List<String> texts) {
        List<Map<String, Object>> requests = texts.stream().map(text -> Map.<String, Object>of(
                "model", "models/" + model, "content", Map.of("parts", List.of(Map.of("text", text))),
                "output_dimensionality", DIMENSIONS)).toList();
        HttpRequest request;
        try {
            request = HttpRequest.newBuilder(URI.create(properties.baseUrl().replaceAll("/+$", "") + "/models/" + model + ":batchEmbedContents"))
                    .timeout(Duration.ofSeconds(Math.max(5, properties.timeoutSeconds())))
                    .header("Content-Type", "application/json").header("x-goog-api-key", properties.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("requests", requests)), StandardCharsets.UTF_8))
                    .build();
        } catch (IOException error) {
            throw new AiClientException("SERIALIZE", "Không tạo được yêu cầu embedding.", error);
        }
        HttpResponse<String> response;
        try {
            response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        } catch (HttpTimeoutException error) {
            throw new AiClientException("TIMEOUT", "Gemini embedding phản hồi quá thời gian chờ.", error);
        } catch (IOException error) {
            throw new AiClientException("NETWORK", "Không kết nối được Gemini.", error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            throw new AiClientException("INTERRUPTED", "Yêu cầu embedding bị gián đoạn.", error);
        }
        if (response.statusCode() == 429) throw new AiClientException("PROVIDER_RATE_LIMITED", "Gemini đang giới hạn số lần gọi.");
        if (response.statusCode() / 100 != 2) throw new AiClientException("HTTP_" + response.statusCode(), "Gemini trả về HTTP " + response.statusCode() + ".");
        try {
            JsonNode embeddings = mapper.readTree(response.body()).path("embeddings");
            if (embeddings.size() != texts.size()) throw new AiClientException("INVALID_OUTPUT", "Số embedding không khớp số văn bản.");
            List<float[]> vectors = new ArrayList<>();
            for (JsonNode item : embeddings) {
                JsonNode values = item.path("values");
                float[] vector = new float[values.size()];
                for (int i = 0; i < vector.length; i++) vector[i] = (float) values.get(i).asDouble();
                vectors.add(vector);
            }
            return vectors;
        } catch (IOException error) {
            throw new AiClientException("INVALID_OUTPUT", "Embedding trả về không đọc được.", error);
        }
    }
}
