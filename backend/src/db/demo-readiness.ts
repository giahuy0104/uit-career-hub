import pg, { type QueryResultRow } from "pg";

import { env } from "../config/env.js";

const { Client } = pg;

export type DemoReadinessCheck = {
  checkName: string;
  actual: number;
  expected: number;
  passed: boolean;
};

export type DemoReadinessRow = QueryResultRow & {
  check_name: string;
  actual: number;
  expected: number;
};

type DemoReadinessOptions = {
  databaseUrl?: string;
  log?: (message: string) => void;
};

const readinessSql = `
  SELECT '7 tài khoản active có mật khẩu' AS check_name,
         count(*)::int AS actual, 7 AS expected
  FROM users
  WHERE id IN (
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103'
  ) AND status = 'ACTIVE' AND password_hash IS NOT NULL
  UNION ALL
  SELECT '3 hồ sơ sinh viên', count(*)::int, 3
  FROM student_profiles
  WHERE id IN (
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000002003'
  )
  UNION ALL
  SELECT '3 tài khoản recruiter có doanh nghiệp', count(*)::int, 3
  FROM company_users
  WHERE user_id IN (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000103'
  )
  UNION ALL
  SELECT '4 tin đang tuyển', count(*)::int, 4
  FROM job_posts
  WHERE id IN (
    '00000000-0000-4000-8000-000000007001',
    '00000000-0000-4000-8000-000000007002',
    '00000000-0000-4000-8000-000000007003',
    '00000000-0000-4000-8000-000000007005'
  ) AND status = 'RECRUITING' AND deadline > current_date
  UNION ALL
  SELECT '1 tin chờ UIT duyệt', count(*)::int, 1
  FROM job_posts
  WHERE id = '00000000-0000-4000-8000-000000007004'
    AND status = 'PENDING_UIT_REVIEW'
  UNION ALL
  SELECT 'đơn VNG chờ sinh viên nhận offer', count(*)::int, 1
  FROM applications
  WHERE id = '00000000-0000-4000-8000-000000008001'
    AND status = 'OFFER_PENDING_STUDENT'
  UNION ALL
  SELECT 'đơn FPT đang được doanh nghiệp xử lý', count(*)::int, 1
  FROM applications
  WHERE id = '00000000-0000-4000-8000-000000008002'
    AND status = 'COMPANY_REVIEWING'
  UNION ALL
  SELECT 'đơn VNG Frontend chờ UIT', count(*)::int, 1
  FROM applications
  WHERE id = '00000000-0000-4000-8000-000000008003'
    AND status = 'UIT_REVIEWING'
  UNION ALL
  SELECT 'offer PASS chưa phản hồi', count(*)::int, 1
  FROM recruitment_results
  WHERE application_id = '00000000-0000-4000-8000-000000008001'
    AND outcome = 'PASS' AND student_decision IS NULL
  UNION ALL
  SELECT '3 vai trò đều có thông báo chưa đọc', count(DISTINCT recipient_user_id)::int, 3
  FROM notifications
  WHERE read_at IS NULL
    AND recipient_user_id IN (
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000103'
    )
  ORDER BY check_name
`;

export function evaluateDemoReadiness(rows: DemoReadinessRow[]): DemoReadinessCheck[] {
  return rows.map((row) => ({
    checkName: row.check_name,
    actual: Number(row.actual),
    expected: Number(row.expected),
    passed: Number(row.actual) === Number(row.expected),
  }));
}

export async function checkDemoReadiness(options: DemoReadinessOptions = {}) {
  const databaseUrl = options.databaseUrl ?? env.databaseUrl;
  const log = options.log ?? console.log;
  const client = new Client({ connectionString: databaseUrl, application_name: "uit-career-hub-demo-check" });

  await client.connect();
  try {
    const result = await client.query<DemoReadinessRow>(readinessSql);
    const checks = evaluateDemoReadiness(result.rows);
    for (const check of checks) {
      log(`${check.passed ? "PASS" : "FAIL"} | ${check.checkName} | ${check.actual}/${check.expected}`);
    }
    return { ready: checks.every((check) => check.passed), checks };
  } finally {
    await client.end();
  }
}

if (process.argv[1]?.endsWith("demo-readiness.ts") || process.argv[1]?.endsWith("demo-readiness.js")) {
  checkDemoReadiness()
    .then(({ ready }) => {
      if (!ready) {
        console.error("Dữ liệu demo chưa sẵn sàng. Hãy kiểm tra đúng database rồi chạy db:demo:reset.");
        process.exitCode = 1;
      } else {
        console.log("Dữ liệu demo sẵn sàng cho kịch bản bảo vệ.");
      }
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
