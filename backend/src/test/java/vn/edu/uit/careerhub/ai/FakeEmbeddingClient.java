package vn.edu.uit.careerhub.ai;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deterministic stand-in for Gemini: a normalised bag of hashed words, so texts sharing words are close.
 * The task prefix ("task: ... | query:") is dropped first, as it carries no meaning for the fake.
 */
public class FakeEmbeddingClient implements EmbeddingClient {
    private static final Pattern WORD = Pattern.compile("\\w+", Pattern.UNICODE_CHARACTER_CLASS);
    private static final int DIMENSIONS = 64;
    public int calls;
    public int texts;
    public RuntimeException failure;

    @Override public String model() { return "fake-embedding"; }

    @Override
    public List<float[]> embed(List<String> input) {
        calls++;
        texts += input.size();
        if (failure != null) throw failure;
        List<float[]> result = new ArrayList<>();
        for (String text : input) result.add(vector(text.replaceFirst("^.*?\\| (query|text): ", "")));
        return result;
    }

    private static float[] vector(String text) {
        float[] vector = new float[DIMENSIONS];
        Matcher matcher = WORD.matcher(text.toLowerCase(Locale.ROOT));
        while (matcher.find()) vector[Math.floorMod(matcher.group().hashCode(), DIMENSIONS)] += 1;
        double norm = 0;
        for (float value : vector) norm += value * value;
        norm = Math.sqrt(norm);
        if (norm > 0) for (int i = 0; i < vector.length; i++) vector[i] /= (float) norm;
        return vector;
    }
}
