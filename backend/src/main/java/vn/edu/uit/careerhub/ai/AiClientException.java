package vn.edu.uit.careerhub.ai;

/** Provider failure. {@code code} is a short, non-sensitive label stored in ai_call_logs. */
public class AiClientException extends RuntimeException {
    private final String code;

    public AiClientException(String code, String message) {
        super(message);
        this.code = code;
    }

    public AiClientException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() { return code; }
}
