package vn.edu.uit.careerhub.ml;

import java.io.InputStream;
import java.util.Optional;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

/**
 * Models bundled under resources/ml. A missing or broken file only disables that model: callers fall
 * back to the rule-based behaviour, the same way the Gemini features degrade.
 */
@Component
public class MlModels {
    private static final Logger log = LoggerFactory.getLogger(MlModels.class);

    private final MlModel jobRanker;
    private final MlModel internshipRisk;

    public MlModels(ObjectMapper mapper, @Value("${app.ml.enabled:true}") boolean enabled) {
        this.jobRanker = enabled ? load(mapper, "ml/job-ranker.json", JobRankingFeatures.NAMES) : null;
        this.internshipRisk = enabled ? load(mapper, "ml/internship-risk.json", InternshipRiskFeatures.NAMES) : null;
    }

    public Optional<MlModel> jobRanker() { return Optional.ofNullable(jobRanker); }

    public Optional<MlModel> internshipRisk() { return Optional.ofNullable(internshipRisk); }

    private static MlModel load(ObjectMapper mapper, String path, java.util.List<String> expected) {
        ClassPathResource resource = new ClassPathResource(path);
        if (!resource.exists()) {
            log.warn("Không có mô hình {}; dùng cách tính dự phòng.", path);
            return null;
        }
        try (InputStream input = resource.getInputStream()) {
            MlModel model = MlModel.from(mapper.readTree(input));
            if (!model.features().equals(expected)) {
                throw new IllegalStateException("Đặc trưng của " + path + " không khớp với mã Java: " + model.features());
            }
            log.info("Đã nạp mô hình {} ({}).", path, model.version());
            return model;
        } catch (Exception error) {
            log.error("Không nạp được mô hình {}; dùng cách tính dự phòng.", path, error);
            return null;
        }
    }
}
