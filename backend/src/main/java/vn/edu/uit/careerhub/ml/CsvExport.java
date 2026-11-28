package vn.edu.uit.careerhub.ml;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Writes training rows in the CSV layout ml/train_*.py --data reads (header, then numbers). */
public final class CsvExport {
    private CsvExport() {}

    public static void write(Path file, List<String> header, List<double[]> rows) {
        List<String> lines = new ArrayList<>();
        lines.add(String.join(",", header));
        for (double[] row : rows) {
            StringBuilder line = new StringBuilder();
            for (int i = 0; i < row.length; i++) {
                if (i > 0) line.append(',');
                line.append(String.format(Locale.ROOT, "%.10g", row[i]));
            }
            lines.add(line.toString());
        }
        try {
            Files.createDirectories(file.toAbsolutePath().getParent());
            Files.write(file, lines, StandardCharsets.UTF_8);
        } catch (IOException error) {
            throw new UncheckedIOException(error);
        }
    }
}
