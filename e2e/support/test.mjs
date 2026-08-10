import { test as base, expect } from "@playwright/test";

import { resetE2eDatabase } from "./database.mjs";

export const test = base.extend({
  e2eDatabase: [async ({}, use) => {
    resetE2eDatabase();
    await use();
  }, { auto: true }],
});

export { expect };
