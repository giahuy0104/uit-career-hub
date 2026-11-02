package vn.edu.uit.careerhub.service;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.JobDraftRequest;
import vn.edu.uit.careerhub.dto.request.JobReviewReasonRequest;
import vn.edu.uit.careerhub.entity.LockedJob;
import vn.edu.uit.careerhub.enums.JobReviewDecision;
import vn.edu.uit.careerhub.enums.JobStatus;
import vn.edu.uit.careerhub.enums.OpportunityType;
import vn.edu.uit.careerhub.enums.WorkMode;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.JobRepository;
import vn.edu.uit.careerhub.security.AuthPrincipal;

@Service
public class JobService {
    private final JobRepository repository;
    private final AuditRepository audit;
    private final TransactionTemplate transactions;

    public JobService(JobRepository repository, AuditRepository audit, TransactionTemplate transactions) {
        this.repository=repository;this.audit=audit;this.transactions=transactions;
    }

    public PageResult recruiting(int page,int pageSize,String query,String category,UUID companyId,WorkMode workMode,OpportunityType opportunityType){return repository.recruiting(page,pageSize,query,category,companyId,workMode,opportunityType);}
    public PageResult listCompany(UUID companyId,int page,int pageSize,JobStatus status){return repository.listCompany(companyId,page,pageSize,status);}
    public PageResult reviewQueue(int page,int pageSize){return repository.reviewQueue(page,pageSize);}

    public Map<String,Object> companyJob(UUID companyId,UUID jobId){
        Map<String,Object> job=repository.findById(jobId).orElseThrow(this::notFound);
        Map<?,?> company=(Map<?,?>)job.get("company");
        if(!companyId.toString().equals(String.valueOf(company.get("id")))) throw notFound();
        return job;
    }
    public Map<String,Object> recruitingJob(UUID jobId){return repository.findRecruiting(jobId).orElseThrow(this::notFound);}

    public Map<String,Object> createDraft(AuthPrincipal actor,JobDraftRequest input,RequestMetadata request){
        return transactions.execute(status->{
            String companyStatus=repository.companyStatus(actor.companyId());
            if(companyStatus==null) throw notFound();
            if(!"ACTIVE".equals(companyStatus)) throw new AppException(ErrorType.FORBIDDEN,"COMPANY_NOT_ACTIVE","Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
            validateReferences(input);
            UUID id=repository.createDraft(actor.companyId(),actor.userId(),input);
            repository.replaceReferences(id,input);
            repository.addHistory(id,UUID.randomUUID(),null,"DRAFT","COMPANY",actor.userId(),null,null);
            audit.record(actor.userId(),"JOB_DRAFT_CREATED","JOB_POST",id,Map.of(),request);
            return repository.findById(id).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> updateDraft(AuthPrincipal actor,UUID jobId,JobDraftRequest input,RequestMetadata request){
        if(input.expectedVersion()==null) throw new AppException(ErrorType.INVALID_INPUT,"VALIDATION_ERROR","Dữ liệu gửi lên không hợp lệ.");
        return transactions.execute(status->{
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(!actor.companyId().equals(job.companyId())) throw notFound();
            if(job.status()!=JobStatus.DRAFT&&job.status()!=JobStatus.REVISION_REQUIRED) throw conflict("Chỉ có thể sửa tin ở trạng thái Bản nháp hoặc Cần chỉnh sửa.");
            if(job.version()!=input.expectedVersion()) throw conflict("Tin đã được cập nhật ở nơi khác. Vui lòng tải lại dữ liệu.");
            validateReferences(input);repository.updateDraft(jobId,input);repository.replaceReferences(jobId,input);
            audit.record(actor.userId(),"JOB_DRAFT_UPDATED","JOB_POST",jobId,Map.of("fromVersion",job.version()),request);
            return repository.findById(jobId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> submit(AuthPrincipal actor,UUID jobId,UUID commandId,RequestMetadata request){
        return transactions.execute(status->{
            if(repository.commandExists(jobId,commandId)) return owned(actor.companyId(),jobId);
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(!actor.companyId().equals(job.companyId())) throw notFound();
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            if(job.status()!=JobStatus.DRAFT&&job.status()!=JobStatus.REVISION_REQUIRED) throw conflict("Tin không còn ở trạng thái có thể gửi UIT duyệt.");
            if(!"ACTIVE".equals(job.partnerStatus())) throw new AppException(ErrorType.FORBIDDEN,"COMPANY_NOT_ACTIVE","Doanh nghiệp chưa ở trạng thái đối tác hoạt động.");
            if(job.deadline().isBefore(LocalDate.now(ZoneOffset.UTC))) throw new AppException(ErrorType.INVALID_INPUT,"JOB_DEADLINE_EXPIRED","Hạn ứng tuyển phải từ hôm nay trở đi.");
            repository.submit(jobId);repository.addHistory(jobId,commandId,job.status().name(),"PENDING_UIT_REVIEW","COMPANY",actor.userId(),null,null);
            Map<String,Object> result=repository.findById(jobId).orElseThrow(this::notFound);
            Map<?,?> company=(Map<?,?>)result.get("company");repository.notifyUitOfSubmission(jobId,commandId,String.valueOf(result.get("title")),String.valueOf(company.get("name")));
            audit.record(actor.userId(),"JOB_SUBMITTED_FOR_UIT_REVIEW","JOB_POST",jobId,Map.of("fromStatus",job.status().name(),"commandId",commandId.toString()),request);
            return result;
        });
    }

    public Map<String,Object> review(UUID actorId,UUID jobId,UUID commandId,JobReviewDecision decision,JobReviewReasonRequest reason,RequestMetadata request){
        return transactions.execute(status->{
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            LockedJob job=repository.lock(jobId).orElseThrow(this::notFound);
            if(repository.commandExists(jobId,commandId)) return repository.findById(jobId).orElseThrow(this::notFound);
            if(job.status()!=JobStatus.PENDING_UIT_REVIEW) throw conflict("Tin đã được xử lý hoặc không còn chờ UIT duyệt.");
            if(decision==JobReviewDecision.APPROVE&&job.deadline().isBefore(LocalDate.now(ZoneOffset.UTC)))
                throw new AppException(ErrorType.INVALID_INPUT,"JOB_DEADLINE_EXPIRED","Không thể duyệt tin đã hết hạn ứng tuyển.");
            JobStatus next=switch(decision){case APPROVE->JobStatus.RECRUITING;case REQUEST_REVISION->JobStatus.REVISION_REQUIRED;case REJECT->JobStatus.REJECTED;};
            repository.review(jobId,next,actorId);
            repository.addHistory(jobId,commandId,"PENDING_UIT_REVIEW",next.name(),"UIT_ADMIN",actorId,
                    reason==null?null:reason.reasonCode().strip(),reason==null?null:reason.note().strip());
            Map<String,Object> result=repository.findById(jobId).orElseThrow(this::notFound);
            Map<?,?> company=(Map<?,?>)result.get("company");notifyCompany(UUID.fromString(String.valueOf(company.get("id"))),jobId,commandId,String.valueOf(result.get("title")),decision,reason);
            Map<String,Object> metadata=new LinkedHashMap<>();metadata.put("commandId",commandId.toString());metadata.put("nextStatus",next.name());metadata.put("reasonCode",reason==null?null:reason.reasonCode());
            audit.record(actorId,"JOB_UIT_"+decision.name(),"JOB_POST",jobId,metadata,request);
            return result;
        });
    }

    private void validateReferences(JobDraftRequest input){
        if(!repository.referencesValid("categories",input.categoryIds())||!repository.referencesValid("skills",input.skillIds()))
            throw new AppException(ErrorType.INVALID_INPUT,"JOB_REFERENCE_INVALID","Nhóm ngành hoặc kỹ năng không hợp lệ.");
    }
    private Map<String,Object> owned(UUID companyId,UUID jobId){return companyJob(companyId,jobId);}

    private void notifyCompany(UUID companyId,UUID jobId,UUID commandId,String jobTitle,JobReviewDecision decision,JobReviewReasonRequest reason){
        String type,title,body;
        switch(decision){
            case APPROVE->{type="JOB_APPROVED";title="Tin tuyển dụng đã được duyệt";body="Tin \""+jobTitle+"\" đã được công khai.";}
            case REQUEST_REVISION->{type="JOB_REVISION_REQUIRED";title="Tin tuyển dụng cần chỉnh sửa";body=reason==null?"Tin cần chỉnh sửa.":reason.note();}
            default->{type="JOB_REJECTED";title="Tin tuyển dụng đã bị từ chối";body=reason==null?"Tin đã bị từ chối.":reason.note();}
        }
        repository.notifyCompanyOfReview(companyId,jobId,commandId,type,title,body,decision.name().toLowerCase().replace('_','-'));
    }
    private AppException notFound(){return new AppException(ErrorType.NOT_FOUND,"JOB_NOT_FOUND","Không tìm thấy tin tuyển dụng.");}
    private AppException conflict(String message){return new AppException(ErrorType.CONFLICT,"JOB_STATE_CONFLICT",message);}
}
