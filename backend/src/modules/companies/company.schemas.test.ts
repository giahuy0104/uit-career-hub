import { describe, expect, it } from "vitest";

import { partnerDirectoryQuerySchema } from "./company.schemas.js";

describe("partnerDirectoryQuerySchema", () => {
  it("parses the recruiting-jobs filter without treating the string false as true", () => {
    expect(partnerDirectoryQuerySchema.parse({ hasRecruitingJobs: "true" }).hasRecruitingJobs).toBe(true);
    expect(partnerDirectoryQuerySchema.parse({ hasRecruitingJobs: "false" }).hasRecruitingJobs).toBe(false);
  });
});
