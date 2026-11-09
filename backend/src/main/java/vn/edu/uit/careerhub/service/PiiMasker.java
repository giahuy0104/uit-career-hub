package vn.edu.uit.careerhub.service;

import java.text.Normalizer;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Removes personal data before text leaves the system for the AI provider (thesis outline,
 * section 6: hide name, student ID, email and phone number).
 *
 * <p>Two layers: values known for the record (student, supervisor...) are always masked, and
 * names that are not known in advance — a colleague mentioned in a weekly log, a contact in a job
 * description — are caught by heuristics for how Vietnamese text names people:
 * <ul>
 *   <li>a form of address or role followed by a capitalised name: "anh Tuấn", "chị NGỌC LAN",
 *       "Mentor: Đức", "PM Hùng";</li>
 *   <li>a common family name followed by capitalised words: "Nguyễn Văn An", "LÊ THỊ MAI".</li>
 * </ul>
 * Stop lists keep ordinary Title Case text such as "Quản Lý Nhân Sự", "Đào Tạo" or "Bạn Sẽ Làm Gì"
 * readable, so the model still sees what the job asks for.
 *
 * <p>Known limit: a name written in lower case ("anh tuấn") or alone without a form of address or
 * family name ("Tuấn review code") cannot be told apart from ordinary words and is not masked.
 */
public final class PiiMasker {
    static final String KNOWN_LABEL = "[đã ẩn]";
    static final String NAME_LABEL = "[tên người]";

    private static final Pattern EMAIL = Pattern.compile("[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}");
    /** Vietnamese phone numbers: 0xxxxxxxxx or +84xxxxxxxxx, optional spaces, dots or dashes. */
    private static final Pattern PHONE = Pattern.compile("(?<!\\d)(?:\\+?84|0)(?:[\\s.-]?\\d){8,10}(?!\\d)");
    /** UIT student IDs are 8 digits, e.g. 25410230. */
    private static final Pattern STUDENT_CODE = Pattern.compile("(?<!\\d)\\d{8}(?!\\d)");

    /** One word of a name, "Tuấn" or "TUẤN". Case-sensitive on purpose, so "JavaScript" is not a name. */
    private static final String NAME_WORD = "\\p{Lu}(?:[\\p{Ll}\\p{M}]*|[\\p{Lu}\\p{M}]+)";
    private static final String NAME = NAME_WORD + "(?:[ \\t]+" + NAME_WORD + "){0,3}";
    private static final String NOT_LETTER_BEFORE = "(?<![\\p{L}\\p{M}\\p{N}])";
    private static final String NOT_LETTER_AFTER = "(?![\\p{L}\\p{M}\\p{N}])";
    /**
     * Between a form of address and the name: spaces or a colon ("Mentor:Đức"). Not a line break:
     * every line starts with a capital, so "cảm ơn anh⏎Tuần sau..." would hide "Tuần".
     */
    private static final String ADDRESS_SEPARATOR = "(?:[ \\t]*:[ \\t]*|[ \\t]+)";

    /**
     * Forms of address and roles; only these are case-insensitive, the name after them must be capitalised.
     * "TS." needs its dot (plain "TS" is TypeScript), and "3 PM" is a time, not a project manager.
     */
    private static final Pattern ADDRESSED_NAME = Pattern.compile(NOT_LETTER_BEFORE + "(?<![0-9][ \\t]?)"
            + "((?iu:anh|chị|em|bạn|thầy|cô|chú|bác|ông|bà|cậu|dì|mentor|leader|lead|sếp|pm|trưởng nhóm|trưởng phòng"
            + "|giám đốc|mrs\\.?|mr\\.?|ms\\.?|dr\\.?|ths\\.?|ts\\.|pgs\\.?))"
            + ADDRESS_SEPARATOR + "(" + NAME + ")" + NOT_LETTER_AFTER);

    /** The most common Vietnamese family names, Title Case or upper case; ambiguous ones such as Hà or Mai are left out. */
    private static final Pattern FAMILY_NAME = Pattern.compile(NOT_LETTER_BEFORE + "(?=\\p{Lu})"
            + "(?iu:Nguyễn|Trần|Lê|Phạm|Hoàng|Huỳnh|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Đinh|Trương|Đoàn|Trịnh"
            + "|Lương|Tạ|Lưu|Quách|Vương|Kiều|Đào|Triệu|Phùng|Lại)"
            + "(?:[ \\t]+" + NAME_WORD + "){1,3}" + NOT_LETTER_AFTER);

    /**
     * Words that, right after a form of address or role, mean ordinary text: "Bạn Sẽ Làm Gì",
     * "Anh Chị Em", "Bà Rịa", and job titles such as "Tech Lead Java" or "PM Dự Án".
     */
    private static final Set<String> NOT_A_NAME_AFTER_ADDRESS = Set.of(
            "sẽ", "có", "là", "được", "cần", "muốn", "đã", "đang", "và", "của", "với", "trong", "cũng", "không",
            "chưa", "nên", "phải", "hãy", "thì", "các", "những", "mình", "tôi", "làm", "nhận", "học", "tham",
            "hiểu", "biết", "đọc", "viết", "gửi", "sử", "yêu", "thích", "anh", "chị", "em", "bạn", "rịa", "chiểu", "điểm",
            "dự", "sản", "kỹ", "kinh", "phát", "thiết", "kiểm",
            "java", "backend", "frontend", "fullstack", "full", "react", "node", "python", "golang", "net",
            "mobile", "android", "ios", "devops", "qa", "qc", "tester", "test", "data", "ai", "ml", "web", "app",
            "team", "tech", "technical", "sprint", "project", "product", "engineering", "software", "developer",
            "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday");

    /** Words that, right after a family name, make an ordinary compound: "Hồ Sơ", "Đào Tạo", "Lương Thưởng". */
    private static final Set<String> NOT_A_NAME_AFTER_FAMILY = Set.of(
            "sơ", "tạo", "trữ", "lượng", "thưởng", "bổng", "tháng", "cứng", "thuyết", "do", "tưởng", "lịch",
            "luận", "giải", "thuật", "bơi", "chứa", "tính", "xe", "sâu");

    /** Words that, right before a family name, make an ordinary compound: "Quản Lý", "Mức Lương", "Đồng Hồ". */
    private static final Set<String> NOT_A_NAME_BEFORE_FAMILY = Set.of(
            "quản", "xử", "đại", "hợp", "tâm", "vật", "địa", "nguyên", "pháp", "trợ", "sinh",
            "tiền", "mức", "bảng", "quỹ", "đồng", "giao", "bảo", "âm");

    /** Places and organisations that start like a family name followed by a given name. */
    private static final List<String> ORDINARY_PHRASES = List.of(
            "hồ chí minh", "phan thiết", "phan rang", "hoàng sa", "đoàn thanh niên");

    private static final Pattern WORD = Pattern.compile("[\\p{L}\\p{M}]+");
    private static final Pattern LAST_WORD_ON_LINE = Pattern.compile("([\\p{L}\\p{M}]+)[ \\t]+$");

    private PiiMasker() {}

    /**
     * @param text  free text written by a user
     * @param known personal values known for this record (student name, code, supervisor...)
     */
    public static String mask(String text, Collection<String> known) {
        if (text == null || text.isBlank()) return "";
        // Vietnamese can arrive precomposed or with combining marks; compare in one form.
        String result = Normalizer.normalize(text, Normalizer.Form.NFC);
        for (String value : known) {
            if (value == null || value.strip().length() < 2) continue;
            String needle = Normalizer.normalize(value.strip(), Normalizer.Form.NFC);
            // Whole words only, so a supervisor called "Minh" does not hide "minh chứng".
            result = Pattern.compile(NOT_LETTER_BEFORE + Pattern.quote(needle) + NOT_LETTER_AFTER,
                            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE)
                    .matcher(result).replaceAll(Matcher.quoteReplacement(KNOWN_LABEL));
        }
        result = EMAIL.matcher(result).replaceAll("[email]");
        result = PHONE.matcher(result).replaceAll("[số điện thoại]");
        result = STUDENT_CODE.matcher(result).replaceAll("[mã số]");
        result = maskAddressedNames(result);
        result = maskFamilyNames(result);
        return result.strip();
    }

    private static String maskAddressedNames(String text) {
        Matcher matcher = ADDRESSED_NAME.matcher(text);
        StringBuilder out = new StringBuilder();
        int copied = 0;
        int from = 0;
        while (from < text.length() && matcher.find(from)) {
            if (NOT_A_NAME_AFTER_ADDRESS.contains(firstWord(matcher.group(2)))) {
                // Ordinary text; look again right after the form of address, so "Anh Chị Lan" still hides "Lan".
                from = matcher.end(1);
                continue;
            }
            out.append(text, copied, matcher.start()).append(matcher.group(1)).append(' ').append(NAME_LABEL);
            copied = from = matcher.end();
        }
        return out.append(text, copied, text.length()).toString();
    }

    private static String maskFamilyNames(String text) {
        Matcher matcher = FAMILY_NAME.matcher(text);
        StringBuilder out = new StringBuilder();
        int copied = 0;
        int from = 0;
        while (from < text.length() && matcher.find(from)) {
            String match = matcher.group();
            Matcher words = WORD.matcher(match);
            words.find();
            int familyEnd = matcher.start() + words.end();
            words.find();
            String afterFamily = lower(words.group());
            Matcher before = LAST_WORD_ON_LINE.matcher(text.substring(Math.max(0, matcher.start() - 40), matcher.start()));
            String beforeFamily = before.find() ? lower(before.group(1)) : "";
            String lowered = lower(match);
            if (ORDINARY_PHRASES.stream().anyMatch(lowered::startsWith)) {
                from = matcher.end();
                continue;
            }
            if (NOT_A_NAME_AFTER_FAMILY.contains(afterFamily) || NOT_A_NAME_BEFORE_FAMILY.contains(beforeFamily)) {
                // Ordinary compound; look again after the first word, so "Hồ Sơ Nguyễn Văn An" still hides the name.
                from = familyEnd;
                continue;
            }
            out.append(text, copied, matcher.start()).append(NAME_LABEL);
            copied = from = matcher.end();
        }
        return out.append(text, copied, text.length()).toString();
    }

    private static String firstWord(String value) {
        Matcher word = WORD.matcher(value);
        return word.find() ? lower(word.group()) : "";
    }

    private static String lower(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[ \\t]+", " ");
    }
}
