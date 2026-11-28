package vn.edu.uit.careerhub.ml;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Java twin of risk_features() in ml/features.py; InternshipRiskParityTest keeps them identical. */
public final class InternshipRiskFeatures {
    public static final List<String> NAMES = List.of("submit_ratio", "late_ratio", "revision_ratio", "avg_words",
            "words_trend", "max_repeat", "difficulty_ratio", "days_since_last", "plan_revisions");

    /** Same as Python's \w+ on Unicode text: letters, digits and underscore. */
    private static final Pattern TOKEN = Pattern.compile("\\w+", Pattern.UNICODE_CHARACTER_CLASS);

    private InternshipRiskFeatures() {}

    /** One week that is due: whether it was submitted and the content of its latest submission. */
    public record Week(boolean submitted, boolean late, boolean revised, String workSummary, String outcomes,
            String difficulties) {}

    public static double[] compute(List<Week> weeks, long daysSinceLast, int planRevisions) {
        List<Week> submitted = weeks.stream().filter(Week::submitted).toList();
        int n = submitted.size();
        List<Double> words = new ArrayList<>();
        for (Week week : submitted) words.add((double) Math.min(300, tokens(week.workSummary()).size() + tokens(week.outcomes()).size()));
        double average = n == 0 ? 0 : words.stream().mapToDouble(Double::doubleValue).sum() / n;
        double trend = 0;
        if (n >= 4) {
            double first = (words.get(0) + words.get(1)) / 2;
            double last = (words.get(n - 1) + words.get(n - 2)) / 2;
            trend = (last - first) / (first + 10);
        }
        double repeat = 0;
        for (int i = 1; i < n; i++) {
            Set<String> previous = new HashSet<>(tokens(submitted.get(i - 1).workSummary()));
            Set<String> current = new HashSet<>(tokens(submitted.get(i).workSummary()));
            Set<String> union = new HashSet<>(previous);
            union.addAll(current);
            if (union.isEmpty()) continue;
            previous.retainAll(current);
            repeat = Math.max(repeat, (double) previous.size() / union.size());
        }
        return new double[] {
            weeks.isEmpty() ? 1 : (double) n / weeks.size(),
            share(submitted, Week::late), share(submitted, Week::revised), average, trend, repeat,
            share(submitted, week -> tokens(week.difficulties()).size() >= 8),
            JobRankingFeatures.clamp(daysSinceLast, 0, 30), JobRankingFeatures.clamp(planRevisions, 0, 5),
        };
    }

    static List<String> tokens(String text) {
        List<String> result = new ArrayList<>();
        if (text == null) return result;
        Matcher matcher = TOKEN.matcher(text.toLowerCase(Locale.ROOT));
        while (matcher.find()) result.add(matcher.group());
        return result;
    }

    private static double share(List<Week> weeks, java.util.function.Predicate<Week> test) {
        return weeks.isEmpty() ? 0 : (double) weeks.stream().filter(test).count() / weeks.size();
    }
}
