import { describe, expect, it, vi } from "vitest";

import {
  redactString,
  sanitizeLogFields,
  serializeError,
  StructuredLogger,
} from "./structured-logger.js";

describe("structured logger", () => {
  it("redacts credentials, bearer tokens, JWTs and presigned query values", () => {
    const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature";
    const value = redactString(
      `Bearer access-token ${jwt} postgresql://user:password@db.example/app?sslmode=require https://r2.test/file?X-Amz-Signature=secret-value`,
    );

    expect(value).not.toContain("access-token");
    expect(value).not.toContain(jwt);
    expect(value).not.toContain("user:password");
    expect(value).not.toContain("secret-value");
    expect(value).toContain("[REDACTED]");
  });

  it("redacts sensitive keys recursively and handles circular values", () => {
    const fields: Record<string, unknown> = {
      traceId: "trace-1",
      authorization: "Bearer secret",
      nested: { password: "Password@123", storageKey: "private/object" },
    };
    fields.circular = fields;

    expect(sanitizeLogFields(fields)).toEqual({
      traceId: "trace-1",
      authorization: "[REDACTED]",
      nested: { password: "[REDACTED]", storageKey: "[REDACTED]" },
      circular: "[CIRCULAR]",
    });
  });

  it("emits one JSON record with a sanitized error", () => {
    const writer = vi.fn();
    const logger = new StructuredLogger(writer);

    logger.error("unhandled_request_error", {
      traceId: "trace-1",
      error: serializeError(new Error("password=super-secret")),
    });

    expect(writer).toHaveBeenCalledTimes(1);
    const [level, line] = writer.mock.calls[0]!;
    expect(level).toBe("error");
    const record = JSON.parse(line);
    expect(record).toMatchObject({
      level: "error",
      event: "unhandled_request_error",
      traceId: "trace-1",
    });
    expect(line).not.toContain("super-secret");
  });
});
