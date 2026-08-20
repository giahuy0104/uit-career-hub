package vn.edu.uit.careerhub.placements;

import java.time.LocalDate;
import java.util.UUID;

public final class PlacementModels {
    private PlacementModels() {}
    public enum Status { HIRED, STARTED, COMPLETED }
    public enum EvaluationRole { STUDENT, COMPANY }
    public record PageResult(java.util.List<java.util.Map<String,Object>> items,long total,java.util.Map<String,Long> summary) {}
    public record Locked(UUID id,UUID applicationId,Status status,int version,LocalDate actualStartDate,UUID studentUserId,
            String studentName,String jobTitle,UUID companyId,String companyName) {}
    public record Context(UUID placementId,UUID applicationId,Status status,LocalDate expectedStartDate,LocalDate actualStartDate,
            LocalDate completedDate,UUID studentProfileId,UUID studentUserId,String studentName,UUID companyId,String companyName,String jobTitle) {}
}
