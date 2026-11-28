package vn.edu.uit.careerhub.ml;

import java.io.InputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/** Skill/category tagger and search mix from ml/train_text.py (resources/ml/text-models.json). */
@Component
public class TextModels {
    private static final Logger log = LoggerFactory.getLogger(TextModels.class);
    private final JsonNode json;
    private final float[][] skillReference;
    private final float[][] categoryReference;

    public TextModels(ObjectMapper mapper) {
        JsonNode loaded = null;
        try (InputStream input = new ClassPathResource("ml/text-models.json").getInputStream()) {
            loaded = mapper.readTree(input);
            if (!LogisticModel.strings(loaded.path("skillTagger").path("features")).equals(TextFeatures.TAG_FEATURES)) {
                throw new IllegalStateException("Đặc trưng của text-models.json không khớp mã Java.");
            }
        } catch (Exception error) {
            log.error("Không nạp được ml/text-models.json; tắt gợi ý kỹ năng và tìm theo nghĩa.", error);
            loaded = null;
        }
        this.json = loaded;
        this.skillReference = loaded == null ? new float[0][] : vectors(loaded.path("skillReference"));
        this.categoryReference = loaded == null ? new float[0][] : vectors(loaded.path("categoryReference"));
    }

    public float[][] skillReference() { return skillReference; }

    public float[][] categoryReference() { return categoryReference; }

    /** "embedding_cosine" or "logistic_regression", whichever won on the validation split. */
    public String categoryMethod() { return json.path("categoryTagger").path("method").asText("logistic_regression"); }

    public boolean available() { return json != null; }

    public double skillProbability(double[] features) { return probability(json.path("skillTagger"), features); }

    public double skillThreshold() { return json.path("skillTagger").path("threshold").asDouble(0.5); }

    public double categoryProbability(double[] features) { return probability(json.path("categoryTagger"), features); }

    public double searchAlpha() { return json.path("search").path("alpha").asDouble(0.7); }

    public String version() { return json.path("version").asText(); }

    public JsonNode meta() { return json; }

    private static float[][] vectors(JsonNode array) {
        float[][] result = new float[array.size()][];
        for (int i = 0; i < result.length; i++) {
            JsonNode row = array.get(i);
            result[i] = new float[row.size()];
            for (int j = 0; j < row.size(); j++) result[i][j] = (float) row.get(j).asDouble();
        }
        return result;
    }

    private static double probability(JsonNode model, double[] features) {
        double sum = model.path("intercept").asDouble();
        for (int i = 0; i < features.length; i++) sum += model.path("coef").get(i).asDouble() * features[i];
        return MlModel.sigmoid(sum);
    }
}
