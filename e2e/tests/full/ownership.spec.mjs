import { randomUUID } from "node:crypto";

import { accounts, apiLogin } from "../../support/auth.mjs";
import { expect, test } from "../../support/test.mjs";

const fptApplicationId = "00000000-0000-4000-8000-000000008002";

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
