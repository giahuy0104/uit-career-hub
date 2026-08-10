const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";
export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");

export async function apiResponse(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const isJson = response.headers.get("content-type")?.includes("application/json");
    const payload = isJson ? await response.json() : null;
    const error = new Error(payload?.error?.message || "Không thể kết nối đến hệ thống.");
    error.code = payload?.error?.code || "REQUEST_FAILED";
    error.status = response.status;
    error.traceId = payload?.error?.traceId;
    throw error;
  }

  return response;
}

export async function apiRequest(path, options = {}) {
  const response = await apiResponse(path, options);
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return isJson ? response.json() : null;
}
