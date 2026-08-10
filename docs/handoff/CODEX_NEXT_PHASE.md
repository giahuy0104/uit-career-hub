# UIT Career Hub — Bàn giao sau khi hoàn thành happy flow

> Cập nhật: 10/08/2026
> Baseline ổn định: `v0.1.0`
> Commit baseline `v0.1.0`: `0bce5df0a10afff65975116fa18ab5d58c0286bd`

## 0. Cách dùng tài liệu này

Khi giao repository cho một phiên Codex mới, yêu cầu Codex đọc hết tệp này trước khi sửa mã.

Lệnh mở dự án:

```powershell
cd "C:\Users\Windows\Documents\UIT\ĐỒ ÁN TỐT NGHIỆP\uit-career-hub"
```

Prompt ngắn để bắt đầu:

```text
Hãy đọc toàn bộ docs/handoff/CODEX_NEXT_PHASE.md, kiểm tra trạng thái Git và đối chiếu
state machine/OpenAPI trước khi sửa mã. Bắt đầu từ mục "Việc tiếp theo được khuyến nghị",
làm trên nhánh mới, không làm hỏng happy flow v0.1.0 và phải chạy đủ kiểm thử trước khi bàn giao.
```

## 1. Kết luận hiện tại

Happy flow chính đã hoàn thành và chạy được trên môi trường public:

1. UIT quản lý doanh nghiệp đối tác và tài khoản recruiter.
2. Doanh nghiệp tạo tin, lưu nháp và gửi UIT duyệt.
3. UIT phê duyệt, yêu cầu chỉnh sửa hoặc từ chối tin.
4. Sinh viên dùng tài khoản UIT, tìm việc và ứng tuyển hai bước bằng tài liệu đã xác minh.
5. UIT yêu cầu bổ sung, từ chối hoặc chuyển hồ sơ đến đúng doanh nghiệp.
6. Doanh nghiệp bắt đầu xem, chọn Không phù hợp hoặc mời phỏng vấn.
7. Doanh nghiệp ghi nhận PASS/FAIL và có thể tải PDF offer lên Cloudflare R2 private.
8. Sinh viên mở offer, nhận hoặc từ chối.
9. UIT đối chiếu và xác nhận nơi thực tập.
10. Đơn được chọn thành `HIRED`; các đơn còn hoạt động tự thành `WITHDRAWN` với lý do
    `ACCEPTED_OTHER_JOB`; lịch sử, audit và thông báo được tạo đầy đủ.

Đây là bản MVP ổn định để phát triển tiếp thành đồ án hoàn chỉnh, chưa phải hệ thống production
cho người dùng thật.

## 2. Điểm nổi bật của đề tài

Điểm khác biệt không nằm ở AI. UIT Career Hub là cổng quản trị quy trình kết nối nghề nghiệp có
sự kiểm soát của nhà trường, không chỉ là bảng đăng tin và nộp CV.

- Hệ sinh thái đóng cho sinh viên UIT và doanh nghiệp đối tác.
- Hai cổng kiểm soát: UIT duyệt tin và UIT kiểm tra hồ sơ trước khi doanh nghiệp được xem.
- Theo dõi xuyên suốt từ ứng tuyển, bổ sung, sàng lọc, phỏng vấn, offer đến xác nhận nơi thực tập.
- Xử lý đúng trường hợp sinh viên ứng tuyển nhiều nơi: chỉ đóng đơn khác sau khi sinh viên nhận
  offer và UIT xác nhận.
- Mọi quyết định quan trọng có reason, state history, audit log, idempotency và notification.
- Dashboard riêng cho sinh viên, UIT và doanh nghiệp dựa trên dữ liệu PostgreSQL thật.

Khi thuyết trình, mô tả sản phẩm là **cổng quản trị liên kết thực tập và tuyển dụng của UIT**, không
mô tả đơn thuần là “website tìm việc”.

## 3. Hạ tầng và địa chỉ hiện tại

- Frontend production: <https://uit-career-hub-web-041204.vercel.app>
- Backend production: <https://uit-career-hub-api-041204.vercel.app>
- Database: Neon PostgreSQL.
- File private: Cloudflare R2, dùng presigned URL và kiểm tra ownership ở backend.
- CI/CD: GitHub Actions và Vercel Git integration.
- GitHub Release ổn định: `v0.1.0`.
- Email: code Resend/outbox/retry đã có; chỉ được xem là production khi `EMAIL_ENABLED=true`,
  sender/domain hợp lệ và đã test gửi thật.
- FCM, chat realtime, AI và multi-school chưa thuộc bản hiện tại.

Không ghi API key, connection string, cookie secret hoặc tài khoản thật vào Git/Markdown.

Tại thời điểm bàn giao, `origin/develop` đang **chậm hơn `origin/main` 26 commit và không có commit
riêng**. Không tạo feature branch từ `develop` cũ; phải fast-forward `develop` tới `main` trước.

## 4. Kiến trúc hiện tại

```text
uit-career-hub/
├── frontend/                 React 19 + Vite
│   ├── src/App.jsx           Luồng sinh viên và điều hướng chính
│   ├── src/RolePortals.jsx   Portal UIT/Doanh nghiệp và nhiều màn nghiệp vụ
│   ├── src/dashboard/        Dashboard dữ liệu thật
│   ├── src/notifications/    Notification inbox/context
│   └── src/api/client.js     API client và phiên đăng nhập
├── backend/                  Express 5 + TypeScript, modular monolith
│   └── src/modules/
│       ├── auth/             JWT/refresh/RBAC, khóa đăng nhập
│       ├── companies/        Doanh nghiệp đối tác và recruiter
│       ├── jobs/             Tin tuyển dụng và hàng đợi UIT
│       ├── applications/     Hồ sơ, phỏng vấn, offer, placement
│       ├── notifications/    Thông báo trong hệ thống
│       ├── scheduler/        Tổng hợp hồ sơ chờ hằng ngày
│       ├── email/            Outbox và Resend provider
│       ├── dashboard/        Số liệu ba vai trò
│       └── storage/          Cloudflare R2
├── database/
│   ├── migrations/           `0001` đến `0015`
│   └── seeds/                Dữ liệu development/demo
├── docs/api/openapi.yaml     Hợp đồng API
├── docs/domain/              ERD và state machine
├── docs/demo/                Kịch bản bảo vệ E2E
├── docs/deployment/          Neon, Vercel và R2
└── docs/releases/v0.1.0.md   Checklist release hiện tại
```

## 5. Nguồn sự thật và thứ tự ưu tiên

Nếu tài liệu mâu thuẫn, dùng thứ tự sau:

1. Database migrations và backend transaction/authorization.
2. `docs/domain/application-state-machine.md` và `docs/domain/job-state-machine.md`.
3. `docs/api/openapi.yaml`.
4. Integration tests của module.
5. `docs/releases/v0.1.0.md` và `docs/demo/e2e-defense-script.md`.
6. Tài liệu Word là nguồn yêu cầu nghiệp vụ ban đầu, không phải hợp đồng kỹ thuật cuối cùng.

Lưu ý: `frontend/design-qa.md` là biên bản của prototype cũ. Các đoạn nói ứng tuyển ba bước,
câu hỏi doanh nghiệp hoặc dữ liệu tĩnh không còn là nguồn sự thật. Luồng hiện tại là **hai bước**:
chọn CV/tài liệu → xem lại consent và gửi; không có câu hỏi tuyển dụng trong MVP.

## 6. Ma trận tiến độ đã hoàn thành

| Nhóm | Trạng thái | Nội dung |
|---|---|---|
| Nền tảng | Hoàn thành | Monorepo, `.env.example`, Neon, migrations, seed, CI, Vercel |
| Xác thực/RBAC | Hoàn thành MVP | Ba vai trò, JWT/refresh, domain email UIT, khóa đăng nhập, ownership |
| Doanh nghiệp đối tác | Hoàn thành | UIT tạo/sửa/tạm ngưng, quản lý recruiter, activation link |
| Tin tuyển dụng | Hoàn thành happy flow | Draft → gửi duyệt → approve/revision/reject; sinh viên chỉ thấy tin hợp lệ |
| Hồ sơ và CV | Hoàn thành happy flow | Upload PDF R2, UIT xác minh, CV mặc định, snapshot tài liệu khi ứng tuyển |
| Ứng tuyển | Hoàn thành | Hai bước, chống nộp trùng, rút/hủy đúng trạng thái và bắt buộc lý do |
| UIT duyệt hồ sơ | Hoàn thành | Bổ sung, từ chối, forward; history/audit/notification |
| Pipeline doanh nghiệp | Hoàn thành | Start review, Không phù hợp, phỏng vấn, PASS/FAIL |
| Offer | Hoàn thành | PDF private, student accept/decline, UIT tải và đối chiếu |
| Placement nhiều đơn | Hoàn thành | UIT confirm, một `HIRED`, đơn khác tự `WITHDRAWN` trong transaction |
| Thông báo | Hoàn thành MVP | Inbox, unread badge, read/read-all, deep link, ownership, dedupe |
| Cron tổng hợp | Đã hiện thực | Tổng hợp hàng đợi UIT/doanh nghiệp theo ngày, chống gửi trùng |
| Email | Một phần | Outbox/provider/retry đã có; chưa mặc định bật Resend production |
| Dashboard | Hoàn thành MVP | Ba dashboard đọc PostgreSQL thật và có RBAC |
| Báo cáo UIT | Hoàn thành CSV/Excel | Lọc theo kỳ/khoa/ngành/doanh nghiệp/trạng thái; export có audit và giới hạn 10.000 dòng |
| Deploy | Hoàn thành | Frontend/backend Vercel, Neon và R2 public happy flow đã test |
| Test hiện tại | Đạt | 213 backend tests; 9 frontend tests; Playwright 3 smoke + 11 full; typecheck/build/OpenAPI đạt |

## 7. Phần chưa hoàn thành hoặc mới ở mức MVP

### 7.1. Khoảng trống quan trọng trước khi gọi là đồ án hoàn chỉnh

- Playwright đã tự động hóa đăng nhập ba vai trò, happy flow xuyên suốt, các nhánh quan trọng,
  ownership, taxonomy và báo cáo/export; bộ smoke chạy trên PR, bộ full chạy theo lịch/thủ công.
- Frontend chưa có test component/interaction đầy đủ. Chín frontend test hiện tại chủ yếu kiểm tra
  build/hosting, không chứng minh toàn bộ hành vi UI.
- `App.jsx` và `RolePortals.jsx` đang lớn, chứa nhiều màn hình và cần tách component/module trước
  khi nhóm tiếp tục mở rộng.
- Cần rà toàn bộ màn hình để loại dữ liệu tĩnh, CTA chưa hoạt động và component prototype không
  còn được dùng.
- Chưa audit accessibility đầy đủ: keyboard, focus visible, screen reader, zoom 200%, contrast.
- Cần kiểm tra responsive thực tế ở desktop, tablet và mobile.
- Bundle đã tách theo portal và build hiện không còn cảnh báo chunk lớn hơn 500 kB; tiếp tục giữ lazy loading khi thêm portal mới.

### 7.2. Nghiệp vụ còn thiếu so với đề xuất ban đầu

- Chưa có UIT SSO hoặc đồng bộ tình trạng sinh viên đang còn hiệu lực từ hệ thống trường.
- Quản trị danh mục ngành nghề/kỹ năng đã có migration, API UIT-only, audit/optimistic lock,
  màn UIT hoàn chỉnh và Playwright E2E; chưa nối bộ chọn taxonomy vào form tin tuyển dụng.
- Chưa có quản lý vòng đời thực tập sau `HIRED`: bắt đầu, đang thực tập, hoàn thành, đánh giá.
- Báo cáo hồ sơ theo khoa, ngành, doanh nghiệp và kỳ tuyển dụng đã có CSV/Excel; PDF chưa làm vì là phần tùy chọn sau ưu tiên chính.
- Chưa có saved jobs, lịch sử xem tin và nhắc hạn nộp hoàn chỉnh.
- Chưa có màn SchedulerLog, cấu hình ngưỡng, resend log và theo dõi delivered/bounced.
- Chưa tích hợp FCM.

### 7.3. Ngoài phạm vi ưu tiên hiện tại

- AI gợi ý việc, AI soạn nội dung hoặc AI chấm CV.
- Chat realtime.
- Mobile app riêng.
- Multi-school/multi-tenant.
- Hợp đồng lao động, tiền lương hoặc thanh toán.

Không bắt đầu các mục trên cho đến khi UI, E2E, security và tài liệu bảo vệ đạt.

## 8. Roadmap đề xuất để nâng thành đồ án tốt nghiệp

### Giai đoạn 1 — Chuẩn hóa UI và loại bỏ dấu vết prototype

Mục tiêu: toàn bộ chức năng đã có phải trông như một sản phẩm thống nhất và dùng dữ liệu thật.

1. Lập inventory tất cả route/màn hình theo ba vai trò.
2. Đánh dấu từng màn: live API, một phần live, dữ liệu tĩnh, CTA chưa hoạt động.
3. Loại hoặc thay thế dữ liệu giả ở những màn dùng trong demo.
4. Tách `App.jsx` và `RolePortals.jsx` theo feature; không thay đổi state machine/API trong cùng PR.
5. Chuẩn hóa design tokens: màu, font, spacing, radius, table, form, modal, badge và status.
6. Bổ sung loading, empty, error, retry, disabled, success toast và confirmation cho mọi mutation.
7. Rà responsive tại tối thiểu `1440×1024`, `1024×768`, `768×1024`, `390×844`.
8. Rà keyboard/focus/ARIA/contrast và sửa lỗi P0/P1.
9. Dùng lazy import theo portal hoặc route để giảm bundle ban đầu.

Đây là **việc tiếp theo được khuyến nghị**.

### Giai đoạn 2 — Tự động hóa kiểm thử happy flow

Mục tiêu: thay việc bấm tay bằng bằng chứng có thể chạy lại.

1. Chọn Playwright cho E2E browser.
2. Viết smoke test đăng nhập cho ba vai trò.
3. Viết một E2E xuyên suốt: company tạo tin → UIT duyệt → student apply → UIT forward →
   company interview/PASS → student accept → UIT confirm placement.
4. Viết các nhánh quan trọng: revision, supplement, reject, withdraw, cancel interview,
   decline offer và truy cập chéo doanh nghiệp.
5. Thêm kiểm tra E2E vào CI ở mức smoke; bộ dài có thể chạy theo lịch hoặc trước release.
6. Chụp screenshot/video/trace khi test thất bại.

### Giai đoạn 3 — Hoàn thiện giá trị học thuật và nghiệp vụ

Ưu tiên theo thứ tự:

1. Quản lý danh mục ngành nghề/kỹ năng cho UIT. **Đã hoàn thành.**
2. Báo cáo có bộ lọc và xuất CSV/Excel; PDF chỉ làm nếu còn thời gian. **Đã hoàn thành CSV/Excel.**
3. Mở rộng placement thành vòng đời thực tập: `HIRED → STARTED → COMPLETED`, có actor/history.
4. Bổ sung đánh giá doanh nghiệp hoặc xác nhận hoàn thành thực tập nếu phù hợp quy trình thật.
5. Chỉ nghiên cứu UIT SSO sau khi có thông tin tích hợp chính thức; không giả lập SSO production.

Mỗi mục phải có migration, OpenAPI, RBAC, service transaction, test và UI; không làm UI giả trước
rồi bỏ backend.

### Giai đoạn 4 — Security, privacy và vận hành

1. Threat model cho đăng nhập, CV/offer, presigned URL, IDOR và phân quyền chéo doanh nghiệp.
2. Rà rate limit, cookie flags, CORS, CSP/Helmet, log nhạy cảm và kích thước/MIME file.
3. Kiểm tra backup/restore Neon bằng quy trình thử nghiệm có ghi nhận kết quả.
4. Thêm error monitoring và trace ID; chuẩn bị dashboard/log truy vết cho demo.
5. Tắt tài khoản demo, đổi toàn bộ secret trước khi có người dùng thật.
6. Nếu bật email: xác minh domain Resend, SPF/DKIM, test retry và tránh gửi dữ liệu CV trong email.

### Giai đoạn 5 — Hồ sơ bảo vệ

1. Chốt yêu cầu, use case, BPMN/sequence, ERD và state machine khớp code.
2. Xuất danh sách API và ma trận RBAC.
3. Viết báo cáo kiểm thử: unit, integration, E2E, security và performance cơ bản.
4. Ghi rõ đóng góp/điểm khác biệt: hai lớp UIT kiểm duyệt và placement nhiều đơn.
5. Chuẩn bị dữ liệu demo, ba profile trình duyệt, PDF offer mẫu và video dự phòng.
6. Chạy checklist `docs/releases/v0.1.0.md` trước buổi bảo vệ.

## 9. Backlog ưu tiên cho Codex

### P0 — Không được phá vỡ

- RBAC và company/student ownership ở backend.
- State machine Job/Application.
- Idempotency và transaction của placement.
- R2 private; không trả object key/URL vĩnh viễn.
- History, audit và notification của mọi transition.
- Public happy flow đang chạy ở `v0.1.0`.

### P1 — Làm ngay

- UI inventory và loại dữ liệu tĩnh/dead CTA.
- Tách component mà không đổi nghiệp vụ.
- Loading/empty/error/responsive/accessibility.
- Playwright smoke E2E cho happy flow.
- Cập nhật `frontend/design-qa.md` theo UI hiện tại sau khi audit lại.

### P2 — Làm sau P1

- Category/skill admin. **Đã hoàn thành.**
- Báo cáo và export CSV/Excel. **Đã hoàn thành; PDF tùy chọn chưa làm.**
- Vòng đời thực tập sau `HIRED`.
- Bundle splitting và frontend test coverage.
- Resend production/SchedulerLog nếu nhóm cần trình bày vận hành.

### P3 — Chỉ làm khi đồ án cốt lõi đã hoàn chỉnh

- SSO thật, FCM, AI, chat và multi-school.

## 10. Nguyên tắc làm việc cho phiên Codex tiếp theo

1. Bắt đầu bằng `git status`, đọc tệp này và đọc tài liệu source-of-truth liên quan.
2. Không sửa trực tiếp `main`.
3. Đồng bộ `develop` với `main`; tạo nhánh nhỏ như `feature/ui-live-data-audit` hoặc
   `feature/ui-accessibility-polish`.
4. Không trộn refactor lớn với thay đổi state machine trong cùng pull request.
5. Không đổi enum/status/API chỉ để UI dễ làm hơn.
6. Backend phải kiểm tra quyền; ẩn nút ở frontend không được xem là bảo mật.
7. Mọi mutation phải xử lý retry/idempotency hoặc khóa thao tác phù hợp.
8. Không chạy `db:demo:reset` trên production.
9. Không commit `.env`, secret, CV, bảng điểm hoặc offer thật.
10. Nếu thay đổi UI đáng kể, chạy local app, kiểm tra bằng browser và chụp ảnh trước/sau.
11. Mỗi PR phải mô tả phạm vi, cách test, ảnh UI nếu có và rủi ro hồi quy.
12. Chỉ merge khi CI xanh.

## 11. Lệnh kiểm tra bắt buộc

```powershell
pnpm install
pnpm typecheck
pnpm openapi:validate
pnpm test
pnpm build
git diff --check
```

Với database development/demo riêng:

```powershell
pnpm db:migrate
pnpm db:demo:check
```

Health production chỉ đọc:

```powershell
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health
Invoke-RestMethod https://uit-career-hub-api-041204.vercel.app/api/health/database
Invoke-RestMethod https://uit-career-hub-web-041204.vercel.app/api/health/database
```

Không chạy seed/reset trên Neon production.

## 12. Definition of Done cho một lát cắt mới

Một tính năng chỉ được coi là hoàn thành khi đáp ứng đủ phần liên quan:

- Nghiệp vụ và trạng thái được mô tả rõ.
- Migration có thể chạy lặp an toàn theo cơ chế migration hiện tại.
- Backend validation, RBAC, ownership và transaction đầy đủ.
- OpenAPI cập nhật.
- UI dùng API thật, có loading/empty/error/success và responsive.
- History/audit/notification được tạo nếu có transition.
- Unit/integration test và E2E quan trọng đã có.
- `pnpm typecheck`, `pnpm openapi:validate`, `pnpm test`, `pnpm build` đạt.
- Tài liệu và demo script được cập nhật.
- Không để lộ secret hoặc dữ liệu cá nhân.

## 13. Tài liệu cần đọc khi làm từng nhóm việc

- Phạm vi release: `docs/releases/v0.1.0.md`
- Kịch bản E2E: `docs/demo/e2e-defense-script.md`
- Application state machine: `docs/domain/application-state-machine.md`
- Job state machine: `docs/domain/job-state-machine.md`
- ERD: `docs/domain/erd.md`
- OpenAPI: `docs/api/openapi.yaml`
- RBAC: `docs/security/rbac-matrix.md`
- Reporting: `docs/domain/reporting.md`
- Vercel/Neon: `docs/deployment/vercel-neon.md`
- Cloudflare R2: `docs/deployment/cloudflare-r2.md`
- Quy ước nhánh: `docs/branching.md` và `CONTRIBUTING.md`

## 14. Nhiệm vụ đầu tiên đề xuất cho Codex

Đồng bộ `develop` trước:

```powershell
git fetch origin
git switch develop
git pull --ff-only origin develop
git merge --ff-only origin/main
git push origin develop
git switch -c feature/ui-live-data-audit
```

Chỉ chạy `git push origin develop` khi người dùng đã cho phép cập nhật remote. Sau đó:

1. Lập bảng inventory route/màn hình cho ba vai trò ngay trong một tài liệu mới.
2. Chỉ ra màn nào còn dữ liệu tĩnh hoặc CTA chưa hoạt động bằng bằng chứng từ mã nguồn và browser.
3. Chọn một lát cắt nhỏ có ảnh hưởng cao, ưu tiên Student Dashboard/Jobs/Applications hoặc các
   màn được dùng trong demo.
4. Chuyển lát cắt đó sang dữ liệu thật và chuẩn hóa loading/empty/error/responsive.
5. Không thay đổi state machine hoặc API nếu chưa có lý do nghiệp vụ.
6. Chạy toàn bộ kiểm tra và mở PR kèm ảnh trước/sau.

Sau khi lát cắt đầu tiên đạt, lặp lại cho UIT và Doanh nghiệp rồi mới chuyển sang E2E automation.
