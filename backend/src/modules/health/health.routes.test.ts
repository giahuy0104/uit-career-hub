import type { Pool } from "pg";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";

describe("health routes", () => {
  it("should_return_connected_when_database_query_succeeds", async () => {
    const database = {
      query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
    } as unknown as Pick<Pool, "query">;

    const response = await request(createApp({ database })).get("/api/health/database");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: "ok", database: "connected" });
    expect(database.query).toHaveBeenCalledWith("SELECT 1");
  });

  it("should_return_degraded_without_leaking_connection_details", async () => {
    const database = {
      query: vi.fn().mockRejectedValue(new Error("password=secret")),
    } as unknown as Pick<Pool, "query">;

    const response = await request(createApp({ database })).get("/api/health/database");

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: "degraded", database: "unavailable" });
    expect(response.text).not.toContain("secret");
  });
});
