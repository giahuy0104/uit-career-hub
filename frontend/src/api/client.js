const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const error = new Error(payload?.error?.message || "Không thể kết nối đến hệ thống.");
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.traceId = payload?.error?.traceId;
    throw error;
  }

  return payload;
}
