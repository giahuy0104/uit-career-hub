package vn.edu.uit.careerhub.ai;

import java.util.List;

/** Text to unit-length vectors (Gemini embeddings in production, a fake in tests). */
public interface EmbeddingClient {
    String model();

    List<float[]> embed(List<String> texts);
}
