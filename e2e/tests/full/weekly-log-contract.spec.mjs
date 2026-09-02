import { randomUUID } from "node:crypto";

import { accounts, apiLogin } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";

const apiBase = "http://127.0.0.1:3100/api/v1";
const placementId = "00000000-0000-4000-8000-000000013001";

function findWeek(payload, weekNumber) {
  return payload.data.logs.find((log) => log.weekNumber === weekNumber);
}

test("@full nhật ký tuần khóa version và retry idempotent", async ({ request }) => {
  const studentToken = await apiLogin(request, accounts.student);
  const studentHeaders = { authorization: `Bearer ${studentToken}` };
  const list = await request.get(`${apiBase}/student/internships/${placementId}/weekly-logs`, {
    headers: studentHeaders,
  });
  expect(list.status()).toBe(200);
  const initial = findWeek(await list.json(), 2);
  expect(initial.status).toBe("DRAFT");
  expect(initial.overdue).toBe(true);

  const save = await request.put(`${apiBase}/student/internships/${placementId}/weekly-logs/${initial.id}`, {
    headers: studentHeaders,
    data: {
      expectedVersion: initial.version,
      weekNumber: 2,
      workSummary: initial.workSummary,
      outcomes: "Hoàn thành API và 18 ca kiểm thử đơn vị.",
      difficulties: initial.difficulties,
      nextPlan: "Tích hợp API và bổ sung kiểm thử tích hợp.",
    },
  });
  expect(save.status()).toBe(200);
  const saved = findWeek(await save.json(), 2);
  expect(saved.version).toBe(initial.version + 1);

  const commandId = randomUUID();
  const submitUrl = `${apiBase}/student/internships/${placementId}/weekly-logs/${saved.id}/submit`;
  const submit = await request.post(submitUrl, {
    headers: { ...studentHeaders, "Idempotency-Key": commandId },
    data: { expectedVersion: saved.version },
  });
  expect(submit.status()).toBe(200);
  const submitted = findWeek(await submit.json(), 2);
  expect(submitted.status).toBe("SUBMITTED");
  expect(submitted.currentSubmissionNo).toBe(1);

  const retry = await request.post(submitUrl, {
    headers: { ...studentHeaders, "Idempotency-Key": commandId },
    data: { expectedVersion: saved.version },
  });
  expect(retry.status()).toBe(200);
  const retried = findWeek(await retry.json(), 2);
  expect(retried.version).toBe(submitted.version);
  expect(retried.currentSubmissionNo).toBe(1);
  expect(retried.history).toHaveLength(1);

  const stale = await request.post(submitUrl, {
    headers: { ...studentHeaders, "Idempotency-Key": randomUUID() },
    data: { expectedVersion: saved.version },
  });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe("INTERNSHIP_WEEKLY_LOG_VERSION_CONFLICT");

  const companyToken = await apiLogin(request, accounts.company);
  const confirmUrl = `${apiBase}/company/internships/${placementId}/weekly-logs/${saved.id}/confirm`;
  const reusedForAnotherAction = await request.post(confirmUrl, {
    headers: { authorization: `Bearer ${companyToken}`, "Idempotency-Key": commandId },
    data: { expectedVersion: submitted.version },
  });
  expect(reusedForAnotherAction.status()).toBe(409);
  expect((await reusedForAnotherAction.json()).error.code).toBe("IDEMPOTENCY_KEY_REUSED");

  const confirmed = await request.post(confirmUrl, {
    headers: { authorization: `Bearer ${companyToken}`, "Idempotency-Key": randomUUID() },
    data: { expectedVersion: submitted.version, note: "Nội dung phù hợp với tiến độ thực tế." },
  });
  expect(confirmed.status()).toBe(200);
  const confirmedLog = findWeek(await confirmed.json(), 2);
  expect(confirmedLog.status).toBe("COMPANY_CONFIRMED");
  expect(confirmedLog.history).toHaveLength(2);
});
