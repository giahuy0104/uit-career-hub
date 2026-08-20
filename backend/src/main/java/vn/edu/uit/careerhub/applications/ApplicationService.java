package vn.edu.uit.careerhub.applications;

import java.nio.charset.StandardCharsets;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import vn.edu.uit.careerhub.applications.ApplicationModels.LockedApplication;
import vn.edu.uit.careerhub.applications.ApplicationModels.PageResult;
import vn.edu.uit.careerhub.applications.ApplicationModels.Status;
import vn.edu.uit.careerhub.applications.ApplicationRequests.DocumentReview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.DocumentUpload;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Interview;
import vn.edu.uit.careerhub.applications.ApplicationRequests.OfferUpload;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Placement;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Reason;
import vn.edu.uit.careerhub.applications.ApplicationRequests.RecruitmentResult;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Resubmit;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Submit;
import vn.edu.uit.careerhub.applications.ApplicationRequests.Supplement;
import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.common.JsonSupport;
import vn.edu.uit.careerhub.config.AppProperties;
import vn.edu.uit.careerhub.storage.ObjectStorage;

@Service
public class ApplicationService {
    private record Upload(UUID id,UUID ownerId,UUID applicationId,String documentType,String fileName,String mimeType,
            long size,String storageKey,String status,Instant expiresAt,UUID documentId) {}
    private final ApplicationRepository repository;
    private final ObjectStorage storage;
    private final AppProperties properties;
    private final JsonSupport json;

    public ApplicationService(ApplicationRepository repository,ObjectProvider<ObjectStorage> storage,
            AppProperties properties,JsonSupport json){this.repository=repository;this.storage=storage.getIfAvailable();this.properties=properties;this.json=json;}

    public Map<String,Object> studentProfile(UUID id){return repository.studentProfile(id).orElseThrow(this::studentNotFound);}
    public List<Map<String,Object>> studentDocuments(UUID id){return repository.studentDocuments(id);}
    public Map<String,Object> application(UUID id,UUID studentId){return repository.application(id,studentId,null,false).orElseThrow(this::applicationNotFound);}
    public PageResult applications(UUID studentId,int page,int pageSize,Status status){return repository.applications(studentId,page,pageSize,status);}
    public PageResult reviewQueue(int page,int pageSize,boolean placements){return repository.reviewQueue(page,pageSize,placements);}
    public PageResult companyCandidates(UUID companyId,int page,int pageSize,UUID jobId,Status status){return repository.companyCandidates(companyId,page,pageSize,jobId,status);}
    public PageResult interviews(UUID owner,boolean company,int page,int pageSize,String scope){return repository.interviews(owner,company,page,pageSize,scope);}
    public PageResult documentsForReview(int page,int pageSize,String status,String query){return repository.studentDocumentsForReview(page,pageSize,status,query);}

    @Transactional
    public Map<String,Object> updateProfile(AuthPrincipal principal,String phone,RequestMetadata request){
        int changed=repository.database().sql("UPDATE student_profiles SET phone=:phone WHERE id=:id")
                .param("phone",phone==null||phone.isBlank()?null:phone.strip(),Types.VARCHAR).param("id",principal.studentProfileId()).update();
        if(changed==0)throw studentNotFound();audit(principal.userId(),"STUDENT_PROFILE_UPDATED","STUDENT_PROFILE",principal.studentProfileId(),Map.of("changedFields",List.of("phone")),request);
        return studentProfile(principal.studentProfileId());
    }

    public Map<String,Object> createStudentUpload(AuthPrincipal principal,DocumentUpload input){
        ObjectStorage objects=storage();UUID id=UUID.randomUUID();String key="students/"+principal.studentProfileId()+"/"+input.documentType().name().toLowerCase()+"/"+id+".pdf";
        Instant expires=Instant.now().plusSeconds(properties.storage().uploadUrlTtlSeconds());
        String url=objects.createUploadUrl(key,input.mimeType(),properties.storage().uploadUrlTtlSeconds());
        repository.database().sql("""
          INSERT INTO student_document_uploads(id,student_profile_id,document_type,file_name,mime_type,file_size_bytes,storage_key,expires_at)
          VALUES(:id,:studentId,:type,:fileName,:mimeType,:size,:key,:expires)
          """).param("id",id).param("studentId",principal.studentProfileId()).param("type",input.documentType().name())
                .param("fileName",input.fileName().strip()).param("mimeType",input.mimeType()).param("size",input.fileSizeBytes())
                .param("key",key).param("expires",OffsetDateTime.ofInstant(expires,ZoneOffset.UTC)).update();
        return uploadIntent(id,url,expires);
    }

    @Transactional
    public List<Map<String,Object>> completeStudentUpload(AuthPrincipal principal,UUID uploadId,RequestMetadata request){
        Upload upload=studentUpload(principal.studentProfileId(),uploadId,true).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_UPLOAD_NOT_FOUND","Không tìm thấy phiên tải tài liệu."));
        if("COMPLETED".equals(upload.status()))return studentDocuments(principal.studentProfileId());
        validateUploadState(upload,"STUDENT_DOCUMENT");ObjectStorage objects=storage();verifyPdf(objects,upload,"STUDENT_DOCUMENT");
        UUID documentId=UUID.randomUUID();
        repository.database().sql("""
          INSERT INTO student_documents(id,student_profile_id,document_type,file_name,mime_type,file_size_bytes,storage_key,verification_status)
          VALUES(:id,:studentId,:type,:fileName,:mimeType,:size,:key,'PENDING')
          """).param("id",documentId).param("studentId",principal.studentProfileId()).param("type",upload.documentType())
                .param("fileName",upload.fileName()).param("mimeType",upload.mimeType()).param("size",upload.size()).param("key",upload.storageKey()).update();
        repository.database().sql("UPDATE student_document_uploads SET status='COMPLETED',student_document_id=:documentId,completed_at=now() WHERE id=:id")
                .param("documentId",documentId).param("id",uploadId).update();
        audit(principal.userId(),"STUDENT_DOCUMENT_UPLOADED","STUDENT_DOCUMENT",documentId,Map.of("uploadId",uploadId,"documentType",upload.documentType()),request);
        notifyUit("STUDENT_DOCUMENT_PENDING_REVIEW","Có tài liệu sinh viên cần xác minh",upload.fileName(),"STUDENT_DOCUMENT",documentId,"/uit/student-documents/"+documentId,"student-document:"+documentId+":pending:uit:");
        return studentDocuments(principal.studentProfileId());
    }

    public Map<String,Object> studentDocumentDownload(UUID studentId,UUID documentId){
        var document=repository.studentDocumentStorage(studentId,documentId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu của sinh viên."));
        return download(document.storageKey(),document.fileName());
    }

    public Map<String,Object> uitDocumentDownload(UUID documentId){
        var map=repository.studentDocumentForReview(documentId,false).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu của sinh viên."));
        return download(map.get("storageKey").toString(),map.get("fileName").toString());
    }

    @Transactional
    public List<Map<String,Object>> deleteStudentDocument(AuthPrincipal principal,UUID documentId,RequestMetadata request){
        var document=repository.lockStudentDocument(principal.studentProfileId(),documentId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu của sinh viên."));
        if(document.isDefault())throw error(HttpStatus.CONFLICT,"STUDENT_DOCUMENT_DEFAULT_CV","Hãy chọn một CV khác làm mặc định trước khi xóa.");
        if(document.usedByApplication())throw error(HttpStatus.CONFLICT,"STUDENT_DOCUMENT_IN_USE","Tài liệu đã được dùng trong đơn ứng tuyển.");
        storage().deleteObject(document.storageKey());
        repository.database().sql("DELETE FROM student_document_uploads WHERE student_document_id=:id").param("id",documentId).update();
        repository.database().sql("DELETE FROM student_documents WHERE id=:id AND student_profile_id=:studentId").param("id",documentId).param("studentId",principal.studentProfileId()).update();
        audit(principal.userId(),"STUDENT_DOCUMENT_DELETED","STUDENT_DOCUMENT",documentId,Map.of("documentType",document.documentType()),request);
        return studentDocuments(principal.studentProfileId());
    }

    @Transactional
    public List<Map<String,Object>> setDefaultCv(AuthPrincipal principal,UUID documentId,RequestMetadata request){
        var document=repository.lockStudentDocument(principal.studentProfileId(),documentId).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu của sinh viên."));
        if(!"CV".equals(document.documentType()))throw error(HttpStatus.CONFLICT,"STUDENT_DOCUMENT_NOT_CV","Chỉ có thể chọn tài liệu CV làm mặc định.");
        if(!"VERIFIED".equals(document.verificationStatus()))throw error(HttpStatus.CONFLICT,"STUDENT_DOCUMENT_NOT_VERIFIED","CV phải được UIT xác minh trước.");
        if(!document.isDefault()){
            repository.database().sql("UPDATE student_documents SET is_default=false WHERE student_profile_id=:studentId AND document_type='CV' AND is_default")
                    .param("studentId",principal.studentProfileId()).update();
            repository.database().sql("UPDATE student_documents SET is_default=true WHERE id=:id").param("id",documentId).update();
            audit(principal.userId(),"STUDENT_DEFAULT_CV_CHANGED","STUDENT_DOCUMENT",documentId,Map.of(),request);
        }
        return studentDocuments(principal.studentProfileId());
    }

    @Transactional
    public Map<String,Object> reviewDocument(AuthPrincipal principal,UUID documentId,DocumentReview input,RequestMetadata request){
        if("REJECT".equals(input.decision())&&(input.note()==null||input.note().strip().length()<5))throw error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Cần ghi rõ lý do từ chối.");
        var current=repository.studentDocumentForReview(documentId,true).orElseThrow(()->error(HttpStatus.NOT_FOUND,"STUDENT_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu của sinh viên."));
        String to="VERIFY".equals(input.decision())?"VERIFIED":"REJECTED";String from=current.get("verificationStatus").toString();
        if(from.equals(to))return sanitizedDocument(current);if(!"PENDING".equals(from))throw error(HttpStatus.CONFLICT,"STUDENT_DOCUMENT_REVIEW_CONFLICT","Tài liệu đã được xử lý.");
        repository.database().sql("UPDATE student_documents SET verification_status=:status WHERE id=:id").param("status",to).param("id",documentId).update();
        UUID studentUser=UUID.fromString(current.get("studentUserId").toString());
        notifyUser(studentUser,"VERIFIED".equals(to)?"STUDENT_DOCUMENT_VERIFIED":"STUDENT_DOCUMENT_REJECTED",
                "VERIFIED".equals(to)?"Tài liệu đã được UIT xác minh":"Tài liệu chưa được chấp nhận",current.get("fileName").toString(),"STUDENT_DOCUMENT",documentId,"/profile","student-document:"+documentId+":"+to);
        audit(principal.userId(),"VERIFIED".equals(to)?"STUDENT_DOCUMENT_VERIFIED_BY_UIT":"STUDENT_DOCUMENT_REJECTED_BY_UIT","STUDENT_DOCUMENT",documentId,Map.of("fromStatus",from,"toStatus",to),request);
        return sanitizedDocument(repository.studentDocumentForReview(documentId,false).orElseThrow());
    }

    @Transactional
    public Map<String,Object> confirmInterview(AuthPrincipal principal,UUID interviewId,RequestMetadata request){
        var row=repository.database().sql("""
          SELECT i.id,i.application_id,i.status,sp.full_name,j.title,c.id company_id FROM interviews i
          JOIN applications a ON a.id=i.application_id JOIN student_profiles sp ON sp.id=a.student_profile_id
          JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
          WHERE i.id=:id AND a.student_profile_id=:studentId FOR UPDATE OF i
          """).param("id",interviewId).param("studentId",principal.studentProfileId()).query((r,n)->Map.<String,Object>of("status",r.getString("status"),"applicationId",r.getObject("application_id",UUID.class),"companyId",r.getObject("company_id",UUID.class))).optional()
                .orElseThrow(()->error(HttpStatus.NOT_FOUND,"INTERVIEW_NOT_FOUND","Không tìm thấy lịch phỏng vấn."));
        if(!"CONFIRMED".equals(row.get("status"))){if(!"PENDING_STUDENT_CONFIRMATION".equals(row.get("status")))throw error(HttpStatus.CONFLICT,"INTERVIEW_STATE_CONFLICT","Lịch phỏng vấn không còn chờ xác nhận.");
            repository.database().sql("UPDATE interviews SET status='CONFIRMED',version=version+1 WHERE id=:id").param("id",interviewId).update();
            audit(principal.userId(),"INTERVIEW_CONFIRMED_BY_STUDENT","INTERVIEW",interviewId,Map.of("applicationId",row.get("applicationId")),request);}
        return repository.studentInterview(interviewId,principal.studentProfileId()).orElseThrow();
    }

    @Transactional
    public Map<String,Object> submit(AuthPrincipal principal,Submit input,UUID commandId,RequestMetadata request){
        UUID studentId=principal.studentProfileId();
        repository.database().sql("SELECT pg_advisory_xact_lock(hashtextextended(:key,0))").param("key",studentId+":"+input.jobId()).query(Object.class).optional();
        var repeated=repository.applicationByCommand(studentId,commandId);
        if(repeated.isPresent()){
            @SuppressWarnings("unchecked") Map<String,Object> job=(Map<String,Object>)repeated.get().get("job");
            if(!input.jobId().toString().equals(job.get("id").toString()))throw error(HttpStatus.CONFLICT,"IDEMPOTENCY_KEY_REUSED","Idempotency-Key đã được dùng cho yêu cầu khác.");
            return repeated.get();
        }
        String academic=repository.database().sql("SELECT academic_status FROM student_profiles WHERE id=:id FOR SHARE").param("id",studentId).query(String.class).optional().orElseThrow(this::studentNotFound);
        if(!"ACTIVE".equals(academic))throw error(HttpStatus.FORBIDDEN,"STUDENT_NOT_ACTIVE","Sinh viên không ở trạng thái đủ điều kiện ứng tuyển.");
        var job=repository.database().sql("""
          SELECT j.title,j.status,j.deadline,c.partner_status FROM job_posts j JOIN companies c ON c.id=j.company_id
          WHERE j.id=:id FOR SHARE OF j
          """).param("id",input.jobId()).query((r,n)->Map.<String,Object>of("title",r.getString("title"),"status",r.getString("status"),"deadline",r.getDate("deadline").toLocalDate(),"partnerStatus",r.getString("partner_status"))).optional()
                .orElseThrow(()->error(HttpStatus.NOT_FOUND,"JOB_NOT_AVAILABLE","Tin tuyển dụng không còn nhận hồ sơ."));
        if(!"RECRUITING".equals(job.get("status"))||!"ACTIVE".equals(job.get("partnerStatus")))throw error(HttpStatus.NOT_FOUND,"JOB_NOT_AVAILABLE","Tin tuyển dụng không còn nhận hồ sơ.");
        if(((LocalDate)job.get("deadline")).isBefore(LocalDate.now()))throw error(HttpStatus.CONFLICT,"JOB_DEADLINE_EXPIRED","Tin tuyển dụng đã hết hạn ứng tuyển.");
        long duplicate=repository.database().sql("""
          SELECT count(*) FROM applications WHERE student_profile_id=:studentId AND job_post_id=:jobId
          AND status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT','FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','OFFER_PENDING_STUDENT','ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED')
          """).param("studentId",studentId).param("jobId",input.jobId()).query(Long.class).single();
        if(duplicate>0)throw error(HttpStatus.CONFLICT,"APPLICATION_ALREADY_ACTIVE","Bạn đã có đơn đang được xử lý cho tin này.");
        List<UUID> ids=uniqueDocumentIds(input.documents().stream().map(ApplicationRequests.DocumentRef::documentId).toList());
        var documents=verifiedDocuments(studentId,ids,true);
        UUID applicationId=repository.database().sql("""
          INSERT INTO applications(student_profile_id,job_post_id,status,consented_at) VALUES(:studentId,:jobId,'UIT_REVIEWING',now()) RETURNING id
          """).param("studentId",studentId).param("jobId",input.jobId()).query(UUID.class).single();
        insertSnapshots(applicationId,documents);
        addHistory(applicationId,commandId,null,"UIT_REVIEWING","STUDENT",principal.userId(),null,null,Map.of());
        notifyUit("APPLICATION_SUBMITTED","Có hồ sơ sinh viên cần xử lý","Có đơn mới ứng tuyển vị trí \""+job.get("title")+"\".","APPLICATION",applicationId,"/uit/applications/"+applicationId,"application:"+applicationId+":submitted:"+commandId+":");
        audit(principal.userId(),"APPLICATION_SUBMITTED","APPLICATION",applicationId,Map.of("jobId",input.jobId(),"commandId",commandId,"documentCount",documents.size()),request);
        return repository.application(applicationId,studentId,null,false).orElseThrow();
    }

    @Transactional
    public Map<String,Object> uitReview(AuthPrincipal principal,UUID applicationId,UUID commandId,String decision,Object payload,RequestMetadata request){
        LockedApplication app=repository.lockApplication(applicationId).orElseThrow(this::applicationNotFound);
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,null,null,true).orElseThrow();
        if(app.status()!=Status.UIT_REVIEWING)throw state("Hồ sơ không còn chờ UIT kiểm duyệt.");
        String to;String reason=null,note=null;Map<String,Object> metadata=Map.of();
        if("request-supplement".equals(decision)){
            Supplement supplement=(Supplement)payload;if(!supplement.dueAt().isAfter(OffsetDateTime.now()))throw error(HttpStatus.BAD_REQUEST,"APPLICATION_SUPPLEMENT_DUE_DATE_INVALID","Hạn bổ sung phải nằm trong tương lai.");
            to="NEEDS_SUPPLEMENT";reason=supplement.reasonCode().strip();note=supplement.note().strip();metadata=Map.of("requiredDocumentTypes",supplement.requiredDocumentTypes(),"dueAt",supplement.dueAt());
        }else if("reject".equals(decision)){Reason value=(Reason)payload;to="UIT_REJECTED";reason=value.reasonCode().strip();note=value.note().strip();}
        else to="FORWARDED_TO_COMPANY";
        updateStatus(applicationId,to);addHistory(applicationId,commandId,"UIT_REVIEWING",to,"UIT_ADMIN",principal.userId(),reason,note,metadata);
        notifyUser(app.studentUserId(),"APPLICATION_"+to,"Hồ sơ đã được UIT cập nhật","Trạng thái hồ sơ vị trí \""+app.jobTitle()+"\" đã thay đổi.","APPLICATION",applicationId,"/applications/"+applicationId,"application:"+applicationId+":"+commandId+":student");
        if("FORWARDED_TO_COMPANY".equals(to))notifyCompany(app.companyId(),"APPLICATION_RECEIVED","Có hồ sơ ứng viên cần xử lý",app.studentFullName()+" đã được UIT chuyển đến vị trí \""+app.jobTitle()+"\".",applicationId,commandId);
        audit(principal.userId(),"APPLICATION_"+to,"APPLICATION",applicationId,Map.of("commandId",commandId,"toStatus",to),request);
        return repository.application(applicationId,null,null,true).orElseThrow();
    }

    @Transactional
    public Map<String,Object> companyDecision(AuthPrincipal principal,UUID applicationId,UUID commandId,boolean reject,Reason reason,RequestMetadata request){
        LockedApplication app=ownedCompany(applicationId,principal.companyId());
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,null,principal.companyId(),false).orElseThrow();
        Status expected=reject?Status.COMPANY_REVIEWING:Status.FORWARDED_TO_COMPANY;if(app.status()!=expected)throw state(reject?"Chỉ có thể từ chối khi hồ sơ đang được sàng lọc.":"Hồ sơ không còn ở trạng thái mới từ UIT.");
        String to=reject?"NOT_SUITABLE":"COMPANY_REVIEWING";updateStatus(applicationId,to);addHistory(applicationId,commandId,expected.name(),to,"COMPANY",principal.userId(),reject?reason.reasonCode():null,reject?reason.note():null,Map.of());
        notifyUser(app.studentUserId(),"APPLICATION_"+to,"Doanh nghiệp đã cập nhật hồ sơ",app.companyName()+" đã cập nhật hồ sơ vị trí \""+app.jobTitle()+"\".","APPLICATION",applicationId,"/applications/"+applicationId,"application:"+applicationId+":"+commandId+":student");
        audit(principal.userId(),reject?"APPLICATION_NOT_SUITABLE":"APPLICATION_COMPANY_REVIEW_STARTED","APPLICATION",applicationId,Map.of("commandId",commandId,"toStatus",to),request);
        return repository.application(applicationId,null,principal.companyId(),false).orElseThrow();
    }

    @Transactional
    public Map<String,Object> scheduleInterview(AuthPrincipal principal,UUID applicationId,UUID commandId,Interview input,RequestMetadata request){
        if(!input.scheduledAt().isAfter(OffsetDateTime.now().plusMinutes(15)))throw error(HttpStatus.BAD_REQUEST,"INTERVIEW_TIME_INVALID","Lịch phỏng vấn phải cách hiện tại ít nhất 15 phút.");
        if(input.mode()==ApplicationModels.InterviewMode.ONLINE&&(input.meetingUrl()==null||input.meetingUrl().isBlank()))throw error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Phỏng vấn online cần đường dẫn.");
        if(input.mode()==ApplicationModels.InterviewMode.ONSITE&&(input.location()==null||input.location().isBlank()))throw error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Phỏng vấn tại chỗ cần địa điểm.");
        LockedApplication app=ownedCompany(applicationId,principal.companyId());
        if(repository.commandExists(applicationId,commandId))return repository.interviewByCommand(applicationId,commandId).orElseThrow(()->state("Yêu cầu đã được xử lý."));
        if(app.status()!=Status.COMPANY_REVIEWING)throw state("Chỉ có thể mời phỏng vấn khi hồ sơ đang được sàng lọc.");
        UUID interviewId=UUID.randomUUID();repository.database().sql("""
          INSERT INTO interviews(id,application_id,command_id,created_by_user_id,scheduled_at,time_zone,mode,location,meeting_url,interviewer_name)
          VALUES(:id,:applicationId,:commandId,:actor,:scheduled,:zone,:mode,:location,:url,:name)
          """).param("id",interviewId).param("applicationId",applicationId).param("commandId",commandId).param("actor",principal.userId())
                .param("scheduled",input.scheduledAt()).param("zone",input.timeZone()).param("mode",input.mode().name())
                .param("location",input.location(),Types.VARCHAR).param("url",input.meetingUrl(),Types.VARCHAR).param("name",input.interviewerName().strip()).update();
        updateStatus(applicationId,"INTERVIEW_INVITED");addHistory(applicationId,commandId,"COMPANY_REVIEWING","INTERVIEW_INVITED","COMPANY",principal.userId(),null,null,Map.of("interviewId",interviewId,"scheduledAt",input.scheduledAt(),"mode",input.mode()));
        notifyUser(app.studentUserId(),"INTERVIEW_INVITED","Bạn có lịch phỏng vấn mới",app.companyName()+" đã mời bạn phỏng vấn vị trí \""+app.jobTitle()+"\".","APPLICATION",applicationId,"/applications/"+applicationId,"application:"+applicationId+":"+commandId+":interview");
        audit(principal.userId(),"INTERVIEW_SCHEDULED","APPLICATION",applicationId,Map.of("commandId",commandId,"interviewId",interviewId),request);
        return repository.interviewByCommand(applicationId,commandId).orElseThrow();
    }

    public Map<String,Object> createOfferUpload(AuthPrincipal principal,UUID applicationId,OfferUpload input){
        Map<String,Object> application=repository.application(applicationId,null,principal.companyId(),false).orElseThrow(this::applicationNotFound);
        if(!"INTERVIEW_INVITED".equals(application.get("status"))||application.get("recruitmentResult")!=null)throw error(HttpStatus.CONFLICT,"OFFER_DOCUMENT_STATE_CONFLICT","Chỉ có thể tải offer khi ứng viên đang ở bước phỏng vấn.");
        ObjectStorage objects=storage();UUID id=UUID.randomUUID();String key="offers/"+principal.companyId()+"/"+applicationId+"/"+id+".pdf";
        Instant expires=Instant.now().plusSeconds(properties.storage().uploadUrlTtlSeconds());
        repository.database().sql("""
          INSERT INTO offer_document_uploads(id,application_id,company_id,created_by_user_id,file_name,mime_type,file_size_bytes,storage_key,expires_at)
          VALUES(:id,:applicationId,:companyId,:actor,:fileName,:mimeType,:size,:key,:expires)
          """).param("id",id).param("applicationId",applicationId).param("companyId",principal.companyId()).param("actor",principal.userId())
                .param("fileName",input.fileName().strip()).param("mimeType",input.mimeType()).param("size",input.fileSizeBytes()).param("key",key)
                .param("expires",OffsetDateTime.ofInstant(expires,ZoneOffset.UTC)).update();
        return uploadIntent(id,objects.createUploadUrl(key,input.mimeType(),properties.storage().uploadUrlTtlSeconds()),expires);
    }

    @Transactional
    public Map<String,Object> completeOfferUpload(AuthPrincipal principal,UUID applicationId,UUID uploadId,RequestMetadata request){
        Upload upload=offerUpload(principal.companyId(),applicationId,uploadId,true).orElseThrow(()->error(HttpStatus.NOT_FOUND,"OFFER_DOCUMENT_UPLOAD_NOT_FOUND","Không tìm thấy phiên tải offer."));
        Map<String,Object> dto=Map.of("fileName",upload.fileName(),"mimeType",upload.mimeType(),"fileSizeBytes",upload.size());
        if(Set.of("COMPLETED","CONSUMED").contains(upload.status()))return dto;
        validateUploadState(upload,"OFFER_DOCUMENT");verifyPdf(storage(),upload,"OFFER_DOCUMENT");
        repository.database().sql("UPDATE offer_document_uploads SET status='COMPLETED',etag=:etag,completed_at=now() WHERE id=:id")
                .param("etag",storage().headObject(upload.storageKey()).etag(),Types.VARCHAR).param("id",uploadId).update();
        audit(principal.userId(),"OFFER_DOCUMENT_UPLOADED","APPLICATION",applicationId,Map.of("uploadId",uploadId,"fileName",upload.fileName()),request);return dto;
    }

    @Transactional
    public Map<String,Object> recordResult(AuthPrincipal principal,UUID applicationId,UUID commandId,RecruitmentResult input,RequestMetadata request){
        if(input.outcome()==ApplicationModels.ResultOutcome.PASS){if(input.startDate()==null)throw error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Kết quả PASS cần ngày bắt đầu.");if(input.startDate().isBefore(LocalDate.now()))throw error(HttpStatus.BAD_REQUEST,"OFFER_START_DATE_INVALID","Ngày bắt đầu không được trong quá khứ.");}
        else if(input.reasonCode()==null||input.note()==null)throw error(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Kết quả FAIL cần lý do và ghi chú.");
        LockedApplication app=ownedCompany(applicationId,principal.companyId());
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,null,principal.companyId(),false).orElseThrow();
        if(app.status()!=Status.INTERVIEW_INVITED)throw state("Chỉ có thể cập nhật kết quả ở bước phỏng vấn.");
        Upload offer=input.outcome()==ApplicationModels.ResultOutcome.PASS&&input.offerUploadId()!=null?
                offerUpload(principal.companyId(),applicationId,input.offerUploadId(),true).orElseThrow(()->error(HttpStatus.NOT_FOUND,"OFFER_DOCUMENT_UPLOAD_NOT_FOUND","Không tìm thấy phiên tải offer.")):null;
        if(offer!=null&&!"COMPLETED".equals(offer.status()))throw error(HttpStatus.CONFLICT,"OFFER_DOCUMENT_UPLOAD_NOT_READY","Tệp offer chưa tải xong hoặc đã được dùng.");
        UUID interviewId=repository.database().sql("""
          UPDATE interviews SET status='COMPLETED',version=version+1 WHERE id=(SELECT id FROM interviews
          WHERE application_id=:id AND status<>'CANCELLED' ORDER BY scheduled_at DESC,created_at DESC LIMIT 1) RETURNING id
          """).param("id",applicationId).query(UUID.class).optional().orElseThrow(()->error(HttpStatus.CONFLICT,"INTERVIEW_NOT_FOUND","Không tìm thấy lịch phỏng vấn hợp lệ."));
        UUID resultId=UUID.randomUUID();boolean pass=input.outcome()==ApplicationModels.ResultOutcome.PASS;
        repository.database().sql("""
          INSERT INTO recruitment_results(id,application_id,command_id,decided_by_user_id,outcome,offered_at,start_date,offer_storage_key,offer_upload_id,internal_note)
          VALUES(:id,:applicationId,:commandId,:actor,:outcome,CASE WHEN :outcome='PASS' THEN now() END,:startDate,:key,:uploadId,:note)
          """).param("id",resultId).param("applicationId",applicationId).param("commandId",commandId).param("actor",principal.userId()).param("outcome",input.outcome().name())
                .param("startDate",pass?input.startDate():null,Types.DATE).param("key",offer==null?null:offer.storageKey(),Types.VARCHAR)
                .param("uploadId",offer==null?null:offer.id(),Types.OTHER).param("note",pass?input.internalNote():input.note(),Types.VARCHAR).update();
        if(offer!=null)repository.database().sql("UPDATE offer_document_uploads SET status='CONSUMED',consumed_at=now() WHERE id=:id AND status='COMPLETED'").param("id",offer.id()).update();
        String to=pass?"OFFER_PENDING_STUDENT":"INTERVIEW_FAILED";updateStatus(applicationId,to);addHistory(applicationId,commandId,"INTERVIEW_INVITED",to,"COMPANY",principal.userId(),pass?null:input.reasonCode(),pass?null:input.note(),Map.of("interviewId",interviewId,"resultId",resultId,"outcome",input.outcome()));
        notifyUser(app.studentUserId(),pass?"OFFER_AVAILABLE":"INTERVIEW_FAILED",pass?"Bạn có lời mời nhận việc mới":"Doanh nghiệp đã cập nhật kết quả",app.companyName()+" đã cập nhật kết quả vị trí \""+app.jobTitle()+"\".","APPLICATION",applicationId,"/applications/"+applicationId,"application:"+applicationId+":"+commandId+":result:student");
        audit(principal.userId(),"INTERVIEW_RESULT_RECORDED","APPLICATION",applicationId,Map.of("commandId",commandId,"resultId",resultId,"outcome",input.outcome()),request);
        return repository.application(applicationId,null,principal.companyId(),false).orElseThrow();
    }

    public Map<String,Object> applicationDocumentDownload(AuthPrincipal principal,UUID applicationId,UUID documentId,boolean uit,RequestMetadata request){
        var document=repository.applicationDocumentStorage(applicationId,documentId,uit?null:principal.companyId()).orElseThrow(this::applicationNotFound);
        Map<String,Object> result=download(document.storageKey(),document.fileName());
        audit(principal.userId(),"APPLICATION_DOCUMENT_DOWNLOAD_URL_CREATED","APPLICATION_DOCUMENT",documentId,Map.of("applicationId",applicationId,"actorType",uit?"UIT_ADMIN":"COMPANY"),request);return result;
    }

    public Map<String,Object> offerDownload(AuthPrincipal principal,UUID applicationId,String actorType,RequestMetadata request){
        String scope="STUDENT".equals(actorType)?"a.student_profile_id=:owner":"COMPANY".equals(actorType)?"j.company_id=:owner AND EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id AND h.to_status='FORWARDED_TO_COMPANY')":"TRUE";
        var spec=repository.database().sql("""
          SELECT rr.id,rr.offer_storage_key,COALESCE(odu.file_name,regexp_replace(rr.offer_storage_key,'^.*/','')) file_name
          FROM recruitment_results rr JOIN applications a ON a.id=rr.application_id JOIN job_posts j ON j.id=a.job_post_id
          LEFT JOIN offer_document_uploads odu ON odu.id=rr.offer_upload_id WHERE rr.application_id=:applicationId
          AND rr.outcome='PASS' AND rr.offer_storage_key IS NOT NULL AND
          """+scope).param("applicationId",applicationId);
        if(!"UIT_ADMIN".equals(actorType))spec.param("owner","STUDENT".equals(actorType)?principal.studentProfileId():principal.companyId());
        var document=spec.query((r,n)->new ApplicationRepository.DocumentStorage(r.getObject("id",UUID.class),r.getString("offer_storage_key"),r.getString("file_name"))).optional()
                .orElseThrow(()->error(HttpStatus.NOT_FOUND,"OFFER_DOCUMENT_NOT_FOUND","Không tìm thấy tài liệu offer."));
        Map<String,Object> result=download(document.storageKey(),document.fileName());audit(principal.userId(),"OFFER_DOCUMENT_DOWNLOAD_URL_CREATED","RECRUITMENT_RESULT",document.id(),Map.of("applicationId",applicationId,"actorType",actorType),request);return result;
    }

    @Transactional
    public Map<String,Object> resubmit(AuthPrincipal principal,UUID applicationId,UUID commandId,Resubmit input,RequestMetadata request){
        LockedApplication app=ownedStudent(applicationId,principal.studentProfileId());
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
        if(app.status()!=Status.NEEDS_SUPPLEMENT)throw state("Chỉ có thể nộp bổ sung khi UIT đang yêu cầu cập nhật hồ sơ.");
        var requestRow=repository.database().sql("""
          SELECT command_id,metadata::text FROM application_status_history WHERE application_id=:id AND to_status='NEEDS_SUPPLEMENT'
          ORDER BY created_at DESC,id DESC LIMIT 1
          """).param("id",applicationId).query((r,n)->Map.<String,Object>of("commandId",r.getObject("command_id",UUID.class),"metadata",json.object(r.getString("metadata")))).optional()
                .orElseThrow(()->error(HttpStatus.CONFLICT,"APPLICATION_SUPPLEMENT_REQUEST_INVALID","Yêu cầu bổ sung không đầy đủ thông tin."));
        @SuppressWarnings("unchecked") Map<String,Object> metadata=(Map<String,Object>)requestRow.get("metadata");
        Object dueValue=metadata.get("dueAt");if(dueValue==null||!OffsetDateTime.parse(dueValue.toString()).isAfter(OffsetDateTime.now()))throw error(HttpStatus.CONFLICT,"APPLICATION_SUPPLEMENT_DEADLINE_EXPIRED","Đã quá hạn bổ sung hồ sơ.");
        @SuppressWarnings("unchecked") List<String> required=((List<Object>)metadata.getOrDefault("requiredDocumentTypes",List.of())).stream().map(Object::toString).toList();
        List<UUID> ids=uniqueDocumentIds(input.documents().stream().map(ApplicationRequests.DocumentRef::documentId).toList());
        var documents=verifiedDocuments(principal.studentProfileId(),ids,false);Set<String> selected=documents.stream().map(ApplicationRepository.SourceDocument::documentType).collect(java.util.stream.Collectors.toSet());
        List<String> missing=required.stream().filter(type->!selected.contains(type)).toList();if(!missing.isEmpty())throw error(HttpStatus.BAD_REQUEST,"APPLICATION_REQUIRED_DOCUMENTS_MISSING","Còn thiếu tài liệu UIT yêu cầu: "+String.join(", ",missing)+".");
        long existing=repository.database().sql("SELECT count(*) FROM application_documents WHERE application_id=:id AND source_document_id IN (:ids)").param("id",applicationId).param("ids",ids).query(Long.class).single();
        if(existing>0)throw error(HttpStatus.BAD_REQUEST,"APPLICATION_DOCUMENT_ALREADY_SUBMITTED","Hãy chọn phiên bản tài liệu mới.");
        insertSnapshots(applicationId,documents);repository.database().sql("UPDATE applications SET status='UIT_REVIEWING',consented_at=now(),version=version+1,last_transition_at=now() WHERE id=:id").param("id",applicationId).update();
        addHistory(applicationId,commandId,"NEEDS_SUPPLEMENT","UIT_REVIEWING","STUDENT",principal.userId(),null,"Sinh viên đã nộp tài liệu bổ sung.",Map.of("supplementRequestCommandId",requestRow.get("commandId"),"requiredDocumentTypes",required));
        notifyUit("APPLICATION_RESUBMITTED","Sinh viên đã bổ sung hồ sơ",app.studentFullName()+" đã bổ sung hồ sơ vị trí \""+app.jobTitle()+"\".","APPLICATION",applicationId,"/uit/applications/"+applicationId,"application:"+applicationId+":"+commandId+":resubmit:uit:");
        audit(principal.userId(),"APPLICATION_RESUBMITTED","APPLICATION",applicationId,Map.of("commandId",commandId,"documentCount",documents.size()),request);
        return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
    }

    @Transactional
    public Map<String,Object> withdraw(AuthPrincipal principal,UUID applicationId,UUID commandId,boolean cancelInterview,Reason reason,RequestMetadata request){
        LockedApplication app=ownedStudent(applicationId,principal.studentProfileId());
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
        boolean valid=cancelInterview?app.status()==Status.INTERVIEW_INVITED:Set.of(Status.UIT_REVIEWING,Status.NEEDS_SUPPLEMENT,Status.FORWARDED_TO_COMPANY,Status.COMPANY_REVIEWING).contains(app.status());
        if(!valid)throw error(HttpStatus.CONFLICT,"APPLICATION_WITHDRAWAL_NOT_ALLOWED","Không thể rút đơn ở bước hiện tại.");
        String from=app.status().name();repository.database().sql("UPDATE applications SET status='WITHDRAWN',withdrawn_at=now(),version=version+1,last_transition_at=now() WHERE id=:id").param("id",applicationId).update();
        if(cancelInterview){int count=repository.database().sql("UPDATE interviews SET status='CANCELLED',cancellation_reason=:note,version=version+1 WHERE application_id=:id AND status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')")
                .param("note",reason.note()).param("id",applicationId).update();if(count==0)throw error(HttpStatus.CONFLICT,"INTERVIEW_STATE_CONFLICT","Không còn lịch phỏng vấn để hủy.");}
        addHistory(applicationId,commandId,from,"WITHDRAWN","STUDENT",principal.userId(),reason.reasonCode(),reason.note(),Map.of("action",cancelInterview?"cancel-interview":"withdraw"));
        notifyUit("APPLICATION_WITHDRAWN_RECORDED","Sinh viên đã rút đơn",app.studentFullName()+" đã rút đơn vị trí \""+app.jobTitle()+"\".","APPLICATION",applicationId,"/uit/applications/"+applicationId,"application:"+applicationId+":"+commandId+":withdraw:uit:");
        if(Set.of(Status.FORWARDED_TO_COMPANY,Status.COMPANY_REVIEWING,Status.INTERVIEW_INVITED).contains(app.status()))notifyCompany(app.companyId(),cancelInterview?"INTERVIEW_CANCELLED_BY_STUDENT":"APPLICATION_WITHDRAWN_BY_STUDENT","Sinh viên đã rút hồ sơ",app.studentFullName()+" đã rút hồ sơ vị trí \""+app.jobTitle()+"\".",applicationId,commandId);
        audit(principal.userId(),cancelInterview?"INTERVIEW_CANCELLED_BY_STUDENT":"APPLICATION_WITHDRAWN_BY_STUDENT","APPLICATION",applicationId,Map.of("commandId",commandId,"fromStatus",from),request);
        return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
    }

    @Transactional
    public Map<String,Object> respondOffer(AuthPrincipal principal,UUID applicationId,UUID commandId,boolean accept,Reason reason,RequestMetadata request){
        if(accept)repository.database().sql("SELECT id FROM student_profiles WHERE id=:id FOR UPDATE").param("id",principal.studentProfileId()).query(UUID.class).single();
        LockedApplication app=ownedStudent(applicationId,principal.studentProfileId());
        if(repository.commandExists(applicationId,commandId))return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
        if(app.status()!=Status.OFFER_PENDING_STUDENT)throw state("Offer này không còn chờ phản hồi.");
        if(accept){long selected=repository.database().sql("SELECT count(*) FROM applications WHERE student_profile_id=:studentId AND id<>:id AND status IN ('ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED')").param("studentId",principal.studentProfileId()).param("id",applicationId).query(Long.class).single();if(selected>0)throw error(HttpStatus.CONFLICT,"STUDENT_PLACEMENT_ALREADY_SELECTED","Bạn đã chọn một nơi làm việc khác.");}
        String decision=accept?"ACCEPTED":"DECLINED";int updated=repository.database().sql("UPDATE recruitment_results SET student_decision=:decision,responded_at=now() WHERE application_id=:id AND outcome='PASS' AND student_decision IS NULL")
                .param("decision",decision).param("id",applicationId).update();if(updated!=1)throw error(HttpStatus.CONFLICT,"OFFER_RESULT_CONFLICT","Không tìm thấy offer hợp lệ.");
        String to=accept?"ACCEPTED_PENDING_UIT_CONFIRMATION":"OFFER_DECLINED";repository.database().sql("UPDATE applications SET status=:status,accepted_at=CASE WHEN :status='ACCEPTED_PENDING_UIT_CONFIRMATION' THEN now() ELSE accepted_at END,version=version+1,last_transition_at=now() WHERE id=:id").param("status",to).param("id",applicationId).update();
        addHistory(applicationId,commandId,"OFFER_PENDING_STUDENT",to,"STUDENT",principal.userId(),accept?null:reason.reasonCode(),accept?null:reason.note(),Map.of("decision",decision));
        notifyCompany(app.companyId(),accept?"OFFER_ACCEPTED":"OFFER_DECLINED",accept?"Sinh viên đã nhận offer":"Sinh viên đã từ chối offer",app.studentFullName()+" đã phản hồi offer vị trí \""+app.jobTitle()+"\".",applicationId,commandId);
        notifyUit(accept?"PLACEMENT_CONFIRMATION_REQUIRED":"OFFER_DECLINED_RECORDED",accept?"Có nơi thực tập cần xác nhận":"Sinh viên đã từ chối offer",app.studentFullName()+" đã phản hồi offer tại "+app.companyName()+".","APPLICATION",applicationId,"/uit/applications/"+applicationId,"application:"+applicationId+":"+commandId+":offer:uit:");
        audit(principal.userId(),accept?"OFFER_ACCEPTED":"OFFER_DECLINED","APPLICATION",applicationId,Map.of("commandId",commandId,"decision",decision),request);
        return repository.application(applicationId,principal.studentProfileId(),null,false).orElseThrow();
    }

    @Transactional
    public Map<String,Object> confirmPlacement(AuthPrincipal principal,UUID applicationId,UUID commandId,Placement input,RequestMetadata request){
        LockedApplication app=repository.lockApplication(applicationId).orElseThrow(this::applicationNotFound);
        repository.database().sql("SELECT id FROM student_profiles WHERE id=:id FOR UPDATE").param("id",app.studentProfileId()).query(UUID.class).single();
        if(repository.commandExists(applicationId,commandId))return placementResponse(applicationId,commandId);
        if(app.status()!=Status.ACCEPTED_PENDING_UIT_CONFIRMATION)throw state("Chỉ xác nhận sau khi sinh viên đã nhận offer.");
        int result=repository.database().sql("UPDATE recruitment_results SET start_date=:date WHERE application_id=:id AND outcome='PASS' AND student_decision='ACCEPTED'").param("date",input.startDate()).param("id",applicationId).update();if(result!=1)throw error(HttpStatus.CONFLICT,"PLACEMENT_RESULT_CONFLICT","Không tìm thấy offer đã chấp nhận.");
        List<Map<String,Object>> others=repository.database().sql("""
          SELECT a.id,a.status,j.title,c.id company_id FROM applications a JOIN job_posts j ON j.id=a.job_post_id JOIN companies c ON c.id=j.company_id
          WHERE a.student_profile_id=:studentId AND a.id<>:id AND a.status IN ('UIT_REVIEWING','NEEDS_SUPPLEMENT','FORWARDED_TO_COMPANY','COMPANY_REVIEWING','INTERVIEW_INVITED','OFFER_PENDING_STUDENT') FOR UPDATE OF a
          """).param("studentId",app.studentProfileId()).param("id",applicationId).query((r,n)->Map.<String,Object>of("id",r.getObject("id",UUID.class),"status",r.getString("status"),"jobTitle",r.getString("title"),"companyId",r.getObject("company_id",UUID.class))).list();
        updateStatus(applicationId,"HIRED");repository.database().sql("UPDATE applications SET placement_confirmed_at=now() WHERE id=:id").param("id",applicationId).update();
        List<UUID> otherIds=others.stream().map(row->(UUID)row.get("id")).toList();if(!otherIds.isEmpty()){repository.database().sql("UPDATE applications SET status='WITHDRAWN',withdrawn_at=now(),version=version+1,last_transition_at=now() WHERE id IN (:ids)").param("ids",otherIds).update();repository.database().sql("UPDATE interviews SET status='CANCELLED',cancellation_reason='ACCEPTED_OTHER_JOB',version=version+1 WHERE application_id IN (:ids) AND status IN ('PENDING_STUDENT_CONFIRMATION','CONFIRMED','RESCHEDULE_REQUESTED')").param("ids",otherIds).update();}
        addHistory(applicationId,commandId,"ACCEPTED_PENDING_UIT_CONFIRMATION","HIRED","UIT_ADMIN",principal.userId(),null,input.note(),Map.of("startDate",input.startDate(),"autoWithdrawnApplicationIds",otherIds));
        UUID placementId=repository.database().sql("INSERT INTO internship_placements(application_id,status,expected_start_date,hired_at) VALUES(:id,'HIRED',:date,now()) RETURNING id").param("id",applicationId).param("date",input.startDate()).query(UUID.class).single();
        repository.database().sql("""
          INSERT INTO internship_placement_history(placement_id,command_id,from_status,to_status,actor_type,actor_user_id,effective_date,note,metadata)
          VALUES(:placementId,:commandId,NULL,'HIRED','UIT_ADMIN',:actor,:date,:note,CAST(:metadata AS jsonb))
          """).param("placementId",placementId).param("commandId",commandId).param("actor",principal.userId()).param("date",input.startDate()).param("note",input.note(),Types.VARCHAR).param("metadata",json.stringify(Map.of("applicationId",applicationId,"autoWithdrawnApplicationIds",otherIds))).update();
        for(var other:others)addHistory((UUID)other.get("id"),commandId,other.get("status").toString(),"WITHDRAWN","SYSTEM",null,"ACCEPTED_OTHER_JOB","Hệ thống đóng đơn do sinh viên đã chọn nơi khác.",Map.of("selectedApplicationId",applicationId));
        notifyUser(app.studentUserId(),"PLACEMENT_CONFIRMED","UIT đã xác nhận nơi thực tập","UIT đã xác nhận vị trí \""+app.jobTitle()+"\" tại "+app.companyName()+".","APPLICATION",applicationId,"/applications/"+applicationId,"application:"+applicationId+":"+commandId+":placement:student");
        notifyCompany(app.companyId(),"PLACEMENT_CONFIRMED_BY_UIT","UIT đã xác nhận sinh viên nhận việc",app.studentFullName()+" đã được xác nhận.",applicationId,commandId);
        audit(principal.userId(),"PLACEMENT_CONFIRMED","APPLICATION",applicationId,Map.of("commandId",commandId,"placementId",placementId,"autoWithdrawnApplicationIds",otherIds),request);
        return Map.of("selectedApplication",repository.application(applicationId,null,null,true).orElseThrow(),"autoWithdrawnApplicationIds",otherIds);
    }

    private LockedApplication ownedStudent(UUID id,UUID studentId){LockedApplication app=repository.lockApplication(id).orElseThrow(this::applicationNotFound);if(!app.studentProfileId().equals(studentId))throw applicationNotFound();return app;}
    private LockedApplication ownedCompany(UUID id,UUID companyId){LockedApplication app=repository.lockApplication(id).orElseThrow(this::applicationNotFound);if(!app.companyId().equals(companyId))throw applicationNotFound();return app;}
    private AppException state(String message){return error(HttpStatus.CONFLICT,"APPLICATION_STATE_CONFLICT",message);}
    private void updateStatus(UUID id,String status){repository.database().sql("UPDATE applications SET status=:status,version=version+1,last_transition_at=now() WHERE id=:id").param("status",status).param("id",id).update();}
    private void addHistory(UUID applicationId,UUID commandId,String from,String to,String actorType,UUID actor,String reason,String note,Object metadata){repository.database().sql("""
      INSERT INTO application_status_history(application_id,command_id,from_status,to_status,actor_type,actor_user_id,reason_code,note,metadata)
      VALUES(:applicationId,:commandId,:fromStatus,:toStatus,:actorType,:actor,:reason,:note,CAST(:metadata AS jsonb))
      """).param("applicationId",applicationId).param("commandId",commandId).param("fromStatus",from,Types.VARCHAR).param("toStatus",to)
            .param("actorType",actorType).param("actor",actor,Types.OTHER).param("reason",reason,Types.VARCHAR).param("note",note,Types.VARCHAR).param("metadata",json.stringify(metadata)).update();}
    private List<UUID> uniqueDocumentIds(List<UUID> ids){if(ids==null||ids.isEmpty())throw error(HttpStatus.BAD_REQUEST,"APPLICATION_DOCUMENT_INVALID","Cần chọn ít nhất một tài liệu.");if(ids.stream().distinct().count()!=ids.size())throw error(HttpStatus.BAD_REQUEST,"APPLICATION_DOCUMENT_INVALID","Không được chọn trùng tài liệu.");return ids;}
    private List<ApplicationRepository.SourceDocument> verifiedDocuments(UUID studentId,List<UUID> ids,boolean requireCv){var documents=repository.sourceDocuments(studentId,ids);if(documents.size()!=ids.size())throw error(HttpStatus.BAD_REQUEST,"APPLICATION_DOCUMENT_INVALID","Có tài liệu không thuộc hồ sơ của bạn.");if(documents.stream().anyMatch(d->!"VERIFIED".equals(d.verificationStatus())))throw error(HttpStatus.BAD_REQUEST,"APPLICATION_DOCUMENT_NOT_VERIFIED","Chỉ có thể gửi tài liệu đã xác minh.");if(requireCv&&documents.stream().noneMatch(d->"CV".equals(d.documentType())))throw error(HttpStatus.BAD_REQUEST,"APPLICATION_CV_REQUIRED","Đơn ứng tuyển phải có CV.");return documents;}
    private void insertSnapshots(UUID applicationId,List<ApplicationRepository.SourceDocument> documents){for(var d:documents)repository.database().sql("""
      INSERT INTO application_documents(application_id,source_document_id,document_type,file_name,mime_type,file_size_bytes,storage_key,checksum,source_version)
      VALUES(:applicationId,:sourceId,:type,:fileName,:mimeType,:size,:key,:checksum,:version)
      """).param("applicationId",applicationId).param("sourceId",d.id()).param("type",d.documentType()).param("fileName",d.fileName()).param("mimeType",d.mimeType()).param("size",d.fileSizeBytes()).param("key",d.storageKey()).param("checksum",d.checksum(),Types.VARCHAR).param("version",d.version()).update();}
    private Optional<Upload> offerUpload(UUID companyId,UUID applicationId,UUID uploadId,boolean lock){return repository.database().sql("""
      SELECT id,company_id owner_id,application_id,NULL::text document_type,file_name,mime_type,file_size_bytes,storage_key,status,expires_at,NULL::uuid student_document_id
      FROM offer_document_uploads WHERE id=:id AND company_id=:owner AND application_id=:applicationId
      """+(lock?" FOR UPDATE":"")).param("id",uploadId).param("owner",companyId).param("applicationId",applicationId).query(this::mapUpload).optional();}
    private Map<String,Object> placementResponse(UUID applicationId,UUID commandId){List<UUID> others=repository.database().sql("""
      SELECT application_id FROM application_status_history WHERE command_id=:commandId AND to_status='WITHDRAWN'
      AND metadata->>'selectedApplicationId'=:selected ORDER BY application_id
      """).param("commandId",commandId).param("selected",applicationId.toString()).query(UUID.class).list();return Map.of("selectedApplication",repository.application(applicationId,null,null,true).orElseThrow(),"autoWithdrawnApplicationIds",others);}
    private void notifyCompany(UUID companyId,String type,String title,String body,UUID applicationId,UUID commandId){repository.database().sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      SELECT u.id,:type,:title,:body,'APPLICATION',:applicationId,'/company/candidates/'||CAST(:applicationId AS text),
        'application:'||CAST(:applicationId AS text)||':'||CAST(:commandId AS text)||':company:'||CAST(u.id AS text)
      FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:companyId AND u.status='ACTIVE'
      ON CONFLICT(dedupe_key) DO NOTHING
      """).param("type",type).param("title",title).param("body",body).param("applicationId",applicationId).param("commandId",commandId).param("companyId",companyId).update();}

    private Map<String,Object> sanitizedDocument(Map<String,Object> source){var copy=new LinkedHashMap<>(source);copy.remove("storageKey");copy.remove("studentUserId");copy.remove("studentProfileId");return copy;}
    private Map<String,Object> uploadIntent(UUID id,String url,Instant expires){return Map.of("uploadId",id,"uploadUrl",url,"method","PUT","headers",Map.of("Content-Type","application/pdf"),"expiresAt",expires.toString());}
    private Map<String,Object> download(String key,String fileName){ObjectStorage objects=storage();Instant expires=Instant.now().plusSeconds(properties.storage().downloadUrlTtlSeconds());return Map.of("downloadUrl",objects.createDownloadUrl(key,fileName,properties.storage().downloadUrlTtlSeconds()),"expiresAt",expires.toString());}
    private ObjectStorage storage(){if(storage==null)throw error(HttpStatus.SERVICE_UNAVAILABLE,"OBJECT_STORAGE_NOT_CONFIGURED","Chức năng tải tài liệu chưa được cấu hình.");return storage;}
    private Optional<Upload> studentUpload(UUID studentId,UUID uploadId,boolean lock){return repository.database().sql("""
      SELECT id,student_profile_id owner_id,NULL::uuid application_id,document_type,file_name,mime_type,file_size_bytes,storage_key,status,expires_at,student_document_id
      FROM student_document_uploads WHERE id=:id AND student_profile_id=:owner
      """+(lock?" FOR UPDATE":"")).param("id",uploadId).param("owner",studentId).query(this::mapUpload).optional();}
    private Upload mapUpload(java.sql.ResultSet r,int n)throws java.sql.SQLException{return new Upload(r.getObject("id",UUID.class),r.getObject("owner_id",UUID.class),r.getObject("application_id",UUID.class),r.getString("document_type"),r.getString("file_name"),r.getString("mime_type"),r.getLong("file_size_bytes"),r.getString("storage_key"),r.getString("status"),r.getTimestamp("expires_at").toInstant(),r.getObject("student_document_id",UUID.class));}
    private void validateUploadState(Upload upload,String prefix){if(!"PENDING".equals(upload.status()))throw error(HttpStatus.CONFLICT,prefix+"_UPLOAD_CLOSED","Phiên tải tệp không còn hiệu lực.");if(!upload.expiresAt().isAfter(Instant.now())){repository.database().sql("UPDATE "+("STUDENT_DOCUMENT".equals(prefix)?"student_document_uploads":"offer_document_uploads")+" SET status='EXPIRED' WHERE id=:id").param("id",upload.id()).update();throw error(HttpStatus.GONE,prefix+"_UPLOAD_EXPIRED","URL tải tệp đã hết hạn.");}}
    private void verifyPdf(ObjectStorage objects,Upload upload,String prefix){var metadata=objects.headObject(upload.storageKey());if(metadata==null)throw error(HttpStatus.CONFLICT,prefix+"_UPLOAD_MISSING","Kho lưu trữ chưa nhận được tệp.");String type=metadata.contentType()==null?null:metadata.contentType().split(";")[0].strip().toLowerCase();if(metadata.contentLength()!=upload.size()||!upload.mimeType().equals(type)){objects.deleteObject(upload.storageKey());throw error(HttpStatus.CONFLICT,prefix+"_UPLOAD_MISMATCH","Tệp không khớp dung lượng hoặc định dạng đã đăng ký.");}if(!"%PDF-".equals(new String(objects.readObjectPrefix(upload.storageKey(),5),StandardCharsets.US_ASCII))){objects.deleteObject(upload.storageKey());throw error(HttpStatus.CONFLICT,prefix+"_INVALID_PDF","Nội dung tệp không phải PDF hợp lệ.");}}

    private AppException studentNotFound(){return error(HttpStatus.NOT_FOUND,"STUDENT_PROFILE_NOT_FOUND","Không tìm thấy hồ sơ sinh viên.");}
    private AppException applicationNotFound(){return error(HttpStatus.NOT_FOUND,"APPLICATION_NOT_FOUND","Không tìm thấy đơn ứng tuyển.");}
    private AppException error(HttpStatus status,String code,String message){return new AppException(status,code,message);}

    private void audit(UUID actor,String action,String targetType,UUID targetId,Object metadata,RequestMetadata request){repository.database().sql("""
      INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address,user_agent)
      VALUES(:actor,:action,:targetType,:targetId,CAST(:metadata AS jsonb),CAST(:ip AS inet),:agent)
      """).param("actor",actor).param("action",action).param("targetType",targetType).param("targetId",targetId)
            .param("metadata",json.stringify(metadata)).param("ip",request.ipAddress(),Types.VARCHAR).param("agent",request.userAgent(),Types.VARCHAR).update();}
    private void notifyUser(UUID user,String type,String title,String body,String resourceType,UUID resourceId,String link,String dedupe){repository.database().sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      VALUES(:user,:type,:title,:body,:resourceType,:resourceId,:link,:dedupe) ON CONFLICT(dedupe_key) DO NOTHING
      """).param("user",user).param("type",type).param("title",title).param("body",body).param("resourceType",resourceType).param("resourceId",resourceId).param("link",link).param("dedupe",dedupe).update();}
    private void notifyUit(String type,String title,String body,String resourceType,UUID resourceId,String link,String dedupePrefix){repository.database().sql("""
      INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key)
      SELECT id,:type,:title,:body,:resourceType,:resourceId,:link,:prefix||id::text FROM users WHERE role='UIT_ADMIN' AND status='ACTIVE'
      ON CONFLICT(dedupe_key) DO NOTHING
      """).param("type",type).param("title",title).param("body",body).param("resourceType",resourceType).param("resourceId",resourceId).param("link",link).param("prefix",dedupePrefix).update();}
}
