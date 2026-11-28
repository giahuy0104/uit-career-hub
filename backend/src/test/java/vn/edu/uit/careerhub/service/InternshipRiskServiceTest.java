package vn.edu.uit.careerhub.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import vn.edu.uit.careerhub.entity.RiskPlacement;
import vn.edu.uit.careerhub.entity.RiskWeeklyLog;
import vn.edu.uit.careerhub.ml.InternshipRiskFeatures;
import vn.edu.uit.careerhub.ml.MlModel;
import vn.edu.uit.careerhub.ml.MlModels;

class InternshipRiskServiceTest {
    private final MlModel model = new MlModels(new ObjectMapper(), true).internshipRisk().orElseThrow();
    private final UUID id = UUID.randomUUID();
    private final LocalDate start = LocalDate.of(2026, 11, 2);
    private final RiskPlacement placement = new RiskPlacement(id, start, 0);

    private RiskWeeklyLog log(int week, String summary, String outcomes, boolean late) {
        return new RiskWeeklyLog(id, week, true, late, false, start.plusDays(7L * week), summary, outcomes, "");
    }

    @Test void everyFullWeekSinceTheStartIsDueAndUnsubmittedWeeksCountAsMissing() {
        List<InternshipRiskFeatures.Week> weeks = InternshipRiskService.dueWeeks(placement,
                List.of(log(1, "Làm quen dự án", "Chạy được", false), log(3, "Viết API", "Xong", false)), start.plusDays(26));

        assertThat(weeks).hasSize(3);
        assertThat(weeks).extracting(InternshipRiskFeatures.Week::submitted).containsExactly(true, false, true);
    }

    @Test void aWeekSubmittedEarlyIsCountedEvenBeforeItIsDue() {
        assertThat(InternshipRiskService.dueWeeks(placement, List.of(log(1, "a", "b", false)), start.plusDays(3))).hasSize(1);
    }

    @Test void fewerThanTwoSubmittedWeeksIsNotEnoughToScore() {
        Map<String, Object> item = InternshipRiskService.assess(model, placement, List.of(log(1, "Làm quen", "Chạy được", false)),
                start.plusDays(9), 0.6, 0.3);

        assertThat(item.get("level")).isEqualTo("INSUFFICIENT_DATA");
        assertThat(item.get("factors")).isEqualTo(List.of());
    }

    @Test void shortLateRepeatedLogsScoreHigherThanDetailedOnTimeOnes() {
        LocalDate today = start.plusDays(29);
        String detailed = "Thiết kế cơ sở dữ liệu cho module báo cáo, viết migration, seed dữ liệu mẫu và review với mentor";
        Map<String, Object> good = InternshipRiskService.assess(model, placement, List.of(
                log(1, detailed, "Hoàn thành 3 bảng và tài liệu thiết kế", false),
                log(2, "Xây dựng API báo cáo theo khoa ngành, tối ưu truy vấn bằng index", "API chạy dưới 200ms", false),
                log(3, "Viết kiểm thử tích hợp cho API báo cáo, sửa lỗi phân trang", "Đạt 85% coverage", false),
                log(4, "Làm giao diện React cho báo cáo, thêm bộ lọc và xuất CSV", "Demo cho team", false)), today, 0.6, 0.3);
        Map<String, Object> poor = InternshipRiskService.assess(model, placement, List.of(
                log(1, "học docker", "ok", true), log(2, "học docker", "", true)), today, 0.6, 0.3);

        assertThat((double) poor.get("probability")).isGreaterThan((double) good.get("probability"));
        assertThat(poor.get("level")).isNotEqualTo("LOW");
        assertThat((List<?>) poor.get("factors")).isNotEmpty();
    }
}
