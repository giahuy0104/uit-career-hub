package vn.edu.uit.careerhub.ml;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.io.InputStream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;

/** Replays ml/train_text.py: same mention features, keyword scores and tagger probabilities in Java. */
class TextParityTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final TextModels models = new TextModels(mapper);

    @Test void mentionFeaturesMatchPython() throws Exception {
        for (JsonNode c : cases().path("mention")) {
            double[] mention = TextFeatures.mention(c.path("text").asText(), c.path("label").asText());
            assertThat(mention[0]).as(c.path("label").asText()).isEqualTo(c.path("mention").get(0).asDouble());
            assertThat(mention[1]).isCloseTo(c.path("mention").get(1).asDouble(), within(1e-12));
        }
    }

    @Test void keywordScoresMatchPython() throws Exception {
        for (JsonNode c : cases().path("keyword")) {
            assertThat(TextFeatures.keywordScore(c.path("query").asText(), c.path("text").asText()))
                    .isCloseTo(c.path("score").asDouble(), within(1e-12));
        }
    }

    @Test void skillTaggerMatchesPython() throws Exception {
        assertThat(models.available()).isTrue();
        for (JsonNode c : cases().path("tagger")) {
            double[] features = new double[6];
            for (int i = 0; i < 6; i++) features[i] = c.path("features").get(i).asDouble();
            assertThat(models.skillProbability(features)).isCloseTo(c.path("probability").asDouble(), within(1e-9));
        }
    }

    @Test void referenceFeaturesMatchPython() throws Exception {
        for (JsonNode c : cases().path("reference")) {
            float[] post = floats(c.path("job"));
            double cos = TextFeatures.dot(post, floats(c.path("label")));
            double[] relative = TextFeatures.relative(cos, post, models.skillReference());
            assertThat(relative[0]).isCloseTo(c.path("relative").get(0).asDouble(), within(1e-4));
            assertThat(relative[1]).isCloseTo(c.path("relative").get(1).asDouble(), within(1e-9));
        }
    }

    private static float[] floats(JsonNode array) {
        float[] result = new float[array.size()];
        for (int i = 0; i < result.length; i++) result[i] = (float) array.get(i).asDouble();
        return result;
    }

    @Test void slashSpellingsAndWordBoundariesCount() {
        assertThat(TextFeatures.mention("Biết HTML và CSS cơ bản", "HTML/CSS")[0]).isEqualTo(1.0);
        assertThat(TextFeatures.mention("Làm việc với JavaScript", "Java")[0]).as("Java is not inside JavaScript").isEqualTo(0.0);
        assertThat(TextFeatures.mention("Dùng Vue.js 3", "Vue.js")[0]).isEqualTo(1.0);
    }

    @Test void taskFormatsMatchTheTrainingScript() {
        assertThat(TextFeatures.asQuery("java")).isEqualTo("task: search result | query: java");
        assertThat(TextFeatures.asDocument(" ", "x")).isEqualTo("title: none | text: x");
        assertThat(TextFeatures.asSimilarity("y")).isEqualTo("task: sentence similarity | query: y");
    }

    private JsonNode cases() throws Exception {
        try (InputStream input = new ClassPathResource("ml/text-cases.json").getInputStream()) {
            return mapper.readTree(input);
        }
    }
}
