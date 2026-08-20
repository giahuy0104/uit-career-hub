package vn.edu.uit.careerhub.jobs;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.AuthPrincipal;
import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.jobs.JobModels.LockedJob;
import vn.edu.uit.careerhub.jobs.JobModels.ReviewDecision;
import vn.edu.uit.careerhub.jobs.JobModels.Status;
import vn.edu.uit.careerhub.jobs.JobRequests.Draft;
import vn.edu.uit.careerhub.jobs.JobRequests.ReviewReason;

@Service
public class JobService {
    private final JobRepository repository;
    private final AuthRepository audit;
    private final JdbcClient database;
    private final TransactionTemplate transactions;

    public JobService(JobRepository repository, AuthRepository audit, JdbcClient database, TransactionTemplate transactions) {
        this.repository=repository;this.audit=audit;this.database=database;this.transactions=transactions;
    }

    public Map<String,Object> companyJob(UUID companyId,UUID jobId){
        Map<String,Object> job=repository.findById(jobId).orElseThrow(this::notFound);
        Map<?,?> company=(Map<?,?>)job.get("company");
        if(!companyId.toString().equals(String.valueOf(company.get("id")))) throw notFound();
        return job;
    }
    public Map<String,Object> recruitingJob(UUID jobId){return repository.findRecruiting(jobId).orElseThrow(this::notFound);}

    public Map<String,Object> createDraft(AuthPrincipal actor,Draft input,RequestMetadata request){
        return transactions.execute(status->{
            String companyStatus=repository.companyStatus(actor.companyId());
            if(companyStatus==null) throw notFound();
            if(!"ACTIVE".equals(companyStatus)) throw new AppException(HttpStatus.FORBIDDEN,"COMPANY_NOT_ACTIVE","Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
            validateReferences(input);
            UUID id=repository.createDraft(actor.companyId(),actor.userId(),input);
            repository.replaceReferences(id,input);
            repository.addHistory(id,UUID.randomUUID(),null,"DRAFT","COMPANY",actor.userId(),null,null);
            audit.recordAudit(actor.userId(),"JOB_DRAFT_CREATED","JOB_POST",id,Map.of(),request);
            return repository.findById(id).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> updateDraft(AuthPrincipal actor,UUID jobId,Draft input,RequestMetadata request){
        if(input.expectedVersion()==null) throw new AppException(HttpStatus.BAD_REQUEST,"VALIDATION_ERROR","Dữ liệu gửi lên không hợp lệ.");
        return transactions.execute(status->{
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(!actor.companyId().equals(job.companyId())) throw notFound();
            if(job.status()!=Status.DRAFT&&job.status()!=Status.REVISION_REQUIRED) throw conflict("Chỉ có thể sửa tin ở trạng thái Bản nháp hoặc Cần chỉnh sửa.");
            if(job.version()!=input.expectedVersion()) throw conflict("Tin đã được cập nhật ở nơi khác. Vui lòng tải lại dữ liệu.");
            validateReferences(input);repository.updateDraft(jobId,input);repository.replaceReferences(jobId,input);
            audit.recordAudit(actor.userId(),"JOB_DRAFT_UPDATED","JOB_POST",jobId,Map.of("fromVersion",job.version()),request);
            return repository.findById(jobId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> submit(AuthPrincipal actor,UUID jobId,UUID commandId,RequestMetadata request){
        return transactions.execute(status->{
            if(repository.commandExists(jobId,commandId)) return owned(actor.companyId(),jobId);
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(!actor.companyId().equals(job.companyId())) throw notFound();
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            if(job.status()!=Status.DRAFT&&job.status()!=Status.REVISION_REQUIRED) throw conflict("Tin không còn ở trạng thái có thể gửi UIT duyệt.");
            if(!"ACTIVE".equals(job.partnerStatus())) throw new AppException(HttpStatus.FORBIDDEN,"COMPANY_NOT_ACTIVE","Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
            if(job.deadline().isBefore(LocalDate.now(ZoneOffset.UTC))) throw new AppException(HttpStatus.BAD_REQUEST,"JOB_DEADLINE_EXPIRED","Hạn ứng tuyển phải từ hôm nay trở đi.");
            repository.submit(jobId);repository.addHistory(jobId,commandId,job.status().name(),"PENDING_UIT_REVIEW","COMPANY",actor.userId(),null,null);
            Map<String,Object> result=repository.findById(jobId).orElseThrow(this::notFound);
            Map<?,?> company=(Map<?,?>)result.get("company");notifyUit(jobId,commandId,String.valueOf(result.get("title")),String.valueOf(company.get("name")));
            audit.recordAudit(actor.userId(),"JOB_SUBMITTED_FOR_UIT_REVIEW","JOB_POST",jobId,Map.of("fromStatus",job.status().name(),"commandId",commandId.toString()),request);
            return result;
        });
    }

    public Map<String,Object> review(UUID actorId,UUID jobId,UUID commandId,ReviewDecision decision,ReviewReason reason,RequestMetadata request){
        return transactions.execute(status->{
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            if(job.status()!=Status.PENDING_UIT_REVIEW) throw conflict("Tin đã được xử lý hoặc không còn chờ UIT duyệt.");
            if(decision==ReviewDecision.APPROVE&&job.deadline().isBefore(LocalDate.now(ZoneOffset.UTC)))
                throw new AppException(HttpStatus.BAD_REQUEST,"JOB_DEADLINE_EXPIRED","Không thể duyệt tin đã hết hạn ứng tuyển.");
            Status next=switch(decision){case APPROVE->Status.RECRUITING;case REQUEST_REVISION->Status.REVISION_REQUIRED;case REJECT->Status.REJECTED;};
            repository.review(jobId,next,actorId);
            repository.addHistory(jobId,commandId,"PENDING_UIT_REVIEW",next.name(),"UIT_ADMIN",actorId,
                    reason==null?null:reason.reasonCode().strip(),reason==null?null:reason.note().strip());
            Map<String,Object> result=repository.findById(jobId).orElseThrow(this::notFound);
            Map<?,?> company=(Map<?,?>)result.get("company");notifyCompany(UUID.fromString(String.valueOf(company.get("id"))),jobId,commandId,String.valueOf(result.get("title")),decision,reason);
            Map<String,Object> metadata=new LinkedHashMap<>();metadata.put("commandId",commandId.toString());metadata.put("nextStatus",next.name());metadata.put("reasonCode",reason==null?null:reason.reasonCode());
            audit.recordAudit(actorId,"JOB_UIT_"+decision.name(),"JOB_POST",jobId,metadata,request);
            return result;
        });
    }

    private void validateReferences(Draft input){
        if(!repository.referencesValid("categories",input.categoryIds())||!repository.referencesValid("skills",input.skillIds()))
            throw new AppException(HttpStatus.BAD_REQUEST,"JOB_REFERENCE_INVALID","Nhóm ngành hoặc kỹ năng không hợp lệ.");
    }
    private Map<String,Object> owned(UUID companyId,UUID jobId){return companyJob(companyId,jobId);}

    private void notifyUit(UUID jobId,UUID commandId,String title,String company){
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,'JOB_PENDING_UIT_REVIEW','Có tin tuyển dụng mới cần duyệt',:company||' đã gửi tin "'||:title||'".','JOB_POST',:jobId,
            '/uit/jobs/review','job:'||CAST(:jobId AS text)||':submit:'||CAST(:commandId AS text)||':'||CAST(u.id AS text),
            jsonb_build_object('jobId',CAST(:jobId AS text),'commandId',CAST(:commandId AS text))
          FROM users u WHERE u.role='UIT_ADMIN' AND u.status='ACTIVE' ON CONFLICT(dedupe_key) DO NOTHING
          """).param("company",company).param("title",title).param("jobId",jobId).param("commandId",commandId).update();
    }
    private void notifyCompany(UUID companyId,UUID jobId,UUID commandId,String jobTitle,ReviewDecision decision,ReviewReason reason){
        String type,title,body;
        switch(decision){
            case APPROVE->{type="JOB_APPROVED";title="Tin tuyển dụng đã được duyệt";body="Tin \""+jobTitle+"\" đã được công khai.";}
            case REQUEST_REVISION->{type="JOB_REVISION_REQUIRED";title="Tin tuyển dụng cần chỉnh sửa";body=reason==null?"Tin cần chỉnh sửa.":reason.note();}
            default->{type="JOB_REJECTED";title="Tin tuyển dụng đã bị từ chối";body=reason==null?"Tin đã bị từ chối.":reason.note();}
        }
        database.sql("""
          INSERT INTO notifications(recipient_user_id,type,title,body,resource_type,resource_id,deep_link,dedupe_key,payload)
          SELECT u.id,:type,:title,:body,'JOB_POST',:jobId,'/company/jobs/'||CAST(:jobId AS text),
            'job:'||CAST(:jobId AS text)||':review:'||CAST(:commandId AS text)||':'||CAST(u.id AS text),
            jsonb_build_object('jobId',CAST(:jobId AS text),'commandId',CAST(:commandId AS text),'decision',:decision)
          FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:companyId AND u.status='ACTIVE'
          ON CONFLICT(dedupe_key) DO NOTHING
          """).param("type",type).param("title",title).param("body",body).param("jobId",jobId).param("commandId",commandId)
                .param("decision",decision.name().toLowerCase().replace('_','-')).param("companyId",companyId).update();
    }
    private AppException notFound(){return new AppException(HttpStatus.NOT_FOUND,"JOB_NOT_FOUND","Không tìm thấy tin tuyển dụng.");}
    private AppException conflict(String message){return new AppException(HttpStatus.CONFLICT,"JOB_STATE_CONFLICT",message);}
}
