package vn.edu.uit.careerhub.repository;

import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.request.OfferUploadRequest;
import vn.edu.uit.careerhub.entity.DocumentStorage;
import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.enums.UserRole;

@Repository
public class RecruitmentResultRepository {
    private final JdbcClient database;

    public RecruitmentResultRepository(JdbcClient database) { this.database = database; }

    public void createOfferUpload(UUID id, UUID applicationId, UUID companyId, UUID actor, OfferUploadRequest input, String key, Instant expires) {
        database.sql("""
          INSERT INTO offer_document_uploads(id,application_id,company_id,created_by_user_id,file_name,mime_type,file_size_bytes,storage_key,expires_at)
          VALUES(:id,:applicationId,:companyId,:actor,:fileName,:mimeType,:size,:key,:expires)
          """).param("id",id).param("applicationId",applicationId).param("companyId",companyId).param("actor",actor)
                .param("fileName",input.fileName().strip()).param("mimeType",input.mimeType()).param("size",input.fileSizeBytes()).param("key",key)
                .param("expires",OffsetDateTime.ofInstant(expires,ZoneOffset.UTC)).update();
    }

    public Optional<DocumentUpload> lockOfferUpload(UUID companyId, UUID applicationId, UUID uploadId) {
        return database.sql("""
      SELECT id,company_id owner_id,application_id,NULL::text document_type,file_name,mime_type,file_size_bytes,storage_key,status,expires_at,NULL::uuid student_document_id
      FROM offer_document_uploads WHERE id=:id AND company_id=:owner AND application_id=:applicationId FOR UPDATE
      """).param("id",uploadId).param("owner",companyId).param("applicationId",applicationId).query(UploadRowMapper::map).optional();
    }

    public void expireOfferUpload(UUID uploadId) {
        database.sql("UPDATE offer_document_uploads SET status='EXPIRED' WHERE id=:id").param("id",uploadId).update();
    }

    public void completeOfferUpload(UUID uploadId, String etag) {
        database.sql("UPDATE offer_document_uploads SET status='COMPLETED',etag=:etag,completed_at=now() WHERE id=:id")
                .param("etag",etag,Types.VARCHAR).param("id",uploadId).update();
    }

    public void consumeOfferUpload(UUID uploadId) {
        database.sql("UPDATE offer_document_uploads SET status='CONSUMED',consumed_at=now() WHERE id=:id AND status='COMPLETED'").param("id",uploadId).update();
    }

    public void insert(UUID id, UUID applicationId, UUID commandId, UUID actor, String outcome, LocalDate startDate, String offerKey, UUID offerUploadId, String note) {
        database.sql("""
          INSERT INTO recruitment_results(id,application_id,command_id,decided_by_user_id,outcome,offered_at,start_date,offer_storage_key,offer_upload_id,internal_note)
          VALUES(:id,:applicationId,:commandId,:actor,:outcome,CASE WHEN :outcome='PASS' THEN now() END,:startDate,:key,:uploadId,:note)
          """).param("id",id).param("applicationId",applicationId).param("commandId",commandId).param("actor",actor).param("outcome",outcome)
                .param("startDate",startDate,Types.DATE).param("key",offerKey,Types.VARCHAR)
                .param("uploadId",offerUploadId,Types.OTHER).param("note",note,Types.VARCHAR).update();
    }

    public int recordStudentDecision(UUID applicationId, String decision) {
        return database.sql("UPDATE recruitment_results SET student_decision=:decision,responded_at=now() WHERE application_id=:id AND outcome='PASS' AND student_decision IS NULL")
                .param("decision",decision).param("id",applicationId).update();
    }

    public int updateAcceptedStartDate(UUID applicationId, LocalDate startDate) {
        return database.sql("UPDATE recruitment_results SET start_date=:date WHERE application_id=:id AND outcome='PASS' AND student_decision='ACCEPTED'")
                .param("date",startDate).param("id",applicationId).update();
    }

    public Optional<DocumentStorage> offerDocument(UUID applicationId, UserRole actor, UUID owner) {
        String scope=switch(actor){
            case STUDENT->"a.student_profile_id=:owner";
            case COMPANY->"j.company_id=:owner AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')";
            case UIT_ADMIN->"TRUE";
        };
        var spec=database.sql("""
          SELECT rr.id,rr.offer_storage_key,COALESCE(odu.file_name,regexp_replace(rr.offer_storage_key,'^.*/','')) file_name
          FROM recruitment_results rr JOIN applications a ON a.id=rr.application_id JOIN job_posts j ON j.id=a.job_post_id
          LEFT JOIN offer_document_uploads odu ON odu.id=rr.offer_upload_id WHERE rr.application_id=:applicationId
          AND rr.outcome='PASS' AND rr.offer_storage_key IS NOT NULL AND
          """+scope).param("applicationId",applicationId);
        if(actor!=UserRole.UIT_ADMIN)spec.param("owner",owner);
        return spec.query((r,n)->new DocumentStorage(r.getObject("id",UUID.class),r.getString("offer_storage_key"),r.getString("file_name"))).optional();
    }
}
