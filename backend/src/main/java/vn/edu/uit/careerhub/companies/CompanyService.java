package vn.edu.uit.careerhub.companies;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

import org.postgresql.util.PSQLException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import vn.edu.uit.careerhub.auth.AuthRepository;
import vn.edu.uit.careerhub.auth.RequestMetadata;
import vn.edu.uit.careerhub.auth.TokenService;
import vn.edu.uit.careerhub.auth.UserStatus;
import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.companies.CompanyModels.LockedCompany;
import vn.edu.uit.careerhub.companies.CompanyModels.LockedRecruiter;
import vn.edu.uit.careerhub.companies.CompanyModels.PartnerStatus;
import vn.edu.uit.careerhub.companies.CompanyRequests.Create;
import vn.edu.uit.careerhub.companies.CompanyRequests.ProfileUpdate;
import vn.edu.uit.careerhub.companies.CompanyRequests.Recruiter;
import vn.edu.uit.careerhub.companies.CompanyRequests.Update;

@Service
public class CompanyService {
    private final CompanyRepository repository;private final JdbcClient database;private final TransactionTemplate transactions;
    private final TokenService tokens;private final AuthRepository audit;
    public CompanyService(CompanyRepository repository,JdbcClient database,TransactionTemplate transactions,TokenService tokens,AuthRepository audit){
        this.repository=repository;this.database=database;this.transactions=transactions;this.tokens=tokens;this.audit=audit;
    }
    public Map<String,Object> get(UUID id){return repository.findById(id).orElseThrow(this::notFound);}
    public Map<String,Object> getMy(UUID userId){return repository.findByUserId(userId).orElseThrow(this::notFound);}
    public Map<String,Object> directory(UUID id){return repository.directoryById(id).orElseThrow(this::notFound);}

    public Map<String,Object> create(UUID actorId,Create input,RequestMetadata request){
        String raw=tokens.createRefreshToken();Instant expires=Instant.now().plus(72,ChronoUnit.HOURS);
        try{return transactions.execute(status->{
            UUID companyId=database.sql("""
              INSERT INTO companies(code,name,legal_name,tax_code,industry,company_size,description,website,address,partner_status,verified_at,created_by_user_id)
              VALUES(:code,:name,:legalName,:taxCode,:industry,:companySize,:description,:website,:address,'ACTIVE',now(),:actorId) RETURNING id
              """).param("code",input.code().strip().toUpperCase()).param("name",input.name().strip()).param("legalName",blank(input.legalName()))
                    .param("taxCode",blank(input.taxCode())).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address()))
                    .param("actorId",actorId).query(UUID.class).single();
            UUID userId=createRecruiterUser(companyId,input.primaryRecruiter(),true);
            insertActivation(userId,actorId,raw,expires);
            audit.recordAudit(actorId,"COMPANY_PARTNER_CREATED","COMPANY",companyId,Map.of("primaryRecruiterUserId",userId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,null);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> update(UUID actorId,UUID companyId,Update input,RequestMetadata request){
        try{return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,input.expectedVersion());
            database.sql("""
              UPDATE companies SET code=:code,name=:name,legal_name=:legalName,tax_code=:taxCode,industry=:industry,company_size=:companySize,
                description=:description,website=:website,address=:address,version=version+1 WHERE id=:id
              """).param("code",input.code().strip().toUpperCase()).param("name",input.name().strip()).param("legalName",blank(input.legalName()))
                    .param("taxCode",blank(input.taxCode())).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address())).param("id",companyId).update();
            audit.recordAudit(actorId,"COMPANY_PARTNER_UPDATED","COMPANY",companyId,Map.of("fromVersion",company.version()),request);
            return repository.findById(companyId).orElseThrow(this::notFound);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> updateProfile(UUID actorId,UUID companyId,ProfileUpdate input,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,input.expectedVersion());
            if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp đang bị tạm ngưng nên chưa thể cập nhật hồ sơ.");
            database.sql("""
              UPDATE companies SET name=:name,industry=:industry,company_size=:companySize,description=:description,website=:website,address=:address,
                version=version+1 WHERE id=:id
              """).param("name",input.name().strip()).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address())).param("id",companyId).update();
            audit.recordAudit(actorId,"COMPANY_PROFILE_UPDATED","COMPANY",companyId,Map.of("fromVersion",company.version()),request);
            return repository.findById(companyId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> changeCompanyState(UUID actorId,UUID companyId,boolean reactivate,int expectedVersion,String reason,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=requireVersion(companyId,expectedVersion);
            if(!reactivate){
                if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Chỉ doanh nghiệp đang hoạt động mới có thể tạm ngưng.");
                database.sql("UPDATE companies SET partner_status='SUSPENDED',version=version+1 WHERE id=:id").param("id",companyId).update();
                database.sql("""
                  UPDATE users SET status='SUSPENDED',suspension_reason='COMPANY_SUSPENDED'
                  WHERE id IN(SELECT user_id FROM company_users WHERE company_id=:id) AND status IN('ACTIVE','PENDING_ACTIVATION')
                  """).param("id",companyId).update();revokeCompanySessions(companyId);
                audit.recordAudit(actorId,"COMPANY_PARTNER_SUSPENDED","COMPANY",companyId,Map.of("reason",reason),request);
            }else{
                if(company.partnerStatus()!=PartnerStatus.SUSPENDED)throw conflict("Chỉ doanh nghiệp đang tạm ngưng mới có thể kích hoạt lại.");
                database.sql("UPDATE companies SET partner_status='ACTIVE',verified_at=COALESCE(verified_at,now()),version=version+1 WHERE id=:id").param("id",companyId).update();
                database.sql("""
                  UPDATE users SET status=CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,suspension_reason=NULL
                  WHERE id IN(SELECT user_id FROM company_users WHERE company_id=:id) AND status='SUSPENDED' AND suspension_reason='COMPANY_SUSPENDED'
                  """).param("id",companyId).update();
                audit.recordAudit(actorId,"COMPANY_PARTNER_REACTIVATED","COMPANY",companyId,Map.of("reason",reason),request);
            }
            return repository.findById(companyId).orElseThrow(this::notFound);
        });
    }

    public Map<String,Object> addRecruiter(UUID actorId,UUID companyId,Recruiter input,RequestMetadata request){
        String raw=tokens.createRefreshToken();Instant expires=Instant.now().plus(72,ChronoUnit.HOURS);
        try{return transactions.execute(status->{
            LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);
            if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp phải hoạt động trước khi thêm tài khoản.");
            UUID userId=createRecruiterUser(companyId,input,false);insertActivation(userId,actorId,raw,expires);
            audit.recordAudit(actorId,"COMPANY_RECRUITER_CREATED","USER",userId,Map.of("companyId",companyId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,userId);
        });}catch(DataIntegrityViolationException error){throw translate(error);}
    }

    public Map<String,Object> changeRecruiterState(UUID actorId,UUID companyId,UUID userId,boolean reactivate,String reason,RequestMetadata request){
        return transactions.execute(status->{
            LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);
            LockedRecruiter recruiter=repository.lockRecruiter(companyId,userId).orElseThrow(this::notFound);
            if(!reactivate){
                if(recruiter.status()!=UserStatus.ACTIVE&&recruiter.status()!=UserStatus.PENDING_ACTIVATION)throw conflict("Tài khoản không ở trạng thái có thể tạm ngưng.");
                database.sql("UPDATE users SET status='SUSPENDED',suspension_reason='ADMIN_SUSPENDED' WHERE id=:id").param("id",userId).update();
                database.sql("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=:id").param("id",userId).update();
                audit.recordAudit(actorId,"COMPANY_RECRUITER_SUSPENDED","USER",userId,Map.of("companyId",companyId.toString(),"reason",reason),request);
            }else{
                if(company.partnerStatus()!=PartnerStatus.ACTIVE)throw conflict("Doanh nghiệp đang bị tạm ngưng.");
                if(recruiter.status()!=UserStatus.SUSPENDED||!"ADMIN_SUSPENDED".equals(recruiter.suspensionReason()))throw conflict("Tài khoản không do UIT tạm ngưng nên không thể kích hoạt theo thao tác này.");
                database.sql("UPDATE users SET status=CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,suspension_reason=NULL WHERE id=:id").param("id",userId).update();
                audit.recordAudit(actorId,"COMPANY_RECRUITER_REACTIVATED","USER",userId,Map.of("companyId",companyId.toString(),"reason",reason),request);
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
            if(recruiter.status()!=UserStatus.PENDING_ACTIVATION||recruiter.passwordHash()!=null)throw new AppException(HttpStatus.CONFLICT,"COMPANY_ACTIVATION_NOT_ALLOWED","Chỉ tài khoản chưa kích hoạt mới có thể tạo lại liên kết.");
            database.sql("UPDATE account_activation_tokens SET used_at=now() WHERE user_id=:id AND token_type='COMPANY_ACTIVATION' AND used_at IS NULL").param("id",userId).update();
            insertActivation(userId,actorId,raw,expires);audit.recordAudit(actorId,"COMPANY_ACTIVATION_LINK_REGENERATED","USER",userId,Map.of("companyId",companyId.toString()),request);
            return resultWithActivation(repository.findById(companyId).orElseThrow(this::notFound),raw,expires,null);
        });
    }

    private UUID createRecruiterUser(UUID companyId,Recruiter input,boolean primary){
        UUID userId=database.sql("INSERT INTO users(email,role,status) VALUES(:email,'COMPANY','PENDING_ACTIVATION') RETURNING id")
                .param("email",input.email().strip().toLowerCase()).query(UUID.class).single();
        database.sql("INSERT INTO company_users(user_id,company_id,full_name,title,is_primary) VALUES(:userId,:companyId,:fullName,:title,:primary)")
                .param("userId",userId).param("companyId",companyId).param("fullName",input.fullName().strip()).param("title",blank(input.title())).param("primary",primary).update();
        return userId;
    }
    private void insertActivation(UUID userId,UUID actorId,String raw,Instant expires){database.sql("""
      INSERT INTO account_activation_tokens(user_id,token_type,token_hash,expires_at,created_by_user_id)
      VALUES(:userId,'COMPANY_ACTIVATION',:hash,:expires,:actorId)
      """).param("userId",userId).param("hash",tokens.hashOpaqueToken(raw)).param("expires",Timestamp.from(expires)).param("actorId",actorId).update();}
    private LockedCompany requireVersion(UUID companyId,int version){LockedCompany company=repository.lockCompany(companyId).orElseThrow(this::notFound);if(company.version()!=version)throw new AppException(HttpStatus.CONFLICT,"COMPANY_VERSION_CONFLICT","Dữ liệu doanh nghiệp vừa được cập nhật. Vui lòng tải lại trước khi tiếp tục.");return company;}
    private void revokeCompanySessions(UUID companyId){database.sql("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id IN(SELECT user_id FROM company_users WHERE company_id=:id)").param("id",companyId).update();}
    private Map<String,Object> resultWithActivation(Map<String,Object> company,String raw,Instant expires,UUID userId){Map<String,Object> result=new LinkedHashMap<>();if(userId!=null)result.put("userId",userId);result.put("company",company);result.put("activation",Map.of("token",raw,"expiresAt",expires.toString()));return result;}
    private String blank(String value){return value==null||value.isBlank()?null:value.strip();}
    private AppException notFound(){return new AppException(HttpStatus.NOT_FOUND,"RESOURCE_NOT_FOUND","Không tìm thấy doanh nghiệp hoặc tài khoản phụ trách.");}
    private AppException conflict(String message){return new AppException(HttpStatus.CONFLICT,"COMPANY_STATE_CONFLICT",message);}
    private AppException translate(DataIntegrityViolationException error){Throwable cause=error.getMostSpecificCause();if(cause instanceof PSQLException postgres&&"23505".equals(postgres.getSQLState())){
        String constraint=postgres.getServerErrorMessage()==null?"":postgres.getServerErrorMessage().getConstraint();
        if("uq_users_email_normalized".equals(constraint))return new AppException(HttpStatus.CONFLICT,"COMPANY_RECRUITER_EMAIL_EXISTS","Email tài khoản đã tồn tại trong hệ thống.");
        if("companies_code_key".equals(constraint))return new AppException(HttpStatus.CONFLICT,"COMPANY_CODE_EXISTS","Mã doanh nghiệp đã tồn tại.");
        if("uq_companies_tax_code_normalized".equals(constraint))return new AppException(HttpStatus.CONFLICT,"COMPANY_TAX_CODE_EXISTS","Mã số thuế đã được sử dụng.");}
        throw error;}
}
