package vn.edu.uit.careerhub.storage;

public interface ObjectStorage {
    record Metadata(long contentLength, String contentType, String etag) {}

    String createUploadUrl(String key, String contentType, long expiresInSeconds);
    String createDownloadUrl(String key, String fileName, long expiresInSeconds);
    Metadata headObject(String key);
    byte[] readObjectPrefix(String key, int byteCount);
    void deleteObject(String key);
}
