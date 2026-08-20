import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["dist/**", "node_modules/**"],
    // PostgreSQL flows intentionally cover several serialized transactions; CI and local builds may run concurrently.
    testTimeout: 30_000,
    // Các integration test dùng chung DATABASE_URL_TEST và có teardown dữ liệu.
    // Chạy tuần tự theo file để notification/audit của một flow không chen vào flow khác.
    fileParallelism: false,
  },
});
