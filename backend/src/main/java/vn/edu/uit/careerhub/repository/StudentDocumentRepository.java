package vn.edu.uit.careerhub.repository;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import vn.edu.uit.careerhub.dto.PageResult;
import vn.edu.uit.careerhub.dto.request.DocumentUploadRequest;
import vn.edu.uit.careerhub.entity.DocumentStorage;
import vn.edu.uit.careerhub.entity.DocumentUpload;
import vn.edu.uit.careerhub.entity.LockedDocument;
import vn.edu.uit.careerhub.entity.SourceDocument;
import vn.edu.uit.careerhub.util.JsonSupport;

@Repository
public class StudentDocumentRepository {
    private final JdbcClient database;
    private final JsonSupport json;

    public StudentDocumentRepository(JdbcClient database, JsonSupport json) {
        this.database = database;
        this.json = json;
    }

    public List<Map<String,Object>> studentDocuments(UUID studentId){return database.sql("""
      SELECT (jsonb_build_object('id',id,'documentType',document_type,'fileName',file_name,'mimeType',mime_type,
        'fileSizeBytes',file_size_bytes,'version',version,'isDefault',is_default,'verificationStatus',verification_status,
        'createdAt',created_at))::text FROM student_documents WHERE student_profile_id=:id
      ORDER BY document_type,is_default DESC,created_at DESC
      """).param("id",studentId).query(String.class).list().stream().map(json::object).toList();}

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

    public void createUpload(UUID id, UUID studentId, DocumentUploadRequest input, String key, Instant expires) {
        database.sql("""
          INSERT INTO student_document_uploads(id,student_profile_id,document_type,file_name,mime_type,file_size_bytes,storage_key,expires_at)
          VALUES(:id,:studentId,:type,:fileName,:mimeType,:size,:key,:expires)
          """).param("id",id).param("studentId",studentId).param("type",input.documentType().name())
                .param("fileName",input.fileName().strip()).param("mimeType",input.mimeType()).param("size",input.fileSizeBytes())
                .param("key",key).param("expires",OffsetDateTime.ofInstant(expires,ZoneOffset.UTC)).update();
    }

    public Optional<DocumentUpload> lockUpload(UUID studentId, UUID uploadId) {
        return database.sql("""
      SELECT id,student_profile_id owner_id,NULL::uuid application_id,document_type,file_name,mime_type,file_size_bytes,storage_key,status,expires_at,student_document_id
      FROM student_document_uploads WHERE id=:id AND student_profile_id=:owner FOR UPDATE
      """).param("id",uploadId).param("owner",studentId).query(UploadRowMapper::map).optional();
    }

    public void expireUpload(UUID uploadId) {
        database.sql("UPDATE student_document_uploads SET status='EXPIRED' WHERE id=:id").param("id",uploadId).update();
    }

    public void insertDocument(UUID documentId, UUID studentId, DocumentUpload upload) {
        database.sql("""
          INSERT INTO student_documents(id,student_profile_id,document_type,file_name,mime_type,file_size_bytes,storage_key,verification_status)
          VALUES(:id,:studentId,:type,:fileName,:mimeType,:size,:key,'PENDING')
          """).param("id",documentId).param("studentId",studentId).param("type",upload.documentType())
                .param("fileName",upload.fileName()).param("mimeType",upload.mimeType()).param("size",upload.size()).param("key",upload.storageKey()).update();
    }

    public void completeUpload(UUID uploadId, UUID documentId) {
        database.sql("UPDATE student_document_uploads SET status='COMPLETED',student_document_id=:documentId,completed_at=now() WHERE id=:id")
                .param("documentId",documentId).param("id",uploadId).update();
    }

    public void delete(UUID documentId, UUID studentId) {
        database.sql("DELETE FROM student_document_uploads WHERE student_document_id=:id").param("id",documentId).update();
        database.sql("DELETE FROM student_documents WHERE id=:id AND student_profile_id=:studentId").param("id",documentId).param("studentId",studentId).update();
    }

    public void makeDefaultCv(UUID documentId, UUID studentId) {
        database.sql("UPDATE student_documents SET is_default=false WHERE student_profile_id=:studentId AND document_type='CV' AND is_default")
                .param("studentId",studentId).update();
        database.sql("UPDATE student_documents SET is_default=true WHERE id=:id").param("id",documentId).update();
    }

    public void updateVerificationStatus(UUID documentId, String status) {
        database.sql("UPDATE student_documents SET verification_status=:status WHERE id=:id").param("status",status).param("id",documentId).update();
    }
}
