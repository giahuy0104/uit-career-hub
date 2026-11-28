package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.entity.JobMatch;
import vn.edu.uit.careerhub.entity.JobPreferences;
import vn.edu.uit.careerhub.entity.RiskWeeklyLog;
import vn.edu.uit.careerhub.ml.InternshipRiskFeatures;
import vn.edu.uit.careerhub.ml.JobRankingFeatures;
import vn.edu.uit.careerhub.repository.InternshipRiskRepository;
import vn.edu.uit.careerhub.repository.JobPreferenceRepository;
import vn.edu.uit.careerhub.repository.JobRepository;

/**
 * Turns real usage into training rows for ml/train_*.py --data, with the same Java feature code the
 * live models use (no train/serve skew). Ranking rows are rebuilt as of the first impression, except
 * the student's skills and preferences, which are only stored as they are now.
 */
@Service
public class MlTrainingDataService {
    private final JobRepository jobs;
    private final JobPreferenceRepository preferences;
    private final InternshipRiskRepository risk;

    public MlTrainingDataService(JobRepository jobs, JobPreferenceRepository preferences, InternshipRiskRepository risk) {
        this.jobs = jobs;
        this.preferences = preferences;
        this.risk = risk;
    }

    /** Columns: ranking features..., label, group (one group per student). */
    public List<double[]> rankerRows() {
        List<double[]> rows = new ArrayList<>();
        Map<UUID, Integer> groups = new HashMap<>();
        Map<UUID, JobPreferences> students = new HashMap<>();
        for (JobRepository.Impression impression : jobs.impressions()) {
            Map<String, Object> job = jobs.findById(impression.jobId()).orElse(null);
            if (job == null) continue;
            JobPreferences student = students.computeIfAbsent(impression.studentProfileId(), preferences::find);
            JobMatch match = JobMatchScorer.score(student, JobMatchScorer.skills(job), JobMatchScorer.categoryIds(job),
                    job.get("opportunityType").toString());
            LocalDate seen = impression.seenAt().atZoneSameInstant(JobRecommendationService.VIETNAM).toLocalDate();
            UUID company = UUID.fromString(((Map<?, ?>) job.get("company")).get("id").toString());
            double[] features = JobRecommendationService.features(
                    new JobRecommendationService.Ranked(job, match, null, List.of()),
                    ids(student.skills()), ids(student.categories()),
                    student.opportunityTypes().stream().map(Enum::name).collect(Collectors.toSet()),
                    jobs.applicationCategoriesBefore(impression.studentProfileId(), impression.seenAt()),
                    Map.of(company, jobs.companyApplicationsBefore(company, impression.seenAt())), seen);
            double[] row = new double[features.length + 2];
            System.arraycopy(features, 0, row, 0, features.length);
            row[features.length] = impression.applied() ? 1 : 0;
            row[features.length + 1] = groups.computeIfAbsent(impression.studentProfileId(), key -> groups.size());
            rows.add(row);
        }
        return rows;
    }

    /** Columns: risk features as of the end of the internship..., label. */
    public List<double[]> riskRows() {
        Map<UUID, List<RiskWeeklyLog>> logs = risk.logs("COMPLETED").stream()
                .collect(Collectors.groupingBy(RiskWeeklyLog::placementId));
        List<double[]> rows = new ArrayList<>();
        for (InternshipRiskRepository.LabelledPlacement item : risk.completedWithEvaluation()) {
            List<RiskWeeklyLog> placementLogs = logs.getOrDefault(item.placement().placementId(), List.of());
            List<InternshipRiskFeatures.Week> weeks = InternshipRiskService.dueWeeks(item.placement(), placementLogs, item.completedDate());
            LocalDate last = placementLogs.stream().map(RiskWeeklyLog::submittedOn).filter(java.util.Objects::nonNull)
                    .max(LocalDate::compareTo).orElse(item.placement().startDate());
            double[] features = InternshipRiskFeatures.compute(weeks, ChronoUnit.DAYS.between(last, item.completedDate()),
                    item.placement().planRevisions());
            double[] row = new double[features.length + 1];
            System.arraycopy(features, 0, row, 0, features.length);
            row[features.length] = item.bad() ? 1 : 0;
            rows.add(row);
        }
        return rows;
    }

    private static Set<String> ids(List<vn.edu.uit.careerhub.entity.NamedRef> refs) {
        return refs.stream().map(ref -> ref.id().toString()).collect(Collectors.toSet());
    }
}
