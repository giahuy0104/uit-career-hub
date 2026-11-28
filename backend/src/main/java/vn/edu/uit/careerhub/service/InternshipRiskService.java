package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.entity.RiskPlacement;
import vn.edu.uit.careerhub.entity.RiskWeeklyLog;
import vn.edu.uit.careerhub.ml.InternshipRiskFeatures;
import vn.edu.uit.careerhub.ml.MlModel;
import vn.edu.uit.careerhub.ml.MlModels;
import vn.edu.uit.careerhub.repository.InternshipRiskRepository;

/**
 * Early warning for UIT: chance that an internship ends badly, from the weekly logs so far. It only
 * ranks who to look at first; it never changes a record or blocks anyone.
 */
@Service
public class InternshipRiskService {
    static final int MIN_SUBMITTED_WEEKS = 2;

    private final InternshipRiskRepository repository;
    private final MlModels models;

    public InternshipRiskService(InternshipRiskRepository repository, MlModels models) {
        this.repository = repository;
        this.models = models;
    }

    public Map<String, Object> assess() {
        Map<String, Object> result = new LinkedHashMap<>();
        MlModel model = models.internshipRisk().orElse(null);
        result.put("available", model != null);
        result.put("model", model == null ? null : model.describe());
        if (model == null) {
            result.put("items", List.of());
            return result;
        }
        double high = model.meta().path("thresholds").path("high").asDouble(0.6);
        double medium = model.meta().path("thresholds").path("medium").asDouble(0.3);
        LocalDate today = repository.today();
        Map<UUID, List<RiskWeeklyLog>> logs = repository.logs().stream()
                .collect(Collectors.groupingBy(RiskWeeklyLog::placementId));
        List<Map<String, Object>> items = new ArrayList<>();
        for (RiskPlacement placement : repository.startedPlacements()) {
            items.add(assess(model, placement, logs.getOrDefault(placement.placementId(), List.of()), today, high, medium));
        }
        items.sort(Comparator.comparingDouble((Map<String, Object> item) -> -((Number) item.getOrDefault("probability", -1.0)).doubleValue()));
        result.put("items", items);
        return result;
    }

    static Map<String, Object> assess(MlModel model, RiskPlacement placement, List<RiskWeeklyLog> logs, LocalDate today,
            double high, double medium) {
        List<InternshipRiskFeatures.Week> weeks = dueWeeks(placement, logs, today);
        long submitted = weeks.stream().filter(InternshipRiskFeatures.Week::submitted).count();
        LocalDate last = logs.stream().map(RiskWeeklyLog::submittedOn).filter(java.util.Objects::nonNull)
                .max(LocalDate::compareTo).orElse(placement.startDate());
        double[] features = InternshipRiskFeatures.compute(weeks, ChronoUnit.DAYS.between(last, today), placement.planRevisions());
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("placementId", placement.placementId());
        item.put("dueWeeks", weeks.size());
        item.put("submittedWeeks", submitted);
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < features.length; i++) values.put(InternshipRiskFeatures.NAMES.get(i), features[i]);
        item.put("features", values);
        if (submitted < MIN_SUBMITTED_WEEKS) {
            item.put("level", "INSUFFICIENT_DATA");
            item.put("probability", -1.0);
            item.put("factors", List.of());
            return item;
        }
        double probability = model.probability(features);
        item.put("probability", probability);
        item.put("level", probability >= high ? "HIGH" : probability >= medium ? "MEDIUM" : "LOW");
        item.put("factors", model.topFactors(features, 3).stream()
                .map(factor -> Map.of("feature", factor.feature(), "value", factor.value())).toList());
        return item;
    }

    /** Weeks 1..n that are due by today (one per full week since the start), plus any week already submitted. */
    static List<InternshipRiskFeatures.Week> dueWeeks(RiskPlacement placement, List<RiskWeeklyLog> logs, LocalDate today) {
        int elapsed = (int) Math.max(0, ChronoUnit.DAYS.between(placement.startDate(), today) / 7);
        int due = Math.max(elapsed, logs.stream().filter(RiskWeeklyLog::submitted).mapToInt(RiskWeeklyLog::weekNumber).max().orElse(0));
        Map<Integer, RiskWeeklyLog> byWeek = logs.stream().collect(Collectors.toMap(RiskWeeklyLog::weekNumber, log -> log, (a, b) -> a));
        List<InternshipRiskFeatures.Week> weeks = new ArrayList<>();
        for (int week = 1; week <= due; week++) {
            RiskWeeklyLog log = byWeek.get(week);
            boolean submitted = log != null && log.submitted();
            weeks.add(new InternshipRiskFeatures.Week(submitted, submitted && log.late(), submitted && log.revised(),
                    submitted ? log.workSummary() : null, submitted ? log.outcomes() : null, submitted ? log.difficulties() : null));
        }
        return weeks;
    }
}
