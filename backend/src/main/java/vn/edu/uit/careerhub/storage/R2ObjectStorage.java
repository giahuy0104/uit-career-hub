package vn.edu.uit.careerhub.storage;

import java.net.URI;
import java.time.Duration;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;
import vn.edu.uit.careerhub.config.AppProperties;

@Component
@ConditionalOnProperty(prefix = "app.storage", name = "enabled", havingValue = "true")
public class R2ObjectStorage implements ObjectStorage, AutoCloseable {
    private final String bucket;
    private final S3Client client;
    private final S3Presigner presigner;

    public R2ObjectStorage(AppProperties properties) {
        var config = properties.storage();
        var credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(config.accessKeyId(), config.secretAccessKey()));
        URI endpoint = URI.create("https://" + config.accountId() + ".r2.cloudflarestorage.com");
        this.bucket = config.bucket();
        this.client = S3Client.builder().region(Region.of("auto")).endpointOverride(endpoint)
                .credentialsProvider(credentials).build();
        this.presigner = S3Presigner.builder().region(Region.of("auto")).endpointOverride(endpoint)
                .credentialsProvider(credentials).build();
    }

    @Override
    public String createUploadUrl(String key, String contentType, long expiresInSeconds) {
        var request = PutObjectRequest.builder().bucket(bucket).key(key).contentType(contentType).build();
        return presigner.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(expiresInSeconds)).putObjectRequest(request).build())
                .url().toString();
    }

    @Override
    public String createDownloadUrl(String key, String fileName, long expiresInSeconds) {
        String safeName = fileName.replaceAll("[\\r\\n\"\\\\]", "_");
        if (safeName.length() > 180) safeName = safeName.substring(0, 180);
        var request = GetObjectRequest.builder().bucket(bucket).key(key)
                .responseContentDisposition("attachment; filename=\"" + safeName + "\"").build();
        return presigner.presignGetObject(GetObjectPresignRequest.builder()
                .signatureDuration(Duration.ofSeconds(expiresInSeconds)).getObjectRequest(request).build())
                .url().toString();
    }

    @Override
    public Metadata headObject(String key) {
        try {
            var response = client.headObject(HeadObjectRequest.builder().bucket(bucket).key(key).build());
            String etag = response.eTag() == null ? null : response.eTag().replace("\"", "");
            return new Metadata(response.contentLength(), response.contentType(), etag);
        } catch (NoSuchKeyException error) {
            return null;
        } catch (S3Exception error) {
            if (error.statusCode() == 404) return null;
            throw error;
        }
    }

    @Override
    public byte[] readObjectPrefix(String key, int byteCount) {
        int lastByte = Math.max(0, byteCount - 1);
        ResponseBytes<GetObjectResponse> response = client.getObject(
                GetObjectRequest.builder().bucket(bucket).key(key).range("bytes=0-" + lastByte).build(),
                ResponseTransformer.toBytes());
        return response.asByteArray();
    }

    @Override
    public void deleteObject(String key) {
        client.deleteObject(DeleteObjectRequest.builder().bucket(bucket).key(key).build());
    }

    @Override
    public void close() {
        presigner.close();
        client.close();
    }
}
