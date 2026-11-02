package vn.edu.uit.careerhub.repository;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.sql.Timestamp;
import java.time.Instant;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.entity.LockedCompany;
import vn.edu.uit.careerhub.entity.LockedRecruiter;
import vn.edu.uit.careerhub.enums.PartnerStatus;
import vn.edu.uit.careerhub.enums.UserStatus;
import vn.edu.uit.careerhub.util.JsonSupport;
import vn.edu.uit.careerhub.dto.request.CompanyCreateRequest;
import vn.edu.uit.careerhub.dto.request.CompanyProfileUpdateRequest;
import vn.edu.uit.careerhub.dto.request.CompanyRecruiterRequest;
import vn.edu.uit.careerhub.dto.request.CompanyUpdateRequest;

@Repository
public class CompanyRepository {
    private static final String COMPANY_SELECT="""
      SELECT (jsonb_build_object(
        'id',c.id,'code',c.code,'name',c.name,'legalName',c.legal_name,'taxCode',c.tax_code,'industry',c.industry,
        'companySize',c.company_size,'description',c.description,'website',c.website,'address',c.address,
        'partnerStatus',c.partner_status,'version',c.version,'verifiedAt',c.verified_at,
        'recruiterCount',(SELECT count(*) FROM company_users cu WHERE cu.company_id=c.id),
        'activeRecruiterCount',(SELECT count(*) FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=c.id AND u.status IN ('ACTIVE','PENDING_ACTIVATION')),
        'recruitingJobCount',(SELECT count(*) FROM job_posts j WHERE j.company_id=c.id AND j.status='RECRUITING' AND j.deadline>=current_date),
        'createdAt',c.created_at,'updatedAt',c.updated_at
      ))::text data FROM companies c
      """;
    private static final String DIRECTORY_SELECT="""
      SELECT (jsonb_build_object('id',c.id,'code',c.code,'name',c.name,'industry',c.industry,'companySize',c.company_size,
        'description',c.description,'website',c.website,'address',c.address,'verifiedAt',c.verified_at,
        'recruitingJobCount',(SELECT count(*) FROM job_posts j WHERE j.company_id=c.id AND j.status='RECRUITING' AND j.deadline>=current_date)))::text data
      FROM companies c
      """;
    private final JdbcClient database;private final JsonSupport json;
    public CompanyRepository(JdbcClient database,JsonSupport json){this.database=database;this.json=json;}

    public PageResult list(int page,int pageSize,String query,PartnerStatus status){
        StringBuilder where=new StringBuilder(" WHERE 1=1");
        if(query!=null&&!query.isBlank())where.append(" AND (c.name ILIKE :query OR c.code ILIKE :query OR c.legal_name ILIKE :query OR c.tax_code ILIKE :query)");
        if(status!=null)where.append(" AND c.partner_status=:status");
        JdbcClient.StatementSpec count=database.sql("SELECT count(*) FROM companies c"+where);
        JdbcClient.StatementSpec items=database.sql(COMPANY_SELECT+where+" ORDER BY c.updated_at DESC LIMIT :limit OFFSET :offset").param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(query!=null&&!query.isBlank()){count=count.param("query","%"+query.strip()+"%");items=items.param("query","%"+query.strip()+"%");}
        if(status!=null){count=count.param("status",status.name());items=items.param("status",status.name());}
        return new PageResult(items.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single());
    }
    public PageResult directory(int page,int pageSize,String query,String industry,Boolean hasJobs){
        StringBuilder where=new StringBuilder(" WHERE c.partner_status='ACTIVE'");
        if(query!=null&&!query.isBlank())where.append(" AND (c.name ILIKE :query OR c.code ILIKE :query OR c.industry ILIKE :query OR c.address ILIKE :query)");
        if(industry!=null&&!industry.isBlank())where.append(" AND c.industry=:industry");
        if(Boolean.TRUE.equals(hasJobs))where.append(" AND EXISTS(SELECT 1 FROM job_posts j WHERE j.company_id=c.id AND j.status='RECRUITING' AND j.deadline>=current_date)");
        JdbcClient.StatementSpec count=database.sql("SELECT count(*) FROM companies c"+where);
        JdbcClient.StatementSpec items=database.sql(DIRECTORY_SELECT+where+" ORDER BY (SELECT count(*) FROM job_posts j WHERE j.company_id=c.id AND j.status='RECRUITING' AND j.deadline>=current_date) DESC,c.name LIMIT :limit OFFSET :offset").param("limit",pageSize).param("offset",(page-1)*pageSize);
        if(query!=null&&!query.isBlank()){count=count.param("query","%"+query.strip()+"%");items=items.param("query","%"+query.strip()+"%");}
        if(industry!=null&&!industry.isBlank()){count=count.param("industry",industry.strip());items=items.param("industry",industry.strip());}
        return new PageResult(items.query(String.class).list().stream().map(json::object).toList(),count.query(Long.class).single());
    }
    public Optional<Map<String,Object>> directoryById(UUID id){return database.sql(DIRECTORY_SELECT+" WHERE c.id=:id AND c.partner_status='ACTIVE'").param("id",id).query(String.class).optional().map(json::object);}
    public Optional<Map<String,Object>> findById(UUID id){
        Optional<Map<String,Object>> company=database.sql(COMPANY_SELECT+" WHERE c.id=:id").param("id",id).query(String.class).optional().map(json::object);
        company.ifPresent(value->value.put("recruiters",recruiters(id)));return company;
    }
    public Optional<Map<String,Object>> findByUserId(UUID userId){
        Optional<UUID> companyId=database.sql("SELECT company_id FROM company_users WHERE user_id=:userId").param("userId",userId).query(UUID.class).optional();
        return companyId.flatMap(this::findById);
    }
    private List<Map<String,Object>> recruiters(UUID companyId){
        return database.sql("""
          SELECT (jsonb_build_object('userId',u.id,'email',u.email,'fullName',cu.full_name,'title',cu.title,'isPrimary',cu.is_primary,
            'status',u.status,'lastLoginAt',u.last_login_at,'createdAt',cu.created_at))::text
          FROM company_users cu JOIN users u ON u.id=cu.user_id WHERE cu.company_id=:id ORDER BY cu.is_primary DESC,cu.created_at
          """).param("id",companyId).query(String.class).list().stream().map(json::object).toList();
    }
    public Optional<LockedCompany> lockCompany(UUID id){return database.sql("SELECT id,partner_status,version FROM companies WHERE id=:id FOR UPDATE").param("id",id)
            .query((r,n)->new LockedCompany(r.getObject("id",UUID.class),PartnerStatus.valueOf(r.getString("partner_status")),r.getInt("version"))).optional();}
    public Optional<LockedRecruiter> lockRecruiter(UUID companyId,UUID userId){return database.sql("""
      SELECT u.id,cu.company_id,u.status,u.password_hash,u.suspension_reason FROM company_users cu JOIN users u ON u.id=cu.user_id
      WHERE cu.company_id=:companyId AND u.id=:userId FOR UPDATE OF u
      """).param("companyId",companyId).param("userId",userId).query((r,n)->new LockedRecruiter(r.getObject("id",UUID.class),r.getObject("company_id",UUID.class),
              UserStatus.valueOf(r.getString("status")),r.getString("password_hash"),r.getString("suspension_reason"))).optional();}

    public UUID insertCompany(CompanyCreateRequest input,UUID actorId){
        return database.sql("""
              INSERT INTO companies(code,name,legal_name,tax_code,industry,company_size,description,website,address,partner_status,verified_at,created_by_user_id)
              VALUES(:code,:name,:legalName,:taxCode,:industry,:companySize,:description,:website,:address,'ACTIVE',now(),:actorId) RETURNING id
              """).param("code",input.code().strip().toUpperCase()).param("name",input.name().strip()).param("legalName",blank(input.legalName()))
                    .param("taxCode",blank(input.taxCode())).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address()))
                    .param("actorId",actorId).query(UUID.class).single();
    }

    public void updateCompany(UUID companyId,CompanyUpdateRequest input){
        database.sql("""
              UPDATE companies SET code=:code,name=:name,legal_name=:legalName,tax_code=:taxCode,industry=:industry,company_size=:companySize,
                description=:description,website=:website,address=:address,version=version+1 WHERE id=:id
              """).param("code",input.code().strip().toUpperCase()).param("name",input.name().strip()).param("legalName",blank(input.legalName()))
                    .param("taxCode",blank(input.taxCode())).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address())).param("id",companyId).update();
    }

    public void updateProfile(UUID companyId,CompanyProfileUpdateRequest input){
        database.sql("""
              UPDATE companies SET name=:name,industry=:industry,company_size=:companySize,description=:description,website=:website,address=:address,
                version=version+1 WHERE id=:id
              """).param("name",input.name().strip()).param("industry",blank(input.industry())).param("companySize",blank(input.companySize()))
                    .param("description",blank(input.description())).param("website",blank(input.website())).param("address",blank(input.address())).param("id",companyId).update();
    }

    /** Suspends the company, its active recruiters and every recruiter session. */
    public void suspendCompany(UUID companyId){
        database.sql("UPDATE companies SET partner_status='SUSPENDED',version=version+1 WHERE id=:id").param("id",companyId).update();
        database.sql("""
                  UPDATE users SET status='SUSPENDED',suspension_reason='COMPANY_SUSPENDED'
                  WHERE id IN(SELECT user_id FROM company_users WHERE company_id=:id) AND status IN('ACTIVE','PENDING_ACTIVATION','LOCKED')
                  """).param("id",companyId).update();
        database.sql("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id IN(SELECT user_id FROM company_users WHERE company_id=:id)").param("id",companyId).update();
    }

    public void reactivateCompany(UUID companyId){
        database.sql("UPDATE companies SET partner_status='ACTIVE',verified_at=COALESCE(verified_at,now()),version=version+1 WHERE id=:id").param("id",companyId).update();
        database.sql("""
                  UPDATE users SET status=CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,suspension_reason=NULL,failed_login_attempts=0,locked_until=NULL
                  WHERE id IN(SELECT user_id FROM company_users WHERE company_id=:id) AND status='SUSPENDED' AND suspension_reason='COMPANY_SUSPENDED'
                  """).param("id",companyId).update();
    }

    public UUID insertRecruiterUser(UUID companyId,CompanyRecruiterRequest input,boolean primary){
        UUID userId=database.sql("INSERT INTO users(email,role,status) VALUES(:email,'COMPANY','PENDING_ACTIVATION') RETURNING id")
                .param("email",input.email().strip().toLowerCase()).query(UUID.class).single();
        database.sql("INSERT INTO company_users(user_id,company_id,full_name,title,is_primary) VALUES(:userId,:companyId,:fullName,:title,:primary)")
                .param("userId",userId).param("companyId",companyId).param("fullName",input.fullName().strip()).param("title",blank(input.title())).param("primary",primary).update();
        return userId;
    }

    public void suspendRecruiter(UUID userId){
        database.sql("UPDATE users SET status='SUSPENDED',suspension_reason='ADMIN_SUSPENDED' WHERE id=:id").param("id",userId).update();
        database.sql("UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=:id").param("id",userId).update();
    }

    public void reactivateRecruiter(UUID userId){
        database.sql("UPDATE users SET status=CASE WHEN password_hash IS NULL THEN 'PENDING_ACTIVATION' ELSE 'ACTIVE' END,suspension_reason=NULL,failed_login_attempts=0,locked_until=NULL WHERE id=:id").param("id",userId).update();
    }

    public void invalidateActivationTokens(UUID userId){
        database.sql("UPDATE account_activation_tokens SET used_at=now() WHERE user_id=:id AND token_type='COMPANY_ACTIVATION' AND used_at IS NULL").param("id",userId).update();
    }

    public void insertActivation(UUID userId,UUID actorId,String tokenHash,Instant expires){database.sql("""
      INSERT INTO account_activation_tokens(user_id,token_type,token_hash,expires_at,created_by_user_id)
      VALUES(:userId,'COMPANY_ACTIVATION',:hash,:expires,:actorId)
      """).param("userId",userId).param("hash",tokenHash).param("expires",Timestamp.from(expires)).param("actorId",actorId).update();}

    private String blank(String value){return value==null||value.isBlank()?null:value.strip();}
}
