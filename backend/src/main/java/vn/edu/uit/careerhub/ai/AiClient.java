package vn.edu.uit.careerhub.ai;

/**
 * Port to a large language model. The service layer depends on this interface only, so tests can
 * swap in a fake and the provider can change without touching business code.
 */
public interface AiClient {
    /** Model name reported in logs and cache keys. */
    String model();

    /**
     * Sends one prompt and returns the raw JSON text produced by the model.
     *
     * @throws AiClientException on timeout, HTTP failure, blocked or empty output
     */
    AiCompletion generate(AiPrompt prompt);
}
