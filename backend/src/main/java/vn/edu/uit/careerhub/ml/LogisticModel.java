package vn.edu.uit.careerhub.ml;

import java.util.ArrayList;
import java.util.List;

import com.fasterxml.jackson.databind.JsonNode;

/** Standardised logistic regression: p = sigmoid(intercept + Σ coef_i · (x_i - mean_i) / scale_i). */
public final class LogisticModel implements MlModel {
    private final List<String> features;
    private final double[] mean;
    private final double[] scale;
    private final double[] coef;
    private final double intercept;
    private final JsonNode meta;

    private LogisticModel(List<String> features, double[] mean, double[] scale, double[] coef, double intercept, JsonNode meta) {
        if (mean.length != features.size() || scale.length != features.size() || coef.length != features.size()) {
            throw new IllegalArgumentException("Số hệ số không khớp số đặc trưng.");
        }
        this.features = List.copyOf(features);
        this.mean = mean;
        this.scale = scale;
        this.coef = coef;
        this.intercept = intercept;
        this.meta = meta;
    }

    static LogisticModel from(JsonNode json) {
        return new LogisticModel(strings(json.path("features")), doubles(json.path("mean")), doubles(json.path("scale")),
                doubles(json.path("coef")), json.path("intercept").asDouble(), json);
    }

    @Override public List<String> features() { return features; }

    @Override public JsonNode meta() { return meta; }

    @Override
    public double probability(double[] x) {
        double sum = intercept;
        for (double value : contributions(x)) sum += value;
        return MlModel.sigmoid(sum);
    }

    @Override
    public double[] contributions(double[] x) {
        double[] result = new double[coef.length];
        for (int i = 0; i < coef.length; i++) result[i] = coef[i] * (x[i] - mean[i]) / (scale[i] == 0 ? 1 : scale[i]);
        return result;
    }

    static List<String> strings(JsonNode array) {
        List<String> result = new ArrayList<>();
        array.forEach(node -> result.add(node.asText()));
        return result;
    }

    static double[] doubles(JsonNode array) {
        double[] result = new double[array.size()];
        for (int i = 0; i < result.length; i++) result[i] = array.get(i).asDouble();
        return result;
    }
}
