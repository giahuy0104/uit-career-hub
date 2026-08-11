# Evidence: Neon test backup/restore drill 2026-08-11

## Phạm vi và an toàn

- Source: `DATABASE_URL_TEST`, Neon non-production branch, PostgreSQL 17, chỉ đọc bằng `pg_dump` và query verification.
- Target: container PostgreSQL 17 local tạm thời, database `uit_career_hub_restore_drill`.
- Production Neon không được kết nối, reset, migrate hay restore.
- Archive custom format được lưu trong OS temp, không commit và đã xóa sau verification.
- Container/database restore tạm đã xóa sau khi ghi evidence.

## Phát hiện trước drill cuối

Lần kiểm tra đầu phát hiện Neon test branch chỉ có 16 migration/27 table, chậm `0017_internship_evaluations.sql` so với `develop`. Script đã được siết để fail nếu source không khớp checksum/version migration trong repo. Migration `0017` sau đó được áp dụng lên duy nhất Neon test branch, không reset dữ liệu.

## Kết quả cuối

| Trường | Kết quả |
|---|---|
| Status | `PASSED` |
| Finished at | `2026-08-11T02:46:11.428Z` |
| Total duration | `12.464 s` |
| Dump duration | `8.348 s` |
| Restore duration (RTO đo trên local target) | `2.164 s` |
| Archive size | `2,339,842 bytes` |
| Archive SHA-256 | `8d6ab099422e674ae9b00c4f4b9b98b9de9a896b4840b7e9eafa863832467b97` |
| Source schema current | `true` |
| Migrations | `17/17`, checksum khớp |
| Public tables | `28` |
| Source/target migration match | `true` |
| Source/target row-count match | `true` cho toàn bộ 28 table |
| Archive retained | `false` |

Report JSON redacted local: `artifacts/backup-restore/2026-08-11T02-45-58-964Z-local-pg17-restore-drill.json` (gitignored).

RTO trên đây chỉ là số đo cho dataset test và target local, không phải cam kết RTO production. RPO của logical backup là thời điểm `pg_dump` lấy snapshot; lịch backup production và retention phải được chốt riêng với chủ hệ thống.
