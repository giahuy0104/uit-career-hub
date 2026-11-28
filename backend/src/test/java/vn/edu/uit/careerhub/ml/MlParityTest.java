package vn.edu.uit.careerhub.ml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/**
 * Replays cases written by ml/train_*.py: the same raw input must give the same features and the same
 * probability in Java as in Python, so the deployed model sees what it was trained on.
 */
class MlParityTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final MlModels models = new MlModels(mapper, true);

    @Test void jobRankerMatchesPython() throws Exception {
        MlModel model = models.jobRanker().orElseThrow();
        for (JsonNode c : read("ml/job-ranker-cases.json")) {
            JsonNode student = c.path("student");
            JsonNode job = c.path("job");
            List<JobRankingFeatures.JobSkill> skills = new ArrayList<>();
            job.path("skills").forEach(s -> skills.add(new JobRankingFeatures.JobSkill(s.asText(),
                    job.path("required").path(s.asText()).asBoolean(true))));
            List<Set<String>> history = new ArrayList<>();
            c.path("history").forEach(past -> history.add(set(past)));
            double[] features = JobRankingFeatures.compute(set(student.path("skills")), set(student.path("categories")),
                    set(student.path("types")), skills, set(job.path("categories")), job.path("type").asText(),
                    job.path("days_since_published").asLong(), job.path("days_to_deadline").asLong(), history,
                    c.path("company_apps_30d").asLong(), c.path("features").get(13).asDouble());
            assertThat(features).containsExactly(doubles(c.path("features")), within(1e-9));
            assertThat(model.probability(features)).isCloseTo(c.path("probability").asDouble(), within(1e-9));
        }
    }

    @Test void internshipRiskMatchesPython() throws Exception {
        MlModel model = models.internshipRisk().orElseThrow();
        for (JsonNode c : read("ml/internship-risk-cases.json")) {
            List<InternshipRiskFeatures.Week> weeks = new ArrayList<>();
            c.path("weeks").forEach(w -> weeks.add(new InternshipRiskFeatures.Week(w.path("submitted").asBoolean(),
                    w.path("late").asBoolean(), w.path("revised").asBoolean(), w.path("work_summary").asText(),
                    w.path("outcomes").asText(), w.path("difficulties").asText())));
            double[] features = InternshipRiskFeatures.compute(weeks, c.path("days_since_last").asLong(), c.path("plan_revisions").asInt());
            assertThat(features).containsExactly(doubles(c.path("features")), within(1e-9));
            assertThat(model.probability(features)).isCloseTo(c.path("probability").asDouble(), within(1e-9));
        }
    }

    /** Both formats are additive: log-odds = constant + Σ contributions, whatever the input. */
    @Test void contributionsAddUpToTheLogOdds() {
        for (MlModel model : List.of(models.internshipRisk().orElseThrow(), models.jobRanker().orElseThrow())) {
            int size = model.features().size();
            double[] low = new double[size];
            double[] high = new double[size];
            for (int i = 0; i < size; i++) { low[i] = 0.05 * i; high[i] = 0.5 + 0.1 * i; }
            assertThat(rootValue(model, low)).as(model.describe().toString()).isCloseTo(rootValue(model, high), within(1e-9));
        }
    }

    @Test void topFactorsListPositiveContributionsLargestFirst() {
        MlModel model = models.internshipRisk().orElseThrow();
        List<MlModel.Factor> factors = model.topFactors(new double[] {0.4, 0.8, 0.6, 5, -0.5, 0.9, 0.7, 25, 4}, 3);
        assertThat(factors).isNotEmpty().hasSizeLessThanOrEqualTo(3);
        for (int i = 1; i < factors.size(); i++) assertThat(factors.get(i - 1).contribution()).isGreaterThanOrEqualTo(factors.get(i).contribution());
    }

    private double rootValue(MlModel model, double[] features) {
        double logOdds = Math.log(model.probability(features) / (1 - model.probability(features)));
        double sum = 0;
        for (double value : model.contributions(features)) sum += value;
        return logOdds - sum;
    }

    private JsonNode read(String path) throws Exception {
        try (InputStream input = new ClassPathResource(path).getInputStream()) {
            return mapper.readTree(input).path("cases");
        }
    }

    private static Set<String> set(JsonNode array) {
        Set<String> result = new HashSet<>();
        array.forEach(node -> result.add(node.asText()));
        return result;
    }

    private static double[] doubles(JsonNode array) {
        double[] result = new double[array.size()];
        for (int i = 0; i < result.length; i++) result[i] = array.get(i).asDouble();
        return result;
    }
}
