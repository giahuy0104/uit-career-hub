import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { requestContext } from "./request-context.js";

function app() {
  const instance = express();
  instance.use(requestContext);
  instance.get("/trace", (_request, response) => {
    response.json({ traceId: response.locals.traceId });
  });
  return instance;
}

describe("request context", () => {
  it("keeps a safe caller-provided request id", async () => {
    const response = await request(app()).get("/trace").set("x-request-id", "client.trace-1:abc");

    expect(response.headers["x-request-id"]).toBe("client.trace-1:abc");
    expect(response.body.traceId).toBe("client.trace-1:abc");
  });

  it("replaces unsafe or oversized request ids with a UUID", async () => {
    for (const requestId of ["contains spaces", `a${"x".repeat(128)}`]) {
      const response = await request(app()).get("/trace").set("x-request-id", requestId);
      expect(response.headers["x-request-id"]).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    }
  });
});
