package vn.edu.uit.careerhub.ml;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Java twin of the text helpers in ml/train_text.py; TextParityTest keeps them identical. */
public final class TextFeatures {
    public static final List<String> TAG_FEATURES = List.of("cos_full", "cos_title", "exact_mention", "token_share",
            "cos_vs_reference", "share_below");

    private TextFeatures() {}

    // The task goes in the text for gemini-embedding-2 (it ignores task_type); same strings as ml/gemini.py.
    public static String asDocument(String title, String text) {
        return "title: " + (title == null || title.isBlank() ? "none" : title) + " | text: " + text;
    }

    public static String asQuery(String text) { return "task: search result | query: " + text; }

    public static String asSimilarity(String text) { return "task: sentence similarity | query: " + text; }

    public static String jobText(String title, String description, String requirements) {
        return title + ". " + description + " " + requirements;
    }

    /** [exact_mention, token_share]: whole spelling of the label (or one part of "A/B") in order; share of its words present. */
    public static double[] mention(String text, String label) {
        List<String> textTokens = InternshipRiskFeatures.tokens(text);
        String joined = " " + String.join(" ", textTokens) + " ";
        boolean exact = false;
        List<String> spellings = new java.util.ArrayList<>(List.of(label));
        for (String part : label.split("/")) if (!part.equals(label)) spellings.add(part);
        for (String spelling : spellings) {
            List<String> words = InternshipRiskFeatures.tokens(spelling);
            if (!words.isEmpty() && joined.contains(" " + String.join(" ", words) + " ")) exact = true;
        }
        Set<String> labelTokens = new HashSet<>(InternshipRiskFeatures.tokens(label));
        Set<String> present = new HashSet<>(labelTokens);
        present.retainAll(new HashSet<>(textTokens));
        return new double[] {exact ? 1 : 0, labelTokens.isEmpty() ? 0 : (double) present.size() / labelTokens.size()};
    }

    /** Share of the query's words found in the text. */
    public static double keywordScore(String query, String text) {
        Set<String> queryTokens = new HashSet<>(InternshipRiskFeatures.tokens(query));
        if (queryTokens.isEmpty()) return 0;
        queryTokens.retainAll(new HashSet<>(InternshipRiskFeatures.tokens(text)));
        return (double) queryTokens.size() / new HashSet<>(InternshipRiskFeatures.tokens(query)).size();
    }

    /**
     * [cos_vs_reference, share_below]: the label's similarity compared with the fixed reference labels shipped
     * with the model (cos minus their mean; share of them the post is less similar to).
     */
    public static double[] relative(double cos, float[] post, float[][] reference) {
        double sum = 0;
        int below = 0;
        for (float[] label : reference) {
            double value = dot(post, label);
            sum += value;
            if (value < cos) below++;
        }
        return reference.length == 0 ? new double[] {0, 0} : new double[] {cos - sum / reference.length, (double) below / reference.length};
    }

    public static double dot(float[] a, float[] b) {
        double sum = 0;
        for (int i = 0; i < Math.min(a.length, b.length); i++) sum += a[i] * b[i];
        return sum;
    }
}
