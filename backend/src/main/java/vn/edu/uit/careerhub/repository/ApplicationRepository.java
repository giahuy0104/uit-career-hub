package vn.edu.uit.careerhub.repository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.sql.Types;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.entity.DocumentStorage;
import vn.edu.uit.careerhub.entity.LockedApplication;
import vn.edu.uit.careerhub.entity.SourceDocument;
import vn.edu.uit.careerhub.enums.ApplicationStatus;
import vn.edu.uit.careerhub.util.JsonSupport;
import vn.edu.uit.careerhub.entity.ApplicationTargetJob;
import vn.edu.uit.careerhub.entity.OpenApplication;
import vn.edu.uit.careerhub.entity.SupplementRequest;

@Repository
public class ApplicationRepository {
    private static final String APPLICATION_SELECT = """
      SELECT (jsonb_build_object(
        'id',a.id,'studentProfileId',a.student_profile_id,'status',a.status,'version',a.version,
        'submittedAt',a.submitted_at,'lastTransitionAt',a.last_transition_at,
        'availableActions',CASE
          WHEN a.status='NEEDS_SUPPLEMENT' THEN to_jsonb(ARRAY['RESUBMIT','WITHDRAW'])
          WHEN a.status IN ('UIT_REVIEWING','FORWARDED_TO_COMPANY','COMPANY_REVIEWING') THEN to_jsonb(ARRAY['WITHDRAW'])
          WHEN a.status='INTERVIEW_INVITED' THEN to_jsonb(ARRAY['CANCEL_INTERVIEW'])
          WHEN a.status='OFFER_PENDING_STUDENT' THEN to_jsonb(ARRAY['ACCEPT_OFFER','DECLINE_OFFER'])
          ELSE '[]'::jsonb END,
        'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
          'faculty',sp.faculty,'major',sp.major,'cohort',sp.cohort,'gpa',sp.gpa,
          'academicStatus',sp.academic_status,'email',student_user.email),
        'job',jsonb_build_object('id',j.id,'title',j.title,'opportunityType',j.opportunity_type,
          'workMode',j.work_mode,'location',j.location,'deadline',j.deadline,
          'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name)),
        'documents',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',ad.id,'sourceDocumentId',ad.source_document_id,
          'documentType',ad.document_type,'fileName',ad.file_name,'mimeType',ad.mime_type,
          'fileSizeBytes',ad.file_size_bytes,'sourceVersion',ad.source_version) ORDER BY ad.created_at)
          FROM application_documents ad WHERE ad.application_id=a.id),'[]'::jsonb),
        'recruitmentResult',(SELECT jsonb_build_object('id',rr.id,'outcome',rr.outcome,
          'studentDecision',rr.student_decision,'offeredAt',rr.offered_at,'respondedAt',rr.responded_at,
          'startDate',rr.start_date,'offerDocument',CASE WHEN rr.offer_storage_key IS NULL THEN NULL ELSE
            jsonb_build_object('fileName',COALESCE(odu.file_name,regexp_replace(rr.offer_storage_key,'^.*/','')),
              'mimeType',COALESCE(odu.mime_type,'application/pdf'),'fileSizeBytes',odu.file_size_bytes) END)
          FROM recruitment_results rr LEFT JOIN offer_document_uploads odu ON odu.id=rr.offer_upload_id
          WHERE rr.application_id=a.id),
        'timeline',COALESCE((SELECT jsonb_agg(jsonb_build_object('fromStatus',ah.from_status,'toStatus',ah.to_status,
          'actorType',ah.actor_type,'reasonCode',ah.reason_code,'note',ah.note,'metadata',ah.metadata,
          'createdAt',ah.created_at) ORDER BY ah.created_at) FROM application_status_history ah
          WHERE ah.application_id=a.id),'[]'::jsonb)
      ))::text data
      FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
      JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN users student_user ON student_user.id=sp.user_id
      """;


    private final JdbcClient database;
    private final JsonSupport json;
    public ApplicationRepository(JdbcClient database, JsonSupport json){this.database=database;this.json=json;}



    public Optional<Map<String,Object>> application(UUID applicationId, UUID studentId, UUID companyId, boolean uit){
        String where = uit ? "a.id=:id" : studentId!=null ? "a.id=:id AND a.student_profile_id=:owner" :
                "a.id=:id AND j.company_id=:owner AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')";
        var spec=database.sql(APPLICATION_SELECT+" WHERE "+where).param("id",applicationId);
        if(!uit)spec.param("owner",studentId!=null?studentId:companyId);
        return spec.query(String.class).optional().map(json::object);
    }

    public PageResult applications(UUID studentId,int page,int pageSize,ApplicationStatus status){
        String filter="a.student_profile_id=:owner"+(status==null?"":" AND a.status=:status");
        var count=database.sql("SELECT count(*) FROM applications a WHERE "+filter).param("owner",studentId);
        var rows=database.sql(APPLICATION_SELECT+" WHERE "+filter+" ORDER BY a.submitted_at DESC LIMIT :limit OFFSET :offset")
                .param("owner",studentId).param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(status!=null){count.param("status",status.name());rows.param("status",status.name());}
        return new PageResult(rows.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single());
    }

    public PageResult reviewQueue(int page,int pageSize,boolean placements){
        String status=placements?"ACCEPTED_PENDING_UIT_CONFIRMATION":"UIT_REVIEWING";
        long total=database.sql("SELECT count(*) FROM applications WHERE status=:status").param("status",status).query(Long.class).single();
        String order=placements?"a.last_transition_at ASC,a.id":"a.submitted_at ASC,a.id";
        var items=database.sql(APPLICATION_SELECT+" WHERE a.status=:status ORDER BY "+order+" LIMIT :limit OFFSET :offset")
                .param("status",status).param("limit",pageSize).param("offset",(page-1)*pageSize)
                .query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }

    public PageResult companyCandidates(UUID companyId,int page,int pageSize,UUID jobId,ApplicationStatus status){
        StringBuilder filter=new StringBuilder("j.company_id=:owner AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')");
        Map<String,Object> params=new LinkedHashMap<>();params.put("owner",companyId);
        if(jobId!=null){filter.append(" AND a.job_post_id=:jobId");params.put("jobId",jobId);}
        if(status!=null){filter.append(" AND a.status=:status");params.put("status",status.name());}
        long total=database.sql("SELECT count(*) FROM applications a JOIN job_posts j ON j.id=a.job_post_id WHERE "+filter).params(params).query(Long.class).single();
        params.put("limit",pageSize);params.put("offset",(page-1)*pageSize);
        var items=database.sql(APPLICATION_SELECT+" WHERE "+filter+" ORDER BY a.last_transition_at DESC,a.id LIMIT :limit OFFSET :offset")
                .params(params).query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }


    public Optional<LockedApplication> lockApplication(UUID id){return database.sql("""
      SELECT a.id,a.status,a.version,a.student_profile_id,sp.user_id student_user_id,sp.full_name student_full_name,
        j.id job_id,j.title job_title,c.id company_id,c.name company_name FROM applications a
      JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id WHERE a.id=:id FOR UPDATE OF a
      """).param("id",id).query((r,n)->new LockedApplication(r.getObject("id",UUID.class),ApplicationStatus.valueOf(r.getString("status")),r.getInt("version"),
              r.getObject("student_profile_id",UUID.class),r.getObject("student_user_id",UUID.class),r.getString("student_full_name"),
              r.getObject("job_id",UUID.class),r.getString("job_title"),r.getObject("company_id",UUID.class),r.getString("company_name"))).optional();}

    public boolean commandExists(UUID applicationId,UUID commandId){return database.sql("SELECT count(*) FROM application_status_history WHERE application_id=:id AND command_id=:command")
            .param("id",applicationId).param("command",commandId).query(Long.class).single()>0;}

    public Optional<Map<String,Object>> applicationByCommand(UUID studentId,UUID commandId){return database.sql(APPLICATION_SELECT+"""
      JOIN application_status_history command_history ON command_history.application_id=a.id
      WHERE a.student_profile_id=:studentId AND command_history.command_id=:commandId
      """).param("studentId",studentId).param("commandId",commandId).query(String.class).optional().map(json::object);}




    public Optional<DocumentStorage> applicationDocumentStorage(UUID applicationId,UUID documentId){
        return documentStorage(applicationId,documentId,"",null);
    }

    public Optional<DocumentStorage> companyApplicationDocumentStorage(UUID applicationId,UUID documentId,UUID companyId){
        return documentStorage(applicationId,documentId," AND j.company_id=:companyId AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')",companyId);
    }

    private Optional<DocumentStorage> documentStorage(UUID applicationId,UUID documentId,String companyFilter,UUID companyId){
        var spec=database.sql("""
          SELECT ad.id,ad.storage_key,ad.file_name FROM application_documents ad
          JOIN applications a ON a.id=ad.application_id JOIN job_posts j ON j.id=a.job_post_id
          WHERE ad.application_id=:applicationId AND ad.id=:documentId
          """+companyFilter).param("applicationId",applicationId).param("documentId",documentId);
        if(!companyFilter.isEmpty())spec.param("companyId",companyId);
        return spec.query((r,n)->new DocumentStorage(r.getObject("id",UUID.class),r.getString("storage_key"),r.getString("file_name"))).optional();
    }

    public void lockSubmission(UUID studentId,UUID jobId){
        database.sql("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))").param("key",studentId+":"+jobId).query(Object.class).optional();
    }

    public Optional<ApplicationTargetJob> lockTargetJob(UUID jobId){return database.sql("""
          SELECT j.title,j.status,j.deadline,c.partner_status FROM job_posts j JOIN companies c ON c.id=j.company_id
          WHERE j.id=:id FOR SHARE OF j
          """).param("id",jobId).query((r,n)->new ApplicationTargetJob(r.getString("title"),r.getString("status"),r.getDate("deadline").toLocalDate(),r.getString("partner_status"))).optional();}

    public long countActive(UUID studentId,UUID jobId){return database.sql("""
          SELECT count(*) FROM applications WHERE student_profile_id=:studentId AND job_post_id=:jobId
          AND status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT','FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','OFFER_PENDING_STUDENT','ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED')
          """).param("studentId",studentId).param("jobId",jobId).query(Long.class).single();}

    public UUID insert(UUID studentId,UUID jobId){return database.sql("""
          INSERT INTO applications(student_profile_id,job_post_id,status,consented_at) VALUES(:studentId,:jobId,'UIT_REVIEWING',now()) RETURNING id
          """).param("studentId",studentId).param("jobId",jobId).query(UUID.class).single();}

    public void insertSnapshots(UUID applicationId,List<SourceDocument> documents){for(var d:documents)database.sql("""
      INSERT INTO application_documents(application_id,source_document_id,document_type,file_name,mime_type,file_size_bytes,storage_key,checksum,source_version)
      VALUES(:applicationId,:sourceId,:type,:fileName,:mimeType,:size,:key,:checksum,:version)
      """).param("applicationId",applicationId).param("sourceId",d.id()).param("type",d.documentType()).param("fileName",d.fileName()).param("mimeType",d.mimeType()).param("size",d.fileSizeBytes()).param("key",d.storageKey()).param("checksum",d.checksum(),Types.VARCHAR).param("version",d.version()).update();}

    public void updateStatus(UUID id,String status){database.sql("UPDATE applications SET status=:status,version=version+1,last_transition_at=now() WHERE id=:id").param("status",status).param("id",id).update();}

    public void addHistory(UUID applicationId,UUID commandId,String from,String to,String actorType,UUID actor,String reason,String note,Object metadata){database.sql("""
      INSERT INTO application_status_history(application_id,command_id,from_status,to_status,actor_type,actor_user_id,reason_code,note,metadata)
      VALUES(:applicationId,:commandId,:fromStatus,:toStatus,:actorType,:actor,:reason,:note,CAST(:metadata AS jsonb))
      """).param("applicationId",applicationId).param("commandId",commandId).param("fromStatus",from,Types.VARCHAR).param("toStatus",to)
            .param("actorType",actorType).param("actor",actor,Types.OTHER).param("reason",reason,Types.VARCHAR).param("note",note,Types.VARCHAR).param("metadata",json.stringify(metadata)).update();}

    public Optional<SupplementRequest> latestSupplementRequest(UUID applicationId){return database.sql("""
          SELECT command_id,metadata::text FROM application_status_history WHERE application_id=:id AND to_status='NEEDS_SUPPLEMENT'
          ORDER BY created_at DESC,id DESC LIMIT 1
          """).param("id",applicationId).query((r,n)->new SupplementRequest(r.getObject("command_id",UUID.class),json.object(r.getString("metadata")))).optional();}

    public long countSubmittedDocuments(UUID applicationId,List<UUID> ids){return database.sql("SELECT count(*) FROM application_documents WHERE application_id=:id AND source_document_id IN (:ids)").param("id",applicationId).param("ids",ids).query(Long.class).single();}

    public void markResubmitted(UUID id){database.sql("UPDATE applications SET status='UIT_REVIEWING',consented_at=now(),version=version+1,last_transition_at=now() WHERE id=:id").param("id",id).update();}

    public void markWithdrawn(UUID id){database.sql("UPDATE applications SET status='WITHDRAWN',withdrawn_at=now(),version=version+1,last_transition_at=now() WHERE id=:id").param("id",id).update();}

    public void markAllWithdrawn(List<UUID> ids){database.sql("UPDATE applications SET status='WITHDRAWN',withdrawn_at=now(),version=version+1,last_transition_at=now() WHERE id IN (:ids)").param("ids",ids).update();}

    public long countOtherSelected(UUID studentId,UUID applicationId){return database.sql("SELECT count(*) FROM applications WHERE student_profile_id=:studentId AND id<>:id AND status IN ('ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED')").param("studentId",studentId).param("id",applicationId).query(Long.class).single();}

    public void markOfferResponse(UUID id,String status){database.sql("UPDATE applications SET status=:status,accepted_at=CASE WHEN :status='ACCEPTED_PENDING_UIT_CONFIRMATION' THEN now() ELSE accepted_at END,version=version+1,last_transition_at=now() WHERE id=:id").param("status",status).param("id",id).update();}

    public List<OpenApplication> lockOtherOpen(UUID studentId,UUID applicationId){return database.sql("""
          SELECT a.id,a.status,j.title,c.id company_id FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
          WHERE a.student_profile_id=:studentId AND a.id<>:id AND a.status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT','FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','OFFER_PENDING_STUDENT') FOR UPDATE OF a
          """).param("studentId",studentId).param("id",applicationId).query((r,n)->new OpenApplication(r.getObject("id",UUID.class),r.getString("status"),r.getString("title"),r.getObject("company_id",UUID.class))).list();}

    public void markPlacementConfirmed(UUID id){database.sql("UPDATE applications SET placement_confirmed_at=now() WHERE id=:id").param("id",id).update();}

    public List<UUID> autoWithdrawnIds(UUID commandId,UUID selectedApplicationId){return database.sql("""
      SELECT application_id FROM application_status_history WHERE command_id=:commandId AND to_status='WITHDRAWN'
      AND metadata->>'selectedApplicationId'=:selected ORDER BY application_id
      """).param("commandId",commandId).param("selected",selectedApplicationId.toString()).query(UUID.class).list();}
}
