package vn.edu.uit.careerhub.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.regex.Pattern;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import vn.edu.uit.careerhub.ai.AiClient;
import vn.edu.uit.careerhub.ai.AiCompletion;
import vn.edu.uit.careerhub.ai.AiPrompt;
import vn.edu.uit.careerhub.database.DatabaseTasks;
import vn.edu.uit.careerhub.entity.AiWeeklyLogEntry;
import vn.edu.uit.careerhub.repository.AiRepository;
import vn.edu.uit.careerhub.repository.InternshipPlanRepository;
import vn.edu.uit.careerhub.storage.ObjectStorage;

/**
 * Runs the main business flows against a real PostgreSQL database.
 *
 * <p>Each test resets the fixed demo records ({@code db:demo:reset}), so it only runs when
 * {@code DATABASE_URL_TEST} points to a dedicated database: the host must be loopback and the
 * database name must contain a {@code test} or {@code ci} segment (e.g. {@code uit_career_hub_test}).
 * Without {@code DATABASE_URL_TEST} the class is skipped. It never reads {@code DATABASE_URL}.
 */
@SpringBootTest
@AutoConfigureMockMvc
@EnabledIfEnvironmentVariable(named = "DATABASE_URL_TEST", matches = ".+")
class RealDatabaseIntegrationTest {
    private static final Set<String> LOOPBACK_HOSTS = Set.of("localhost", "127.0.0.1", "::1", "[::1]");
    private static final Pattern TEST_DATABASE_NAME = Pattern.compile("(^|.*[_-])(test|ci)([_-].*|$)");
    private static final String CRON_SECRET = "integration-test-cron-secret";

    // Passwords set by database/seeds/development.sql (development only).
    private static final String ADMIN = "admin.career@uit.edu.vn";
    private static final String ADMIN_PASSWORD = "Admin@12345";
    private static final String VNG = "recruiter@vng.example";
    private static final String FPT = "recruiter@fpt.example";
    private static final String COMPANY_PASSWORD = "Company@12345";
    private static final String STUDENT_PASSWORD = "Student@12345";
    private static final String NEW_RECRUITER_PASSWORD = "Password!123";
    /** Seed application of student 21520881 for the VNG job, status INTERVIEW_INVITED. */
    private static final String SEED_INTERVIEW_APPLICATION = "00000000-0000-4000-8000-000000008004";

    private static boolean migrated;

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired JdbcClient db;
    @Autowired DatabaseTasks tasks;
    @Autowired PasswordEncoder encoder;
    @Autowired AiRepository aiRepository;
    @MockitoBean ObjectStorage storage;
    /** Stands in for Gemini: the AI SQL and endpoints run for real, no request leaves the machine. */
    @MockitoBean AiClient aiClient;
    @MockitoSpyBean InternshipPlanRepository planRepository;

    @DynamicPropertySource
    static void useDedicatedTestDatabase(DynamicPropertyRegistry registry) {
        String url = System.getenv("DATABASE_URL_TEST");
        assertSafeTestDatabase(url);
        registry.add("app.database.url", () -> url);
        registry.add("app.database.direct-url", () -> "");
        registry.add("app.environment", () -> "test");
        registry.add("app.cron-secret", () -> CRON_SECRET);
        registry.add("app.security.trusted-proxy-hops", () -> "0");
        registry.add("app.email.enabled", () -> "false");
        registry.add("app.storage.enabled", () -> "false");
        registry.add("app.ai.api-key", () -> "integration-test-key");
        registry.add("app.ai.daily-limit-per-user", () -> "0");
    }

    static void assertSafeTestDatabase(String url) {
        URI uri = URI.create(url.strip().replaceFirst("^postgres(ql)?://", "http://"));
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        String name = uri.getPath() == null ? "" : uri.getPath().replaceFirst("^/", "").toLowerCase(Locale.ROOT);
        if (!LOOPBACK_HOSTS.contains(host) || !TEST_DATABASE_NAME.matcher(name).matches()) {
            throw new IllegalStateException("DATABASE_URL_TEST phải trỏ tới database riêng trên máy local, tên có đoạn "
                    + "'test' hoặc 'ci' (ví dụ uit_career_hub_test); nhận host='" + host + "', database='" + name
                    + "'. Test này reset dữ liệu demo nên từ chối chạy.");
        }
    }

    @BeforeEach
    void prepare() {
        if (!migrated) {
            tasks.migrate();
            migrated = true;
        }
        tasks.resetDemo();
        when(storage.createUploadUrl(anyString(), anyString(), anyLong())).thenReturn("https://storage.test/upload");
        when(storage.createDownloadUrl(anyString(), anyString(), anyLong())).thenReturn("https://storage.test/download");
        when(storage.headObject(anyString())).thenReturn(new ObjectStorage.Metadata(1000, "application/pdf", "etag-1"));
        when(aiClient.model()).thenReturn("gemini-test");
        when(aiClient.generate(any(AiPrompt.class))).thenAnswer(invocation -> {
            AiPrompt prompt = invocation.getArgument(0);
            String text = prompt.user().contains("<ke_hoach_sinh_vien>")
                    ? "{\"overall\":\"Kế hoạch khá rõ\",\"strengths\":[],\"issues\":[]}"
                    : "{\"overview\":\"Tiến độ ổn\",\"keyPoints\":[\"API\"],\"flags\":[{\"weekNumber\":1,\"type\":\"TOO_SHORT\",\"detail\":\"Ngắn\"}]}";
            return new AiCompletion(text, 50, 10);
        });
        when(storage.readObjectPrefix(anyString(), anyInt())).thenReturn("%PDF-1.7".getBytes(StandardCharsets.US_ASCII));
    }

    private JsonNode call(String method, String path, String token, Object body, int expected, boolean idempotent, String... headers) throws Exception {
        MockHttpServletRequestBuilder request = MockMvcRequestBuilders.request(HttpMethod.valueOf(method), "/api/v1" + path);
        if (token != null) request.header("Authorization", "Bearer " + token);
        if (idempotent) request.header("Idempotency-Key", UUID.randomUUID().toString());
        for (int i = 0; i < headers.length; i += 2) request.header(headers[i], headers[i + 1]);
        if (body != null) request.contentType(MediaType.APPLICATION_JSON).content(mapper.writeValueAsString(body));
        var response = mvc.perform(request).andReturn().getResponse();
        String text = response.getContentAsString(StandardCharsets.UTF_8);
        assertThat(response.getStatus()).as(method + " " + path + " -> " + text).isEqualTo(expected);
        return text.isBlank() || !text.startsWith("{") ? mapper.nullNode() : mapper.readTree(text);
    }

    private String login(String email, String password) throws Exception {
        return call("POST", "/auth/login", null, Map.of("email", email, "password", password), 200, false).at("/data/accessToken").asText();
    }

    private Map<String, Object> jobDraft(String title) {
        Map<String, Object> job = new LinkedHashMap<>();
        job.put("title", title);
        job.put("opportunityType", "INTERNSHIP");
        job.put("workMode", "HYBRID");
        job.put("location", "TP. Hồ Chí Minh");
        job.put("description", "Mô tả công việc đủ dài để vượt qua kiểm tra.");
        job.put("requirements", "Yêu cầu công việc đủ dài.");
        job.put("positions", 2);
        job.put("deadline", LocalDate.now().plusDays(30).toString());
        return job;
    }

    private String recruitingJob(String company, String admin, String title) throws Exception {
        String id = call("POST", "/companies/me/jobs", company, jobDraft(title), 201, false).at("/data/id").asText();
        call("POST", "/companies/me/jobs/" + id + "/submit", company, null, 200, true);
        call("POST", "/uit/jobs/" + id + "/approve", admin, null, 200, true);
        return id;
    }

    private String studentEmail() {
        return db.sql("""
                SELECT u.email FROM users u JOIN student_profiles sp ON sp.user_id=u.id
                WHERE sp.academic_status='ACTIVE' AND u.status='ACTIVE' AND u.email LIKE '%@student.uit.edu.vn'
                AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.student_profile_id=sp.id AND a.status IN ('ACCEPTED_PENDING_UIT_CONFIRMATION','HIRED'))
                ORDER BY u.email LIMIT 1""").query(String.class).single();
    }

    private String verifiedDocument(String student, String admin, String type) throws Exception {
        String upload = call("POST", "/students/me/documents/uploads", student, Map.of("documentType", type, "fileName", type + ".pdf", "mimeType", "application/pdf", "fileSizeBytes", 1000), 201, false).at("/data/uploadId").asText();
        call("POST", "/students/me/documents/uploads/" + upload + "/complete", student, null, 201, false);
        String id = db.sql("SELECT student_document_id FROM student_document_uploads WHERE id=:id").param("id", UUID.fromString(upload)).query(UUID.class).single().toString();
        call("POST", "/uit/student-documents/" + id + "/review", admin, Map.of("decision", "VERIFY"), 200, false);
        return id;
    }

    private String status(String table, String id) {
        return db.sql("SELECT status FROM " + table + " WHERE id=:id").param("id", UUID.fromString(id)).query(String.class).single();
    }

    private String userStatus(UUID userId) {
        return db.sql("SELECT status FROM users WHERE id=:id").param("id", userId).query(String.class).single();
    }

    private long reportExportAudits() {
        return db.sql("SELECT count(*) FROM audit_logs WHERE action='UIT_APPLICATION_REPORT_EXPORTED' AND target_id IS NULL").query(Long.class).single();
    }

    @Test
    void fullLifecycleAgainstRealSql() throws Exception {
        String admin = login(ADMIN, ADMIN_PASSWORD), vng = login(VNG, COMPANY_PASSWORD), fpt = login(FPT, COMPANY_PASSWORD);
        String student = login(studentEmail(), STUDENT_PASSWORD);
        call("GET", "/students/me", student, null, 200, false);
        call("PATCH", "/students/me", student, Map.of("phone", "0901234567"), 200, false);
        call("GET", "/students/me/dashboard", student, null, 200, false);
        call("GET", "/companies/me/dashboard", vng, null, 200, false);
        call("GET", "/uit/dashboard", admin, null, 200, false);
        call("GET", "/jobs", student, null, 200, false);
        call("GET", "/companies", student, null, 200, false);
        call("GET", "/uit/companies", admin, null, 200, false);
        call("GET", "/uit/taxonomy/categories", admin, null, 200, false);

        String jobId = recruitingJob(vng, admin, "Thực tập sinh kiểm thử tích hợp");
        String cv = verifiedDocument(student, admin, "CV");
        call("POST", "/students/me/documents/" + cv + "/default", student, null, 200, false);
        call("POST", "/students/me/documents/" + cv + "/download", student, null, 200, false);

        // Missing documents is a validation error, not a 500.
        Map<String, Object> noDocuments = new LinkedHashMap<>();
        noDocuments.put("jobId", jobId);
        noDocuments.put("consentToShare", true);
        call("POST", "/applications", student, noDocuments, 400, true);

        String app = call("POST", "/applications", student, Map.of("jobId", jobId, "documents", List.of(Map.of("documentId", cv)), "consentToShare", true), 201, true).at("/data/id").asText();
        call("GET", "/applications/" + app, student, null, 200, false);
        call("GET", "/uit/applications/review-queue", admin, null, 200, false);
        Map<String, Object> noTypes = new LinkedHashMap<>();
        noTypes.put("reasonCode", "MISSING");
        noTypes.put("note", "Thiếu bảng điểm");
        noTypes.put("dueAt", OffsetDateTime.now().plusDays(3).toString());
        call("POST", "/uit/applications/" + app + "/request-supplement", admin, noTypes, 400, true);
        call("POST", "/uit/applications/" + app + "/request-supplement", admin, Map.of("reasonCode", "MISSING", "note", "Thiếu bảng điểm", "requiredDocumentTypes", List.of("TRANSCRIPT"), "dueAt", OffsetDateTime.now().plusDays(3).toString()), 200, true);
        String transcript = verifiedDocument(student, admin, "TRANSCRIPT");
        call("POST", "/applications/" + app + "/resubmit", student, Map.of("documents", List.of(Map.of("documentId", transcript)), "consentToShare", true), 200, true);
        call("POST", "/uit/applications/" + app + "/forward", admin, null, 200, true);
        String applicationDocument = call("GET", "/applications/" + app, student, null, 200, false).at("/data/documents/0/id").asText();
        call("POST", "/uit/applications/" + app + "/documents/" + applicationDocument + "/download", admin, null, 200, false);
        call("POST", "/companies/me/applications/" + app + "/documents/" + applicationDocument + "/download", vng, null, 200, false);
        call("POST", "/companies/me/applications/" + app + "/documents/" + applicationDocument + "/download", fpt, null, 404, false);
        call("GET", "/companies/me/candidates", vng, null, 200, false);
        call("POST", "/companies/me/applications/" + app + "/start-review", vng, null, 200, true);
        JsonNode interview = call("POST", "/companies/me/applications/" + app + "/interviews", vng, Map.of("scheduledAt", OffsetDateTime.now().plusDays(2).toString(), "timeZone", "Asia/Ho_Chi_Minh", "mode", "ONSITE", "location", "Quận 7", "interviewerName", "Nguyễn Văn A"), 201, true);
        call("GET", "/companies/me/interviews", vng, null, 200, false);
        call("GET", "/students/me/interviews", student, null, 200, false);
        call("POST", "/students/me/interviews/" + interview.at("/data/id").asText() + "/confirm", student, null, 200, false);

        String offer = call("POST", "/companies/me/applications/" + app + "/offer-document/uploads", vng, Map.of("fileName", "offer.pdf", "mimeType", "application/pdf", "fileSizeBytes", 1000), 201, false).at("/data/uploadId").asText();
        call("POST", "/companies/me/applications/" + app + "/offer-document/uploads/" + offer + "/complete", vng, null, 200, false);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("outcome", "PASS");
        result.put("startDate", LocalDate.now().plusDays(1).toString());
        result.put("offerUploadId", offer);
        call("POST", "/companies/me/applications/" + app + "/results", vng, result, 200, true);

        // Each role sees its own offer document; another company does not.
        call("POST", "/applications/" + app + "/offer-document/download", student, null, 200, false);
        call("POST", "/uit/applications/" + app + "/offer-document/download", admin, null, 200, false);
        call("POST", "/companies/me/applications/" + app + "/offer-document/download", vng, null, 200, false);
        call("POST", "/companies/me/applications/" + app + "/offer-document/download", fpt, null, 404, false);

        call("POST", "/applications/" + app + "/offer/accept", student, null, 200, true);
        call("GET", "/uit/applications/placement-queue", admin, null, 200, false);
        call("POST", "/uit/applications/" + app + "/confirm-placement", admin, Map.of("startDate", LocalDate.now().toString(), "note", "Xác nhận"), 200, true);

        String placement = db.sql("SELECT id FROM internship_placements WHERE application_id=:id").param("id", UUID.fromString(app)).query(UUID.class).single().toString();
        call("GET", "/uit/placements", admin, null, 200, false);
        call("POST", "/uit/placements/" + placement + "/start", admin, Map.of("expectedVersion", 1, "effectiveDate", LocalDate.now().toString(), "note", "Bắt đầu kỳ thực tập"), 200, true);

        // A failure after the state change must roll the whole plan review back.
        Map<String, Object> plan = new LinkedHashMap<>();
        plan.put("title", "Kế hoạch thực tập");
        plan.put("department", "Kỹ thuật");
        plan.put("companySupervisorName", "Nguyễn Văn B");
        plan.put("companySupervisorEmail", "mentor@vng.example");
        plan.put("objectives", "Mục tiêu học tập rõ ràng.");
        plan.put("expectedTasks", "Các công việc dự kiến.");
        plan.put("expectedSkills", "Java, Spring.");
        plan.put("startDate", LocalDate.now().toString());
        plan.put("endDate", LocalDate.now().plusMonths(2).toString());
        int version = call("PUT", "/student/internships/" + placement + "/plan", student, plan, 200, false).at("/data/plan/version").asInt();
        aiAgainstRealSql(placement, student, vng, admin, plan, version);
        version = call("POST", "/student/internships/" + placement + "/plan/submit", student, Map.of("expectedVersion", version), 200, true).at("/data/plan/version").asInt();
        UUID placementId = UUID.fromString(placement);
        doThrow(new IllegalStateException("boom after transition")).when(planRepository).find(eq(placementId));
        Map<String, Object> review = new LinkedHashMap<>();
        review.put("expectedVersion", version);
        call("POST", "/company/internships/" + placement + "/plan/confirm", vng, review, 500, true);
        reset(planRepository);
        String planStatus = db.sql("SELECT status FROM internship_plans WHERE placement_id=:id").param("id", placementId).query(String.class).single();
        long historyAfterFailure = db.sql("SELECT count(*) FROM internship_plan_history h JOIN internship_plans p ON p.id=h.plan_id WHERE p.placement_id=:id AND h.action='COMPANY_CONFIRM'").param("id", placementId).query(Long.class).single();
        assertThat(planStatus).as("review must roll back").isEqualTo("PENDING_COMPANY_REVIEW");
        assertThat(historyAfterFailure).isZero();

        version = call("POST", "/company/internships/" + placement + "/plan/confirm", vng, review, 200, true).at("/data/plan/version").asInt();
        call("POST", "/uit/internship-supervision/" + placement + "/plan/approve", admin, Map.of("expectedVersion", version), 200, true);

        Map<String, Object> log = new LinkedHashMap<>();
        log.put("weekNumber", 1);
        log.put("workSummary", "Tóm tắt công việc.");
        log.put("outcomes", "Kết quả.");
        log.put("difficulties", "Khó khăn.");
        log.put("nextPlan", "Kế hoạch.");
        call("POST", "/student/internships/" + placement + "/weekly-logs", student, log, 200, false);
        String logId = db.sql("SELECT id FROM internship_weekly_logs WHERE placement_id=:id").param("id", placementId).query(UUID.class).single().toString();
        int logVersion = db.sql("SELECT version FROM internship_weekly_logs WHERE id=:id").param("id", UUID.fromString(logId)).query(Integer.class).single();
        call("POST", "/student/internships/" + placement + "/weekly-logs/" + logId + "/submit", student, Map.of("expectedVersion", logVersion), 200, true);
        logVersion = db.sql("SELECT version FROM internship_weekly_logs WHERE id=:id").param("id", UUID.fromString(logId)).query(Integer.class).single();
        call("POST", "/company/internships/" + placement + "/weekly-logs/" + logId + "/confirm", vng, Map.of("expectedVersion", logVersion), 200, true);
        aiLogSummaryAgainstRealSql(placement, student, vng, admin);
        call("GET", "/uit/internship-supervision/summary", admin, null, 200, false);
        call("GET", "/uit/internship-supervision/overdue", admin, null, 200, false);

        // Report exports are audited without a target id.
        long auditsBefore = reportExportAudits();
        call("GET", "/uit/reports/applications", admin, null, 200, false);
        call("POST", "/uit/reports/applications/exports", admin, Map.of("format", "CSV"), 200, false);
        call("POST", "/uit/reports/applications/exports", admin, Map.of("format", "XLSX"), 200, false);
        assertThat(reportExportAudits() - auditsBefore).isEqualTo(2);

        // The cron endpoint accepts only its shared secret.
        var cron = mvc.perform(MockMvcRequestBuilders.get("/api/v1/cron/daily-pending-notifications").header("Authorization", "Bearer " + CRON_SECRET)).andReturn().getResponse();
        assertThat(cron.getStatus()).as(cron.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(200);
        var wrongCron = mvc.perform(MockMvcRequestBuilders.get("/api/v1/cron/daily-pending-notifications").header("Authorization", "Bearer wrong-secret")).andReturn().getResponse();
        assertThat(wrongCron.getStatus()).isEqualTo(401);
        assertThat(wrongCron.getContentAsString(StandardCharsets.UTF_8)).contains("CRON_UNAUTHORIZED");
        var missingCron = mvc.perform(MockMvcRequestBuilders.get("/api/v1/cron/daily-pending-notifications")).andReturn().getResponse();
        assertThat(missingCron.getStatus()).isEqualTo(401);
        assertThat(mvc.perform(MockMvcRequestBuilders.get("/api/health/database")).andReturn().getResponse().getStatus()).isEqualTo(200);
    }

    /** AI1 on the draft plan: answer is cached, the plan row is untouched, the call is logged without content. */
    private void aiAgainstRealSql(String placement, String student, String vng, String admin, Map<String, Object> plan, int planVersion) throws Exception {
        UUID placementId = UUID.fromString(placement);
        Map<String, Object> draft = Map.of("objectives", plan.get("objectives"), "expectedTasks", plan.get("expectedTasks"),
                "expectedSkills", plan.get("expectedSkills"));
        String path = "/student/internships/" + placement + "/plan/ai-review";

        assertThat(call("POST", path, student, draft, 200, false).at("/data/status").asText()).isEqualTo("SUCCESS");
        JsonNode cached = call("POST", path, student, draft, 200, false).at("/data");
        assertThat(cached.at("/status").asText()).isEqualTo("CACHED");
        assertThat(cached.at("/result/overall").asText()).isEqualTo("Kế hoạch khá rõ");
        call("POST", path, vng, draft, 403, false);
        call("POST", path, student, Map.of("objectives", " "), 400, false);

        assertThat(db.sql("SELECT status FROM internship_plans WHERE placement_id=:id").param("id", placementId).query(String.class).single())
                .isEqualTo("DRAFT");
        assertThat(db.sql("SELECT version FROM internship_plans WHERE placement_id=:id").param("id", placementId).query(Integer.class).single())
                .isEqualTo(planVersion);
        assertThat(db.sql("SELECT count(*) FROM ai_suggestions WHERE feature='PLAN_REVIEW' AND target_id=:id").param("id", placementId).query(Long.class).single())
                .isEqualTo(1);

        // Switching AI off answers "no suggestion" (not an error) and is audited; switching back restores it.
        call("PUT", "/uit/ai/settings", admin, Map.of("enabled", false), 200, false);
        JsonNode disabled = call("POST", path, student, Map.of("objectives", "Một mục tiêu mới"), 200, false).at("/data");
        assertThat(disabled.at("/available").asBoolean()).isFalse();
        assertThat(disabled.at("/status").asText()).isEqualTo("DISABLED");
        JsonNode settings = call("PUT", "/uit/ai/settings", admin, Map.of("enabled", true), 200, false).at("/data");
        assertThat(settings.at("/enabled").asBoolean()).isTrue();
        assertThat(settings.at("/configured").asBoolean()).isTrue();
        assertThat(settings.at("/updatedBy").asText()).isNotBlank();
        assertThat(db.sql("SELECT count(*) FROM audit_logs WHERE action IN ('AI_ENABLED','AI_DISABLED') AND created_at > now() - interval '1 minute'")
                .query(Long.class).single()).isGreaterThanOrEqualTo(2);
        call("GET", "/uit/ai/settings", student, null, 403, false);
    }

    /** AI2 on the submitted log, for the host company and UIT; other companies cannot see it. */
    private void aiLogSummaryAgainstRealSql(String placement, String student, String vng, String admin) throws Exception {
        UUID placementId = UUID.fromString(placement);
        JsonNode company = call("POST", "/company/internships/" + placement + "/weekly-logs/ai-summary", vng, null, 200, false).at("/data");
        assertThat(company.at("/status").asText()).isEqualTo("SUCCESS");
        assertThat(company.at("/result/flags/0/weekNumber").asInt()).isEqualTo(1);
        assertThat(company.at("/result/weekCount").asInt()).isEqualTo(1);
        assertThat(call("POST", "/uit/internship-supervision/" + placement + "/weekly-logs/ai-summary", admin, null, 200, false)
                .at("/data/status").asText()).isEqualTo("CACHED");
        call("POST", "/company/internships/" + placement + "/weekly-logs/ai-summary", login(FPT, COMPANY_PASSWORD), null, 404, false);
        call("POST", "/company/internships/" + placement + "/weekly-logs/ai-summary", student, null, 403, false);

        JsonNode usage = call("GET", "/uit/ai/settings", admin, null, 200, false).at("/data/usage");
        assertThat(usage.isArray()).isTrue();
        assertThat(db.sql("""
                SELECT count(*) FROM ai_call_logs
                WHERE target_id=:id AND status='SUCCESS' AND prompt_tokens=50 AND output_tokens=10 AND latency_ms IS NOT NULL
                """).param("id", placementId).query(Long.class).single()).isEqualTo(2);

        // While a log is back for revision the student edits the live row; AI2 must still read the
        // content of the latest submission, not the unsubmitted edits.
        db.sql("UPDATE internship_weekly_logs SET status='COMPANY_REVISION_REQUIRED',work_summary='Đang sửa, chưa nộp' WHERE placement_id=:id")
                .param("id", placementId).update();
        List<AiWeeklyLogEntry> sent = aiRepository.lastSubmittedLogs(placementId);
        assertThat(sent).hasSize(1);
        assertThat(sent.get(0).workSummary()).isEqualTo("Tóm tắt công việc.");
    }

    /** The daily limit is a hard cap: parallel requests cannot all take the last slots. */
    @Test
    void dailyAiSlotsCannotBeOverbookedByConcurrentRequests() throws Exception {
        UUID userId = db.sql("SELECT id FROM users WHERE email=:e").param("e", ADMIN).query(UUID.class).single();
        db.sql("DELETE FROM ai_daily_usage WHERE user_id=:id").param("id", userId).update();
        int limit = 3;
        int requests = 12;
        ExecutorService pool = Executors.newFixedThreadPool(requests);
        try {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<Boolean>> results = new java.util.ArrayList<>();
            for (int i = 0; i < requests; i++) {
                results.add(pool.submit(() -> {
                    start.await();
                    return aiRepository.reserveProviderCall(userId, limit);
                }));
            }
            start.countDown();
            long granted = 0;
            for (Future<Boolean> result : results) if (result.get()) granted++;
            assertThat(granted).isEqualTo(limit);
        } finally {
            pool.shutdownNow();
            db.sql("DELETE FROM ai_daily_usage WHERE user_id=:id").param("id", userId).update();
        }
    }

    @Test
    void suspendedAccountStaysSuspended() throws Exception {
        String admin = login(ADMIN, ADMIN_PASSWORD);
        String code = "T" + Long.toString(System.nanoTime(), 36).toUpperCase(Locale.ROOT);
        String recruiterEmail = "r" + code.toLowerCase(Locale.ROOT) + "@example.com";
        JsonNode created = call("POST", "/uit/companies", admin, Map.of("code", code, "name", "Cty " + code, "primaryRecruiter", Map.of("email", recruiterEmail, "fullName", "Tuyển dụng")), 201, false);
        String companyId = created.at("/data/company/id").asText();
        UUID userId = db.sql("SELECT id FROM users WHERE email=:e").param("e", recruiterEmail).query(UUID.class).single();
        // Only the recruiter created by this test gets a password, in place of the activation e-mail.
        db.sql("UPDATE users SET password_hash=:h,status='ACTIVE' WHERE id=:id").param("h", encoder.encode(NEW_RECRUITER_PASSWORD)).param("id", userId).update();
        login(recruiterEmail, NEW_RECRUITER_PASSWORD);

        call("POST", "/uit/companies/" + companyId + "/recruiters/" + userId + "/suspend", admin, Map.of("reason", "Tạm ngưng để kiểm thử"), 200, false);
        for (int i = 0; i < 6; i++) call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", "wrong-password"), 401, false);
        assertThat(userStatus(userId)).isEqualTo("SUSPENDED");
        call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", NEW_RECRUITER_PASSWORD), 403, false);

        // A row already corrupted by the old code unlocks back to SUSPENDED, not ACTIVE.
        db.sql("UPDATE users SET status='LOCKED',locked_until=now()-interval '1 minute' WHERE id=:id").param("id", userId).update();
        call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", NEW_RECRUITER_PASSWORD), 403, false);
        assertThat(userStatus(userId)).isEqualTo("SUSPENDED");

        // Attempts made while suspended must not count against the account once it is reactivated.
        for (int i = 0; i < 5; i++) call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", "wrong-password"), 401, false);
        call("POST", "/uit/companies/" + companyId + "/recruiters/" + userId + "/reactivate", admin, Map.of("reason", "Mở lại để kiểm thử"), 200, false);
        assertThat(db.sql("SELECT failed_login_attempts FROM users WHERE id=:id").param("id", userId).query(Integer.class).single()).isZero();

        // Normal lockout still works.
        for (int i = 0; i < 5; i++) call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", "wrong-password"), 401, false);
        assertThat(userStatus(userId)).isEqualTo("LOCKED");
        call("POST", "/auth/login", null, Map.of("email", recruiterEmail, "password", NEW_RECRUITER_PASSWORD), 423, false);

        // Suspending a company also catches a recruiter who is temporarily LOCKED.
        int version = call("GET", "/uit/companies/" + companyId, admin, null, 200, false).at("/data/version").asInt();
        call("POST", "/uit/companies/" + companyId + "/suspend", admin, Map.of("expectedVersion", version, "reason", "Tạm ngưng doanh nghiệp"), 200, false);
        assertThat(db.sql("SELECT status||'/'||suspension_reason FROM users WHERE id=:id").param("id", userId).query(String.class).single()).isEqualTo("SUSPENDED/COMPANY_SUSPENDED");
        version = call("GET", "/uit/companies/" + companyId, admin, null, 200, false).at("/data/version").asInt();
        call("POST", "/uit/companies/" + companyId + "/reactivate", admin, Map.of("expectedVersion", version, "reason", "Mở lại doanh nghiệp"), 200, false);
        assertThat(userStatus(userId)).isEqualTo("ACTIVE");
        assertThat(db.sql("SELECT failed_login_attempts=0 AND locked_until IS NULL FROM users WHERE id=:id").param("id", userId).query(Boolean.class).single()).isTrue();
        login(recruiterEmail, NEW_RECRUITER_PASSWORD);
    }

    @Test
    void forwardedHeaderCannotBreakOrForgeAudit() throws Exception {
        for (String junk : new String[] {"abc", "1.2.3.4", "999.9.9.9, x"}) {
            call("POST", "/auth/login", null, Map.of("email", ADMIN, "password", ADMIN_PASSWORD), 200, false, "X-Forwarded-For", junk);
            String ip = db.sql("SELECT host(ip_address) FROM audit_logs WHERE action='AUTH_LOGIN_SUCCEEDED' ORDER BY created_at DESC,id DESC LIMIT 1").query(String.class).single();
            assertThat(ip).as("audit IP for X-Forwarded-For [" + junk + "]").isEqualTo("127.0.0.1");
        }
    }

    @Test
    void expiryIsCommittedForStudentAndOfferUploads() throws Exception {
        String vng = login(VNG, COMPANY_PASSWORD), student = login("21520943@student.uit.edu.vn", STUDENT_PASSWORD);
        UUID upload = UUID.fromString(call("POST", "/students/me/documents/uploads", student, Map.of("documentType", "OTHER", "fileName", "x.pdf", "mimeType", "application/pdf", "fileSizeBytes", 1000), 201, false).at("/data/uploadId").asText());
        db.sql("UPDATE student_document_uploads SET expires_at=now()-interval '1 minute' WHERE id=:id").param("id", upload).update();
        JsonNode first = call("POST", "/students/me/documents/uploads/" + upload + "/complete", student, null, 410, false);
        assertThat(first.at("/error/code").asText()).isEqualTo("STUDENT_DOCUMENT_UPLOAD_EXPIRED");
        assertThat(status("student_document_uploads", upload.toString())).isEqualTo("EXPIRED");
        call("POST", "/students/me/documents/uploads/" + upload + "/complete", student, null, 410, false);

        assertThat(status("applications", SEED_INTERVIEW_APPLICATION)).isEqualTo("INTERVIEW_INVITED");
        UUID offer = UUID.fromString(call("POST", "/companies/me/applications/" + SEED_INTERVIEW_APPLICATION + "/offer-document/uploads", vng, Map.of("fileName", "o.pdf", "mimeType", "application/pdf", "fileSizeBytes", 1000), 201, false).at("/data/uploadId").asText());
        db.sql("UPDATE offer_document_uploads SET expires_at=now()-interval '1 minute' WHERE id=:id").param("id", offer).update();
        call("POST", "/companies/me/applications/" + SEED_INTERVIEW_APPLICATION + "/offer-document/uploads/" + offer + "/complete", vng, null, 410, false);
        assertThat(status("offer_document_uploads", offer.toString())).isEqualTo("EXPIRED");
    }
}
