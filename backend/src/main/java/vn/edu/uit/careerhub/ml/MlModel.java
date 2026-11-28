package vn.edu.uit.careerhub.ml;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * A model trained in ml/ (Python) and exported as JSON. The backend only evaluates it: no Python at
 * runtime. Two formats exist because training keeps whichever wins on the validation split.
 */
public sealed interface MlModel permits LogisticModel, GbdtModel {
    List<String> features();

    /** Training metadata from the JSON file (name, version, trainedOn, thresholds, test metrics...). */
    JsonNode meta();

    double probability(double[] features);

    /** Additive contribution of each feature to the log-odds, used to explain a single prediction. */
    double[] contributions(double[] features);

    default String version() { return meta().path("version").asText(); }

    default String trainedOn() { return meta().path("trainedOn").asText(); }

    /** Below this change in log-odds a feature is not worth showing as a reason. */
    double MIN_SHOWN_CONTRIBUTION = 0.1;

    /** Features that pushed this prediction up noticeably, largest first. */
    default List<Factor> topFactors(double[] features, int limit) {
        double[] contributions = contributions(features);
        List<Factor> factors = new ArrayList<>();
        for (int i = 0; i < contributions.length; i++) {
            if (contributions[i] >= MIN_SHOWN_CONTRIBUTION) factors.add(new Factor(features().get(i), features[i], contributions[i]));
        }
        factors.sort(Comparator.comparingDouble(Factor::contribution).reversed());
        return factors.subList(0, Math.min(limit, factors.size()));
    }

    default Map<String, Object> describe() {
        return Map.of("name", meta().path("name").asText(), "version", version(), "trainedOn", trainedOn(),
                "type", this instanceof GbdtModel ? "lightgbm" : "logistic_regression");
    }

    record Factor(String feature, double value, double contribution) {}

    static double sigmoid(double value) { return 1 / (1 + Math.exp(-value)); }

    static MlModel from(JsonNode json) {
        return switch (json.path("type").asText()) {
            case "logistic" -> LogisticModel.from(json);
            case "gbdt" -> GbdtModel.from(json);
            default -> throw new IllegalArgumentException("Loại mô hình không hỗ trợ: " + json.path("type").asText());
        };
    }
}
