package vn.edu.uit.careerhub.config;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** Loads the monorepo root .env before Spring creates its Environment. */
public final class DotenvBootstrap {
    private DotenvBootstrap() {}

    public static void load() {
        Path workingDirectory = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        List<Path> candidates = List.of(workingDirectory.resolve(".env"), workingDirectory.resolve("../.env").normalize());
        for (Path candidate : candidates) {
            if (Files.isRegularFile(candidate)) {
                read(candidate);
                return;
            }
        }
    }

    private static void read(Path path) {
        try {
            for (String rawLine : Files.readAllLines(path, StandardCharsets.UTF_8)) {
                String line = rawLine.strip();
                if (line.isEmpty() || line.startsWith("#")) continue;
                if (line.startsWith("export ")) line = line.substring(7).strip();
                int separator = line.indexOf('=');
                if (separator <= 0) continue;
                String key = line.substring(0, separator).strip();
                String value = line.substring(separator + 1).strip();
                if (value.length() >= 2 && ((value.startsWith("\"") && value.endsWith("\""))
                        || (value.startsWith("'") && value.endsWith("'")))) {
                    value = value.substring(1, value.length() - 1);
                }
                if (System.getenv(key) == null && System.getProperty(key) == null) {
                    System.setProperty(key, value);
                }
            }
        } catch (IOException error) {
            throw new IllegalStateException("Không thể đọc file môi trường " + path, error);
        }
    }
}
