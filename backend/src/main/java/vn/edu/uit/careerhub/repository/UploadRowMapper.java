package vn.edu.uit.careerhub.repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.UUID;

import vn.edu.uit.careerhub.entity.DocumentUpload;

final class UploadRowMapper {
    private UploadRowMapper() {}

    static DocumentUpload map(ResultSet r, int rowNumber) throws SQLException {
        return new DocumentUpload(r.getObject("id", UUID.class), r.getObject("owner_id", UUID.class),
                r.getObject("application_id", UUID.class), r.getString("document_type"), r.getString("file_name"),
                r.getString("mime_type"), r.getLong("file_size_bytes"), r.getString("storage_key"), r.getString("status"),
                r.getTimestamp("expires_at").toInstant(), r.getObject("student_document_id", UUID.class));
    }
}
