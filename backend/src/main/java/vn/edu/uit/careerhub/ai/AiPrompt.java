package vn.edu.uit.careerhub.ai;

import java.util.Map;

/**
 * One request to the model.
 *
 * @param system         fixed instructions (role, rules, output language)
 * @param user           the already-redacted content to analyse
 * @param responseSchema JSON schema (Gemini OpenAPI subset) the answer must follow
 */
public record AiPrompt(String system, String user, Map<String, Object> responseSchema) {}
