package vn.edu.uit.careerhub.service;

import java.util.Collection;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Removes personal data before text leaves the system for the AI provider (thesis outline,
 * section 6: hide name, student ID, email and phone number).
 */
public final class PiiMasker {
    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    /** Vietnamese phone numbers: 0xxxxxxxxx or +84xxxxxxxxx, optional spaces, dots or dashes. */
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+?84|0)(?:[\\s.-]?\\d){8,10}(?!\\d)");
    /** UIT student IDs are 8 digits, e.g. 25410230. */
    private static final Pattern STUDENT_CODE = Pattern.compile("(?<!\\d)\\d{8}(?!\\d)");

    private PiiMasker() {}

    /**
     * @param text  free text written by a user
     * @param known personal values known for this record (student name, code, supervisor...)
     */
    public static String mask(String text, Collection<String> known) {
        if (text == null || text.isBlank()) return "";
        String result = text;
        for (String value : known) {
            if (value == null || value.strip().length() < 2) continue;
            // Whole words only, so a supervisor called "Minh" does not hide "minh chứng".
            result = Pattern.compile("(?<![\\p{L}\\p{N}])" + Pattern.quote(value.strip()) + "(?![\\p{L}\\p{M}\\p{N}])",
                            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                    .matcher(result).replaceAll(Matcher.quoteReplacement("[đã ẩn]"));
        }
        result = EMAIL.matcher(result).replaceAll("[email]");
        result = PHONE.matcher(result).replaceAll("[số điện thoại]");
        result = STUDENT_CODE.matcher(result).replaceAll("[mã số]");
        return result.strip();
    }
}
