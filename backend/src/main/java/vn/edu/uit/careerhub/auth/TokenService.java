package vn.edu.uit.careerhub.auth;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.ParseException;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.HexFormat;
import java.util.UUID;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import vn.edu.uit.careerhub.common.AppException;
import vn.edu.uit.careerhub.config.AppProperties;

@Service
public class TokenService {
    private final AppProperties.Security configuration;
    private final byte[] secret;
    private final SecureRandom random = new SecureRandom();

    public TokenService(AppProperties properties) {
        this.configuration = properties.security();
        this.secret = configuration.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < 32) throw new IllegalStateException("JWT_ACCESS_SECRET phải có ít nhất 32 ký tự.");
    }

    public AccessToken signAccessToken(AuthUser user) {
        try {
            Instant now = Instant.now();
            UUID tokenId = UUID.randomUUID();
            JWTClaimsSet.Builder claims = new JWTClaimsSet.Builder()
                    .subject(user.id().toString())
                    .jwtID(tokenId.toString())
                    .issuer(configuration.jwtIssuer())
                    .audience(configuration.jwtAudience())
                    .issueTime(Date.from(now))
                    .expirationTime(Date.from(now.plusSeconds(configuration.accessTokenTtlSeconds())))
                    .claim("role", user.role().name())
                    .claim("email", user.email());
            if (user.studentProfileId() != null) claims.claim("studentProfileId", user.studentProfileId().toString());
            if (user.companyId() != null) claims.claim("companyId", user.companyId().toString());
            SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.HS256).type(com.nimbusds.jose.JOSEObjectType.JWT).build(), claims.build());
            jwt.sign(new MACSigner(secret));
            return new AccessToken(jwt.serialize(), tokenId, configuration.accessTokenTtlSeconds());
        } catch (JOSEException error) {
            throw new IllegalStateException("Không thể ký access token.", error);
        }
    }

    public AuthPrincipal verifyAccessToken(String value) {
        try {
            SignedJWT jwt = SignedJWT.parse(value);
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            boolean valid = jwt.verify(new MACVerifier(secret))
                    && configuration.jwtIssuer().equals(claims.getIssuer())
                    && claims.getAudience().contains(configuration.jwtAudience())
                    && claims.getExpirationTime() != null
                    && claims.getExpirationTime().toInstant().isAfter(Instant.now());
            if (!valid) throw invalidAccessToken();
            UserRole role = UserRole.valueOf(claims.getStringClaim("role"));
            return new AuthPrincipal(
                    UUID.fromString(claims.getSubject()),
                    claims.getStringClaim("email"),
                    role,
                    UUID.fromString(claims.getJWTID()),
                    optionalUuid(claims.getStringClaim("studentProfileId")),
                    optionalUuid(claims.getStringClaim("companyId")));
        } catch (ParseException | JOSEException | IllegalArgumentException error) {
            throw invalidAccessToken();
        }
    }

    public String createRefreshToken() {
        byte[] bytes = new byte[48];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public String hashOpaqueToken(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception error) {
            throw new IllegalStateException(error);
        }
    }

    private UUID optionalUuid(String value) { return value == null ? null : UUID.fromString(value); }

    private AppException invalidAccessToken() {
        return new AppException(HttpStatus.UNAUTHORIZED, "AUTH_INVALID_ACCESS_TOKEN",
                "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.");
    }

    public record AccessToken(String accessToken, UUID tokenId, long expiresIn) {}
}
