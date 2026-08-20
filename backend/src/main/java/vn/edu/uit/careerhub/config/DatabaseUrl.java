package vn.edu.uit.careerhub.config;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

public record DatabaseUrl(String jdbcUrl, String username, String password, boolean local, boolean neonPooler) {
    public static DatabaseUrl parse(String value) {
        if (value == null || value.isBlank()) throw new IllegalArgumentException("Thiếu DATABASE_URL.");
        String normalized = value.startsWith("jdbc:") ? value.substring(5) : value;
        URI uri = URI.create(normalized);
        if (!"postgresql".equals(uri.getScheme()) && !"postgres".equals(uri.getScheme())) {
            throw new IllegalArgumentException("DATABASE_URL phải dùng postgresql:// hoặc postgres://.");
        }
        String host = uri.getHost();
        if (host == null) throw new IllegalArgumentException("DATABASE_URL không có hostname hợp lệ.");
        String user = null;
        String password = null;
        if (uri.getRawUserInfo() != null) {
            String[] credentials = uri.getRawUserInfo().split(":", 2);
            user = decode(credentials[0]);
            password = credentials.length == 2 ? decode(credentials[1]) : null;
        }
        int port = uri.getPort() < 0 ? 5432 : uri.getPort();
        StringBuilder jdbc = new StringBuilder("jdbc:postgresql://")
                .append(host).append(':').append(port).append(uri.getRawPath());
        if (uri.getRawQuery() != null && !uri.getRawQuery().isBlank()) jdbc.append('?').append(uri.getRawQuery());
        boolean local = host.equals("localhost") || host.equals("127.0.0.1") || host.equals("::1");
        return new DatabaseUrl(jdbc.toString(), user, password, local,
                host.endsWith(".neon.tech") && host.contains("-pooler"));
    }

    private static String decode(String value) {
        return URLDecoder.decode(value.replace("+", "%2B"), StandardCharsets.UTF_8);
    }
}
