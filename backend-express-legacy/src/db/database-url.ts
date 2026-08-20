export type DatabaseProvider = "neon" | "postgresql";

function parseDatabaseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    throw new Error("Connection string PostgreSQL không hợp lệ.");
  }
}

export function getDatabaseProvider(value: string): DatabaseProvider {
  return parseDatabaseUrl(value).hostname.endsWith(".neon.tech") ? "neon" : "postgresql";
}

export function isLocalDatabaseUrl(value: string) {
  const hostname = parseDatabaseUrl(value).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function resolveMigrationDatabaseUrl(runtimeUrl: string, directUrl?: string) {
  if (directUrl) {
    return directUrl;
  }

  if (isLocalDatabaseUrl(runtimeUrl)) {
    return runtimeUrl;
  }

  const parsed = parseDatabaseUrl(runtimeUrl);
  if (parsed.hostname.endsWith(".neon.tech") && parsed.hostname.includes("-pooler")) {
    throw new Error(
      "Thiếu DATABASE_URL_DIRECT. Migration Neon không được chạy bằng pooled connection string.",
    );
  }

  return runtimeUrl;
}
