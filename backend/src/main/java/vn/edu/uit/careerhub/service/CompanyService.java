package vn.edu.uit.careerhub.service;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.RequestMetadata;
import vn.edu.uit.careerhub.dto.request.CompanyCreateRequest;
import vn.edu.uit.careerhub.dto.request.CompanyProfileUpdateRequest;
import vn.edu.uit.careerhub.dto.request.CompanyRecruiterRequest;
import vn.edu.uit.careerhub.dto.request.CompanyUpdateRequest;
import vn.edu.uit.careerhub.entity.LockedCompany;
import vn.edu.uit.careerhub.entity.LockedRecruiter;
import vn.edu.uit.careerhub.enums.PartnerStatus;
import vn.edu.uit.careerhub.enums.UserStatus;
import vn.edu.uit.careerhub.exception.AppException;
import vn.edu.uit.careerhub.exception.ErrorType;
import vn.edu.uit.careerhub.repository.AuditRepository;
import vn.edu.uit.careerhub.repository.CompanyRepository;
import vn.edu.uit.careerhub.repository.UniqueConstraints;
import vn.edu.uit.careerhub.security.TokenService;

@Service
public class CompanyService {
    private final CompanyRepository repository;
    private final TransactionTemplate transactions;
    private final TokenService tokens;
    private final AuditRepository audit;

    public CompanyService(CompanyRepository repository, TransactionTemplate transactions, TokenService tokens, AuditRepository audit) {
        this.repository = repository;
        this.transactions = transactions;
        this.tokens = tokens;
        this.audit = audit;
    }

    public PageResult list(int page, int pageSize, String query, PartnerStatus status) { return repository.list(page, pageSize, query, status); }
    public PageResult directoryPage(int page, int pageSize, String query, String industry, Boolean hasJobs) { return repository.directory(page, pageSize, query, industry, hasJobs); }
    public Map<String,Object> get(UUID id){return repository.findById(id).orElseThrow(this::notFound);}
    public Map<String,Object> getMy(UUID userId){return repository.findByUserId(userId).orElseThrow(this::notFound);}
    public Map<String,Object> directory(UUID id){return repository.directoryById(id).orElseThrow(this::notFound);}

    public Map<String,Object> create(UUID actorId,CompanyCreateRequest input,RequestMetadata request){
        String raw=tokens.createRefreshToken();Instant expires=Instant.now().plus(72,ChronoUnit.HOURS);
        try{return transactions.execute(status->{
            UUID companyId=repository.insertCompany(input,actorId);
            UUID userId=repository.insertRecruiterUser(companyId,input.primaryRecruiter(),true);
            repository.insertActivation(userId,actorId,tokens.hashOpaqueToken(raw),expires);
            audit.record(actorId,"COMPANY_PARTNER_CREATED","COMPANY",companyId,Map.of("primaryRecruiterUserId",userId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,null);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> update(UUID actorId,UUID companyId,CompanyUpdateRequest input,RequestMetadata request){
        try{return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,input.expectedVersion());
            repository.updateCompany(companyId,input);
            audit.record(actorId,"COMPANY_PARTNER_UPDATED","COMPANY",companyId,Map.of("fromVersion",company.version()),request);
            return repository.findById(companyId).orElseThrow(this::notFound);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> updateProfile(UUID actorId,UUID companyId,CompanyProfileUpdateRequest input,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,input.expectedVersion());
            if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp đang bị tạm ngưng nên chưa thể cập nhật hồ sơ.");
            repository.updateProfile(companyId,input);
            audit.record(actorId,"COMPANY_PROFILE_UPDATED","COMPANY",companyId,Map.of("fromVersion",company.version()),request);
            return repository.findById(companyId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> changeCompanyState(UUID actorId,UUID companyId,boolean reactivate,int expectedVersion,String reason,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,expectedVersion);
            if(!reactivate){
                if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Chỉ doanh nghiệp đang hoạt động mới có thể tạm ngưng.");
                repository.suspendCompany(companyId);
                audit.record(actorId,"COMPANY_PARTNER_SUSPENDED","COMPANY",companyId,Map.of("reason",reason),request);
            }else{
                if(company.partnerStatus()!=PartnerStatus.SUSPENDED)throw conflict("Chỉ doanh nghiệp đang tạm ngưng mới có thể kích hoạt lại.");
                repository.reactivateCompany(companyId);
                audit.record(actorId,"COMPANY_PARTNER_REACTIVATED","COMPANY",companyId,Map.of("reason",reason),request);
            }
            return repository.findById(companyId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> addRecruiter(UUID actorId,UUID companyId,CompanyRecruiterRequest input,RequestMetadata request){
        String raw=tokens.createRefreshToken();Instant expires=Instant.now().plus(72,ChronoUnit.HOURS);
        try{return transactions.execute(status->{
            LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);
            if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp phải hoạt động trước khi thêm tài khoản.");
            UUID userId=repository.insertRecruiterUser(companyId,input,false);
            repository.insertActivation(userId,actorId,tokens.hashOpaqueToken(raw),expires);
            audit.record(actorId,"COMPANY_RECRUITER_CREATED","USER",userId,Map.of("companyId",companyId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,userId);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> changeRecruiterState(UUID actorId,UUID companyId,UUID userId,boolean reactivate,String reason,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);
            LockedRecruiter recruiter=repository.lockRecruiter(companyId,userId).orElseThrow(this::notFound);
            if(!reactivate){
                if(recruiter.status()!=UserStatus.ACTIVE&&recruiter.status()!=UserStatus.PENDING_ACTIVATION)throw conflict("Tài khoản không ở trạng thái có thể tạm ngưng.");
                repository.suspendRecruiter(userId);
                audit.record(actorId,"COMPANY_RECRUITER_SUSPENDED","USER",userId,Map.of("companyId",companyId.toString(),"reason",reason),request);
            }else{
                if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp đang bị tạm ngưng.");
                if(recruiter.status()!=UserStatus.SUSPENDED||!"ADMIN_SUSPENDED".equals(recruiter.suspensionReason()))throw conflict("Tài khoản không do UIT tạm ngưng nên không thể kích hoạt theo thao tác này.");
                repository.reactivateRecruiter(userId);
                audit.record(actorId,"COMPANY_RECRUITER_REACTIVATED","USER",userId,Map.of("companyId",companyId.toString(),"reason",reason),request);
            }
            return repository.findById(companyId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> regenerate(UUID actorId,UUID companyId,UUID userId,RequestMetadata request){
        String raw=tokens.createRefreshToken();Instant expires=Instant.now().plus(72,ChronoUnit.HOURS);
        return transactions.execute(status->{
            LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);
            LockedRecruiter recruiter=repository.lockRecruiter(companyId,userId).orElseThrow(this::notFound);
            if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp đang bị tạm ngưng.");
            if(recruiter.status()!=UserStatus.PENDING_ACTIVATION||recruiter.passwordHash()!=null)throw new AppException(ErrorType.CONFLICT,"COMPANY_ACTIVATION_NOT_ALLOWED","Chỉ tài khoản chưa kích hoạt mới có thể tạo lại liên kết.");
            repository.invalidateActivationTokens(userId);
            repository.insertActivation(userId,actorId,tokens.hashOpaqueToken(raw),expires);
            audit.record(actorId,"COMPANY_ACTIVATION_LINK_REGENERATED","USER",userId,Map.of("companyId",companyId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,null);
        });
    }

    private LockedCompany requireVersion(UUID companyId,int version){LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);if(company.version()!=version)throw new AppException(ErrorType.CONFLICT,"COMPANY_VERSION_CONFLICT","Dữ liệu doanh nghiệp vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.");return company;}
    private Map<String,Object> resultWithActivation(Map<String,Object> company,String raw,Instant expires,UUID userId){Map<String,Object> result=new LinkedHashMap<>();if(userId!=null)result.put("userId",userId);result.put("company",company);result.put("activation",Map.of("token",raw,"expiresAt",expires.toString()));return result;}
    private AppException notFound(){return new AppException(ErrorType.NOT_FOUND,"RESOURCE_NOT_FOUND","Không tìm thấy doanh nghiệp hoặc tài khoản phụ trách.");}
    private AppException conflict(String message){return new AppException(ErrorType.CONFLICT,"COMPANY_STATE_CONFLICT",message);}
    private AppException translate(DataIntegrityViolationException error){
        String constraint=UniqueConstraints.violatedBy(error).orElse("");
        if("uq_users_email_normalized".equals(constraint))return new AppException(ErrorType.CONFLICT,"COMPANY_RECRUITER_EMAIL_EXISTS","Email tài khoản đã tồn tại trong hệ thống.");
        if("companies_code_key".equals(constraint))return new AppException(ErrorType.CONFLICT,"COMPANY_CODE_EXISTS","Mã doanh nghiệp đã tồn tại.");
        if("uq_companies_tax_code_normalized".equals(constraint))return new AppException(ErrorType.CONFLICT,"COMPANY_TAX_CODE_EXISTS","Mã số thuế đã được sử dụng.");
        throw error;}
}
