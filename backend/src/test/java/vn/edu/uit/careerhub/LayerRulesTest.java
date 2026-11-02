package vn.edu.uit.careerhub;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.junit.jupiter.api.Test;

/** Keeps dependencies pointing inward. Scans sources so that it needs no extra library. */
class LayerRulesTest {
    private static final Path ROOT = Path.of("src/main/java/vn/edu/uit/careerhub");

    @Test void controllersGoThroughServices() throws IOException {
        assertNoMatch("controller", "import vn\\.edu\\.uit\\.careerhub\\.repository\\.|JdbcClient");
    }

    @Test void servicesDoNotDependOnWebOrSql() throws IOException {
        assertNoMatch("service", "import org\\.springframework\\.(http|web|jdbc)\\.|import jakarta\\.servlet|import org\\.postgresql|\\.sql\\(");
    }

    @Test void innerLayersStayFrameworkFree() throws IOException {
        String forbidden = "import (org\\.springframework|jakarta\\.servlet)";
        assertNoMatch("entity", forbidden + "|import vn\\.edu\\.uit\\.careerhub\\.dto");
        assertNoMatch("enums", forbidden);
        assertNoMatch("exception", forbidden);
        assertNoMatch("dto/RequestMetadata.java", forbidden);
    }

    private void assertNoMatch(String location, String regex) throws IOException {
        Pattern pattern = Pattern.compile(regex);
        try (Stream<Path> files = Files.walk(ROOT.resolve(location))) {
            List<Path> offenders = files.filter(path -> path.toString().endsWith(".java"))
                    .filter(path -> matches(path, pattern)).toList();
            assertThat(offenders).as("%s must not match %s", location, regex).isEmpty();
        }
    }

    private boolean matches(Path file, Pattern pattern) {
        try {
            return pattern.matcher(Files.readString(file)).find();
        } catch (IOException error) {
            throw new IllegalStateException(error);
        }
    }
}
