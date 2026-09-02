import { randomUUID } from "node:crypto";

import { accounts, apiLogin } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";

const fptApplicationId = "00000000-0000-4000-8000-000000008002";
const vngPlacementId = "00000000-0000-4000-8000-000000013001";

test("@full recruiter không truy cập được hồ sơ doanh nghiệp khác", async ({ request }) => {
  const accessToken = await apiLogin(request, accounts.company);
  const headers = { authorization: `Bearer ${accessToken}` };

  const candidates = await request.get("http://127.0.0.1:3100/api/v1/companies/me/candidates?page=1&pageSize=100", {
    headers,
  });
  expect(candidates.status()).toBe(200);
  const candidatePayload = await candidates.json();
  expect(candidatePayload.data.map((application) => application.id)).not.toContain(fptApplicationId);

  const crossCompanyMutation = await request.post(
    `http://127.0.0.1:3100/api/v1/companies/me/applications/${fptApplicationId}/start-review`,
    {
      headers: {
        ...headers,
        "Idempotency-Key": randomUUID(),
      },
    },
  );
  expect(crossCompanyMutation.status()).toBe(404);
});

test("@full nhật ký tuần che giấu placement ngoài ownership", async ({ request }) => {
  const [studentToken, fptToken] = await Promise.all([
    apiLogin(request, accounts.studentAuxiliary),
    apiLogin(request, accounts.companyFpt),
  ]);

  const studentRead = await request.get(
    `http://127.0.0.1:3100/api/v1/student/internships/${vngPlacementId}/weekly-logs`,
    { headers: { authorization: `Bearer ${studentToken}` } },
  );
  expect(studentRead.status()).toBe(404);

  const companyRead = await request.get(
    `http://127.0.0.1:3100/api/v1/company/internships/${vngPlacementId}/weekly-logs`,
    { headers: { authorization: `Bearer ${fptToken}` } },
  );
  expect(companyRead.status()).toBe(404);
});
