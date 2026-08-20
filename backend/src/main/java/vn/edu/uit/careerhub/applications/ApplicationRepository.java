package vn.edu.uit.careerhub.applications;

import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.applications.ApplicationModels.LockedApplication;
import vn.edu.uit.careerhub.applications.ApplicationModels.PageResult;
import vn.edu.uit.careerhub.applications.ApplicationModels.Status;
import vn.edu.uit.careerhub.common.JsonSupport;

@Repository
public class ApplicationRepository {
    public record SourceDocument(UUID id,String documentType,String fileName,String mimeType,long fileSizeBytes,
            String storageKey,String checksum,int version,String verificationStatus) {}
    public record DocumentStorage(UUID id,String storageKey,String fileName) {}
    public record LockedDocument(UUID id,String documentType,String verificationStatus,boolean isDefault,
            String storageKey,boolean usedByApplication) {}
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

    private static final String INTERVIEW_SELECT = """
      SELECT (jsonb_build_object('id',i.id,'applicationId',i.application_id,'scheduledAt',i.scheduled_at,
        'timeZone',i.time_zone,'mode',i.mode,'location',i.location,'meetingUrl',i.meeting_url,
        'interviewerName',i.interviewer_name,'status',i.status,'version',i.version,
        'applicationStatus',a.status,
        'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
          'major',sp.major,'gpa',sp.gpa),
        'job',jsonb_build_object('id',j.id,'title',j.title,'company',jsonb_build_object('id',c.id,'code',c.code,'name',c.name)),
        'recruitmentResult',CASE WHEN rr.id IS NULL THEN NULL ELSE jsonb_build_object('outcome',rr.outcome,
          'studentDecision',rr.student_decision) END))::text data
      FROM interviews i JOIN applications a ON a.id=i.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
      JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
      LEFT JOIN recruitment_results rr ON rr.application_id=a.id
      """;

    private final JdbcClient database;
    private final JsonSupport json;
    public ApplicationRepository(JdbcClient database, JsonSupport json){this.database=database;this.json=json;}
    public JdbcClient database(){return database;}

    public Optional<Map<String,Object>> studentProfile(UUID id){return database.sql("""
      SELECT (jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,'faculty',sp.faculty,
        'major',sp.major,'cohort',sp.cohort,'gpa',sp.gpa,'phone',sp.phone,'academicStatus',sp.academic_status,'email',u.email))::text
      FROM student_profiles sp JOIN users u ON u.id=sp.user_id WHERE sp.id=:id
      """).param("id",id).query(String.class).optional().map(json::object);}

    public List<Map<String,Object>> studentDocuments(UUID studentId){return database.sql("""
      SELECT (jsonb_build_object('id',id,'documentType',document_type,'fileName',file_name,'mimeType',mime_type,
        'fileSizeBytes',file_size_bytes,'version',version,'isDefault',is_default,'verificationStatus',verification_status,
        'createdAt',created_at))::text FROM student_documents WHERE student_profile_id=:id
      ORDER BY document_type,is_default DESC,created_at DESC
      """).param("id",studentId).query(String.class).list().stream().map(json::object).toList();}

    public Optional<Map<String,Object>> application(UUID applicationId, UUID studentId, UUID companyId, boolean uit){
        String where = uit ? "a.id=:id" : studentId!=null ? "a.id=:id AND a.student_profile_id=:owner" :
                "a.id=:id AND j.company_id=:owner AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')";
        var spec=database.sql(APPLICATION_SELECT+" WHERE "+where).param("id",applicationId);
        if(!uit)spec.param("owner",studentId!=null?studentId:companyId);
        return spec.query(String.class).optional().map(json::object);
    }

    public PageResult applications(UUID studentId,int page,int pageSize,Status status){
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

    public PageResult companyCandidates(UUID companyId,int page,int pageSize,UUID jobId,Status status){
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

    public PageResult interviews(UUID owner,boolean company,int page,int pageSize,String scope){
        String ownership=company?"j.company_id=:owner":"a.student_profile_id=:owner";
        String scopeSql="upcoming".equals(scope)?" AND i.scheduled_at>=now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')":
                "history".equals(scope)?" AND (i.scheduled_at<now() OR i.status IN ('CANCELLED','COMPLETED','NO_SHOW'))":"";
        long total=database.sql("SELECT count(*) FROM interviews i JOIN applications a ON a.id=i.application_id JOIN job_posts j ON j.id=a.job_post_id WHERE "+ownership+scopeSql)
                .param("owner",owner).query(Long.class).single();
        var items=database.sql(INTERVIEW_SELECT+" WHERE "+ownership+scopeSql+" ORDER BY CASE WHEN i.scheduled_at>=now() AND i.status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED') THEN 0 ELSE 1 END,i.scheduled_at,i.id LIMIT :limit OFFSET :offset")
                .param("owner",owner).param("limit",pageSize).param("offset",(page-1)*pageSize)
                .query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }

    public Optional<LockedApplication> lockApplication(UUID id){return database.sql("""
      SELECT a.id,a.status,a.version,a.student_profile_id,sp.user_id student_user_id,sp.full_name student_full_name,
        j.id job_id,j.title job_title,c.id company_id,c.name company_name FROM applications a
      JOIN student_profiles sp ON sp.id=a.student_profile_id JOIN job_posts j ON j.id=a.job_post_id
      JOIN companies c ON c.id=j.company_id WHERE a.id=:id FOR UPDATE OF a
      """).param("id",id).query((r,n)->new LockedApplication(r.getObject("id",UUID.class),Status.valueOf(r.getString("status")),r.getInt("version"),
              r.getObject("student_profile_id",UUID.class),r.getObject("student_user_id",UUID.class),r.getString("student_full_name"),
              r.getObject("job_id",UUID.class),r.getString("job_title"),r.getObject("company_id",UUID.class),r.getString("company_name"))).optional();}

    public boolean commandExists(UUID applicationId,UUID commandId){return database.sql("SELECT count(*) FROM application_status_history WHERE application_id=:id AND command_id=:command")
            .param("id",applicationId).param("command",commandId).query(Long.class).single()>0;}

    public Optional<Map<String,Object>> applicationByCommand(UUID studentId,UUID commandId){return database.sql(APPLICATION_SELECT+"""
      JOIN application_status_history command_history ON command_history.application_id=a.id
      WHERE a.student_profile_id=:studentId AND command_history.command_id=:commandId
      """).param("studentId",studentId).param("commandId",commandId).query(String.class).optional().map(json::object);}

    public List<SourceDocument> sourceDocuments(UUID studentId,List<UUID> ids){
        if(ids.isEmpty())return List.of();
        return database.sql("""
          SELECT id,document_type,file_name,mime_type,file_size_bytes,storage_key,checksum,version,verification_status
          FROM student_documents WHERE student_profile_id=:studentId AND id IN (:ids) FOR SHARE
          """).param("studentId",studentId).param("ids",ids).query((r,n)->new SourceDocument(r.getObject("id",UUID.class),r.getString("document_type"),
                r.getString("file_name"),r.getString("mime_type"),r.getLong("file_size_bytes"),r.getString("storage_key"),
                r.getString("checksum"),r.getInt("version"),r.getString("verification_status"))).list();
    }

    public Optional<LockedDocument> lockStudentDocument(UUID studentId,UUID documentId){return database.sql("""
      SELECT sd.id,sd.document_type,sd.verification_status,sd.is_default,sd.storage_key,
        EXISTS(SELECT 1 FROM application_documents ad WHERE ad.source_document_id=sd.id) used_by_application
      FROM student_documents sd WHERE sd.id=:id AND sd.student_profile_id=:studentId FOR UPDATE
      """).param("id",documentId).param("studentId",studentId).query((r,n)->new LockedDocument(r.getObject("id",UUID.class),r.getString("document_type"),
              r.getString("verification_status"),r.getBoolean("is_default"),r.getString("storage_key"),r.getBoolean("used_by_application"))).optional();}

    public Optional<DocumentStorage> studentDocumentStorage(UUID studentId,UUID documentId){return database.sql("""
      SELECT id,storage_key,file_name FROM student_documents WHERE id=:id AND student_profile_id=:studentId
      """).param("id",documentId).param("studentId",studentId).query((r,n)->new DocumentStorage(r.getObject("id",UUID.class),r.getString("storage_key"),r.getString("file_name"))).optional();}

    public Optional<DocumentStorage> applicationDocumentStorage(UUID applicationId,UUID documentId,UUID companyId){
        String companyFilter=companyId==null?"":" AND j.company_id=:companyId AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')";
        var spec=database.sql("""
          SELECT ad.id,ad.storage_key,ad.file_name FROM application_documents ad
          JOIN applications a ON a.id=ad.application_id JOIN job_posts j ON j.id=a.job_post_id
          WHERE ad.application_id=:applicationId AND ad.id=:documentId
          """+companyFilter).param("applicationId",applicationId).param("documentId",documentId);
        if(companyId!=null)spec.param("companyId",companyId);
        return spec.query((r,n)->new DocumentStorage(r.getObject("id",UUID.class),r.getString("storage_key"),r.getString("file_name"))).optional();
    }

    public Optional<Map<String,Object>> interviewByCommand(UUID applicationId,UUID commandId){return database.sql("""
      SELECT (jsonb_build_object('id',id,'applicationId',application_id,'scheduledAt',scheduled_at,'timeZone',time_zone,
        'mode',mode,'location',location,'meetingUrl',meeting_url,'interviewerName',interviewer_name,'status',status,'version',version))::text
      FROM interviews WHERE application_id=:applicationId AND command_id=:commandId
      """).param("applicationId",applicationId).param("commandId",commandId).query(String.class).optional().map(json::object);}

    public Optional<Map<String,Object>> studentInterview(UUID interviewId,UUID studentId){return database.sql(INTERVIEW_SELECT+" WHERE i.id=:id AND a.student_profile_id=:studentId")
            .param("id",interviewId).param("studentId",studentId).query(String.class).optional().map(json::object);}

    public PageResult studentDocumentsForReview(int page,int pageSize,String status,String query){
        String search=query==null||query.isBlank()?null:query.strip();
        long total=database.sql("""
          SELECT count(*) FROM student_documents sd JOIN student_profiles sp ON sp.id=sd.student_profile_id
          WHERE sd.verification_status=:status AND (:query::text IS NULL OR sp.full_name ILIKE '%'||:query||'%'
            OR sp.student_code ILIKE '%'||:query||'%' OR sd.file_name ILIKE '%'||:query||'%')
          """).param("status",status).param("query",search,java.sql.Types.VARCHAR).query(Long.class).single();
        var items=database.sql("""
          SELECT (jsonb_build_object('id',sd.id,'documentType',sd.document_type,'fileName',sd.file_name,'mimeType',sd.mime_type,
            'fileSizeBytes',sd.file_size_bytes,'version',sd.version,'isDefault',sd.is_default,'verificationStatus',sd.verification_status,
            'createdAt',sd.created_at,'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,
              'email',u.email,'faculty',sp.faculty,'major',sp.major)))::text
          FROM student_documents sd JOIN student_profiles sp ON sp.id=sd.student_profile_id JOIN users u ON u.id=sp.user_id
          WHERE sd.verification_status=:status AND (:query::text IS NULL OR sp.full_name ILIKE '%'||:query||'%'
            OR sp.student_code ILIKE '%'||:query||'%' OR sd.file_name ILIKE '%'||:query||'%')
          ORDER BY sd.created_at,sd.id LIMIT :limit OFFSET :offset
          """).param("status",status).param("query",search,java.sql.Types.VARCHAR).param("limit",pageSize).param("offset",(page-1)*pageSize)
                .query(String.class).list().stream().map(json::object).toList();
        return new PageResult(items,total);
    }

    public Optional<Map<String,Object>> studentDocumentForReview(UUID id,boolean lock){return database.sql("""
      SELECT (jsonb_build_object('id',sd.id,'documentType',sd.document_type,'fileName',sd.file_name,'mimeType',sd.mime_type,
        'fileSizeBytes',sd.file_size_bytes,'version',sd.version,'isDefault',sd.is_default,'verificationStatus',sd.verification_status,
        'createdAt',sd.created_at,'storageKey',sd.storage_key,'studentUserId',sp.user_id,'studentProfileId',sp.id,
        'student',jsonb_build_object('id',sp.id,'studentCode',sp.student_code,'fullName',sp.full_name,'email',u.email,
          'faculty',sp.faculty,'major',sp.major)))::text
      FROM student_documents sd JOIN student_profiles sp ON sp.id=sd.student_profile_id JOIN users u ON u.id=sp.user_id
      WHERE sd.id=:id
      """+(lock?" FOR UPDATE OF sd":"")).param("id",id).query(String.class).optional().map(json::object);}
}
