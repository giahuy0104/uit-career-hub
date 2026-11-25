package vn.edu.uit.careerhub.ai;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.config.AiProperties;

/** Talks to a local stub instead of Google, so the real HTTP path is covered without a key or network. */
class GeminiAiClientHttpTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final AtomicReference<HttpExchange> lastExchange = new AtomicReference<>();
    private final AtomicReference<String> lastBody = new AtomicReference<>();
    private final AtomicInteger calls = new AtomicInteger();
    private volatile int overloadedCalls = 0;
    private volatile int status = 200;
    private volatile String reply = "";
    private HttpServer server;
    private GeminiAiClient client;

    @BeforeEach void start() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            lastExchange.set(exchange);
            lastBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            boolean overloaded = calls.incrementAndGet() <= overloadedCalls;
            byte[] bytes = reply.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(overloaded ? 503 : status, bytes.length == 0 ? -1 : bytes.length);
            if (bytes.length > 0) exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1beta/";
        client = new GeminiAiClient(new AiProperties("secret-key", "gemini-test", base, 5, 30), mapper,
                List.of(Duration.ofMillis(1), Duration.ofMillis(1)));
    }

    @AfterEach void stop() {
        server.stop(0);
    }

    @Test void postsToGenerateContentWithTheKeyInAHeader() throws Exception {
        reply = """
                {"candidates":[{"content":{"parts":[{"text":"{\\"overall\\":\\"ok\\"}"}]},"finishReason":"STOP"}],
                 "usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":3}}
                """;

        AiCompletion completion = client.generate(new AiPrompt("sys", "user", Map.of("type", "OBJECT")));

        HttpExchange exchange = lastExchange.get();
        assertThat(exchange.getRequestMethod()).isEqualTo("POST");
        assertThat(exchange.getRequestURI().getPath()).isEqualTo("/v1beta/models/gemini-test:generateContent");
        assertThat(exchange.getRequestURI().getQuery()).as("key must not be in the URL").isNull();
        assertThat(exchange.getRequestHeaders().getFirst("x-goog-api-key")).isEqualTo("secret-key");
        assertThat(mapper.readTree(lastBody.get()).at("/contents/0/parts/0/text").asText()).isEqualTo("user");
        assertThat(completion.text()).isEqualTo("{\"overall\":\"ok\"}");
        assertThat(completion.promptTokens()).isEqualTo(10);
    }

    @Test void overloadedProviderIsRetriedUntilItAnswers() {
        overloadedCalls = 2;
        reply = "{\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"{}\"}]},\"finishReason\":\"STOP\"}]}";

        assertThat(client.generate(new AiPrompt("s", "u", Map.of())).text()).isEqualTo("{}");
        assertThat(calls).hasValue(3);
    }

    @Test void overloadedProviderIsTriedAtMostThreeTimesAndOtherErrorsOnce() {
        status = 503;
        assertThatThrownBy(() -> client.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOfSatisfying(AiClientException.class, e -> assertThat(e.providerOverloaded()).isTrue());
        assertThat(calls).hasValue(3);

        calls.set(0);
        status = 429;
        assertThatThrownBy(() -> client.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOfSatisfying(AiClientException.class, e -> assertThat(e.providerOverloaded()).isFalse());
        assertThat(calls).hasValue(1);
    }

    @Test void retriesStopWhenTheNextDelayWouldPassTheTimeout() {
        status = 503;
        String base = "http://127.0.0.1:" + server.getAddress().getPort() + "/v1beta";
        GeminiAiClient slow = new GeminiAiClient(new AiProperties("k", "m", base, 5, 30), mapper, List.of(Duration.ofSeconds(60)));

        assertThatThrownBy(() -> slow.generate(new AiPrompt("s", "u", Map.of()))).isInstanceOf(AiClientException.class);
        assertThat(calls).hasValue(1);
    }

    @Test void httpErrorsBecomeShortCodes() {
        status = 429;
        assertThatThrownBy(() -> client.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("PROVIDER_RATE_LIMITED");
        status = 503;
        reply = "{\"error\":{\"message\":\"overloaded\"}}";
        assertThatThrownBy(() -> client.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("HTTP_503");
    }

    @Test void unreachableProviderIsANetworkError() {
        int port = server.getAddress().getPort();
        server.stop(0);
        GeminiAiClient offline = new GeminiAiClient(
                new AiProperties("secret-key", "gemini-test", "http://127.0.0.1:" + port + "/v1beta", 5, 30), mapper);

        assertThatThrownBy(() -> offline.generate(new AiPrompt("s", "u", Map.of())))
                .isInstanceOf(AiClientException.class).extracting(e -> ((AiClientException) e).code()).isEqualTo("NETWORK");
    }
}
