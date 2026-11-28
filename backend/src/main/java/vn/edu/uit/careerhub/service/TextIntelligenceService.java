package vn.edu.uit.careerhub.service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.ai.AiClientException;
import vn.edu.uit.careerhub.ai.EmbeddingClient;
import vn.edu.uit.careerhub.config.AiProperties;
import vn.edu.uit.careerhub.entity.NamedRef;
import vn.edu.uit.careerhub.enums.AiCallStatus;
import vn.edu.uit.careerhub.enums.AiFeature;
import vn.edu.uit.careerhub.ml.TextFeatures;
import vn.edu.uit.careerhub.ml.TextModels;
import vn.edu.uit.careerhub.repository.AiRepository;
import vn.edu.uit.careerhub.repository.JobPreferenceRepository;
import vn.edu.uit.careerhub.repository.JobRepository;
import vn.edu.uit.careerhub.repository.TextEmbeddingRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

/**
 * Đợt B: embeddings of job text. Suggests skills/categories while a company writes a post, and ranks
 * open jobs by meaning for a student's search sentence. Both degrade to "not available" (the UI then
 * keeps keyword search and manual tagging) when Gemini is off, unconfigured, over quota or failing.
 */
@Service
public class TextIntelligenceService {
    static final int MAX_SUGGESTED_SKILLS = 8;
    static final int MAX_JOBS_EMBEDDED_PER_REQUEST = 60;
    private static final int QUERY_CACHE_SIZE = 500;

    private final EmbeddingClient embeddings;
    private final TextModels models;
    private final AiProperties properties;
    private final AiRepository ai;
    private final TextEmbeddingRepository store;
    private final JobPreferenceRepository taxonomy;
    private final JobRepository jobs;
    private final Map<String, float[]> queryCache = Collections.synchronizedMap(new LinkedHashMap<>(16, 0.75f, true) {
        @Override protected boolean removeEldestEntry(Map.Entry<String, float[]> eldest) { return size() > QUERY_CACHE_SIZE; }
    });

    public TextIntelligenceService(EmbeddingClient embeddings, TextModels models, AiProperties properties, AiRepository ai,
            TextEmbeddingRepository store, JobPreferenceRepository taxonomy, JobRepository jobs) {
        this.embeddings = embeddings;
        this.models = models;
        this.properties = properties;
        this.ai = ai;
        this.store = store;
        this.taxonomy = taxonomy;
        this.jobs = jobs;
    }

    public Map<String, Object> suggestTags(AuthPrincipal principal, String title, String description, String requirements) {
        String body = (blankToEmpty(description) + " " + blankToEmpty(requirements)).strip();
        if (body.length() < 30) return unavailable("TOO_SHORT", "Hãy viết mô tả và yêu cầu dài hơn để hệ thống gợi ý kỹ năng.");
        String blocked = gate(principal, AiFeature.SKILL_SUGGEST);
        if (blocked != null) return unavailable(blocked, message(blocked));
        long started = System.nanoTime();
        try {
            String text = TextFeatures.jobText(title.strip(), blankToEmpty(description), blankToEmpty(requirements));
            List<float[]> post = embeddings.embed(List.of(TextFeatures.asSimilarity(text), TextFeatures.asSimilarity(title.strip())));
            List<NamedRef> skills = taxonomy.activeSkills();
            List<NamedRef> categories = taxonomy.activeCategories();
            Map<UUID, float[]> skillVectors = labelVectors("SKILL", skills);
            Map<UUID, float[]> categoryVectors = labelVectors("CATEGORY", categories);
            List<Map<String, Object>> skillItems = new ArrayList<>();
            for (NamedRef skill : skills) {
                double[] features = features(text, skill.name(), post, skillVectors.get(skill.id()), models.skillReference());
                double probability = models.skillProbability(features);
                if (probability >= models.skillThreshold()) skillItems.add(item(skill, probability, features[2] == 1));
            }
            skillItems.sort(Comparator.comparingDouble((Map<String, Object> item) -> -(double) item.get("probability")));
            List<Map<String, Object>> categoryItems = new ArrayList<>();
            boolean byCosine = "embedding_cosine".equals(models.categoryMethod());
            for (NamedRef category : categories) {
                double[] features = features(text, category.name(), post, categoryVectors.get(category.id()), models.categoryReference());
                categoryItems.add(item(category, byCosine ? features[0] : models.categoryProbability(features), features[2] == 1));
            }
            categoryItems.sort(Comparator.comparingDouble((Map<String, Object> item) -> -(double) item.get("probability")));
            log(principal, AiFeature.SKILL_SUGGEST, AiCallStatus.SUCCESS, started, null);
            Map<String, Object> result = available();
            result.put("skills", skillItems.subList(0, Math.min(MAX_SUGGESTED_SKILLS, skillItems.size())));
            result.put("categories", categoryItems.subList(0, Math.min(2, categoryItems.size())));
            return result;
        } catch (AiClientException error) {
            return failed(principal, AiFeature.SKILL_SUGGEST, started, error);
        }
    }

    public Map<String, Object> search(AuthPrincipal principal, String query) {
        String blocked = gate(principal, AiFeature.SEMANTIC_SEARCH);
        if (blocked != null) return unavailable(blocked, message(blocked));
        long started = System.nanoTime();
        try {
            List<Map<String, Object>> open = jobs.recruiting(1, 200, null, null, null, null, null).items();
            Map<UUID, float[]> documents = jobDocuments(open);
            String cacheKey = embeddings.model() + "\n" + query.strip().toLowerCase(java.util.Locale.ROOT);
            float[] queryVector = queryCache.get(cacheKey);
            if (queryVector == null) {
                queryVector = embeddings.embed(List.of(TextFeatures.asQuery(query.strip()))).get(0);
                queryCache.put(cacheKey, queryVector);
            }
            double alpha = models.searchAlpha();
            List<Map<String, Object>> items = new ArrayList<>();
            for (Map<String, Object> job : open) {
                UUID id = UUID.fromString(job.get("id").toString());
                float[] vector = documents.get(id);
                if (vector == null) continue;
                double semantic = TextFeatures.dot(queryVector, vector);
                double keyword = TextFeatures.keywordScore(query, text(job));
                Map<String, Object> item = new LinkedHashMap<>();
                item.put("jobId", id);
                item.put("score", alpha * semantic + (1 - alpha) * keyword);
                item.put("semantic", semantic);
                item.put("keyword", keyword);
                items.add(item);
            }
            items.sort(Comparator.comparingDouble((Map<String, Object> item) -> -(double) item.get("score")));
            log(principal, AiFeature.SEMANTIC_SEARCH, AiCallStatus.SUCCESS, started, null);
            Map<String, Object> result = available();
            result.put("items", items);
            return result;
        } catch (AiClientException error) {
            return failed(principal, AiFeature.SEMANTIC_SEARCH, started, error);
        }
    }

    /** null when the call may go ahead, else the status explaining why not (a slot is taken here). */
    private String gate(AuthPrincipal principal, AiFeature feature) {
        if (!properties.configured() || !models.available()) return "NOT_CONFIGURED";
        if (!ai.featureEnabled(feature)) return "DISABLED";
        Integer limit = ai.featureLimit(feature).orElse(null);
        if (limit != null && !ai.reserveFeatureCall(principal.userId(), feature, limit)) {
            log(principal, feature, AiCallStatus.RATE_LIMITED, System.nanoTime(), null);
            return "RATE_LIMITED";
        }
        return null;
    }

    private Map<UUID, float[]> labelVectors(String kind, List<NamedRef> labels) {
        Map<UUID, String> texts = new LinkedHashMap<>();
        labels.forEach(label -> texts.put(label.id(), TextFeatures.asSimilarity(label.name())));
        return cached(kind, texts);
    }

    private Map<UUID, float[]> jobDocuments(List<Map<String, Object>> open) {
        Map<UUID, String> texts = new LinkedHashMap<>();
        for (Map<String, Object> job : open) {
            texts.put(UUID.fromString(job.get("id").toString()), TextFeatures.asDocument(job.get("title").toString(),
                    job.get("description") + " " + job.get("requirements")));
        }
        return cached("JOB_DOCUMENT", texts);
    }

    /** Stored vectors whose text has not changed; the rest are embedded now (bounded per request) and stored. */
    private Map<UUID, float[]> cached(String kind, Map<UUID, String> texts) {
        Map<UUID, TextEmbeddingRepository.Stored> stored = store.find(kind, texts.keySet());
        Map<UUID, float[]> result = new LinkedHashMap<>();
        List<UUID> missing = new ArrayList<>();
        for (Map.Entry<UUID, String> entry : texts.entrySet()) {
            TextEmbeddingRepository.Stored hit = stored.get(entry.getKey());
            if (hit != null && hit.contentHash().equals(hash(entry.getValue()))) result.put(entry.getKey(), hit.vector());
            else if (missing.size() < MAX_JOBS_EMBEDDED_PER_REQUEST) missing.add(entry.getKey());
        }
        if (!missing.isEmpty()) {
            List<float[]> vectors = embeddings.embed(missing.stream().map(texts::get).toList());
            for (int i = 0; i < missing.size(); i++) {
                UUID id = missing.get(i);
                store.save(kind, id, embeddings.model(), hash(texts.get(id)), vectors.get(i));
                result.put(id, vectors.get(i));
            }
        }
        return result;
    }

    static double[] features(String text, String label, List<float[]> post, float[] labelVector, float[][] reference) {
        double[] mention = TextFeatures.mention(text, label);
        double full = labelVector == null ? 0 : TextFeatures.dot(post.get(0), labelVector);
        double title = labelVector == null ? 0 : TextFeatures.dot(post.get(1), labelVector);
        double[] relative = TextFeatures.relative(full, post.get(0), reference);
        return new double[] {full, title, mention[0], mention[1], relative[0], relative[1]};
    }

    private static Map<String, Object> item(NamedRef ref, double probability, boolean mentioned) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", ref.id());
        item.put("name", ref.name());
        item.put("probability", probability);
        item.put("mentioned", mentioned);
        return item;
    }

    private Map<String, Object> available() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", true);
        result.put("model", Map.of("version", models.version(), "embedding", embeddings.model(),
                "trainedOn", models.meta().path("trainedOn").asText()));
        return result;
    }

    private Map<String, Object> failed(AuthPrincipal principal, AiFeature feature, long started, AiClientException error) {
        log(principal, feature, AiCallStatus.FAILED, started, error.code());
        Integer limit = ai.featureLimit(feature).orElse(null);
        if (limit != null && error.providerOverloaded()) ai.releaseFeatureCall(principal.userId(), feature);
        return unavailable("FAILED", "AI đang lỗi hoặc quá tải nên tạm dùng cách tìm thường. Vui lòng thử lại sau.");
    }

    private static Map<String, Object> unavailable(String status, String message) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("available", false);
        result.put("status", status);
        result.put("message", message);
        return result;
    }

    private static String message(String status) {
        return switch (status) {
            case "DISABLED" -> "Nhà trường đang tắt chức năng này.";
            case "RATE_LIMITED" -> "Bạn đã dùng hết lượt của chức năng này hôm nay.";
            default -> "Hệ thống chưa cấu hình AI.";
        };
    }

    private void log(AuthPrincipal principal, AiFeature feature, AiCallStatus status, long started, String errorCode) {
        int latency = (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - started) / 1_000_000);
        ai.logCall(principal.userId(), principal.role(), feature, null, status, embeddings.model(),
                status == AiCallStatus.RATE_LIMITED ? null : latency, null, null, errorCode);
    }

    private String hash(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((embeddings.model() + "\n" + text).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException error) {
            throw new IllegalStateException(error);
        }
    }

    private static String text(Map<String, Object> job) {
        return TextFeatures.jobText(job.get("title").toString(), String.valueOf(job.get("description")), String.valueOf(job.get("requirements")));
    }

    private static String blankToEmpty(String value) { return value == null ? "" : value.strip(); }
}
