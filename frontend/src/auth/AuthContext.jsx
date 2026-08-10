import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiRequest, apiResponse } from "../api/client.js";

const AuthContext = createContext(null);
let sharedRefreshPromise = null;

function requestRefresh() {
  if (!sharedRefreshPromise) {
    sharedRefreshPromise = apiRequest("/auth/refresh", { method: "POST" })
      .finally(() => {
        sharedRefreshPromise = null;
      });
  }
  return sharedRefreshPromise;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    try {
      const response = await requestRefresh();
      setSession(response.data);
      return response.data;
    } catch (error) {
      setSession(null);
      if (!silent && error.status !== 401) throw error;
      return null;
    }
  }, []);

  useEffect(() => {
    refresh({ silent: true }).finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!session?.expiresIn) return undefined;
    const refreshAfter = Math.max((session.expiresIn - 60) * 1000, 30_000);
    const timer = window.setTimeout(() => void refresh({ silent: true }), refreshAfter);
    return () => window.clearTimeout(timer);
  }, [session, refresh]);

  const login = useCallback(async (email, password) => {
    const response = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setSession(response.data);
    return response.data;
  }, []);

  const activateCompanyAccount = useCallback(async (token, password) => {
    await apiRequest("/auth/company-activation", {
      method: "POST",
      body: JSON.stringify({ token, password, acceptedTerms: true }),
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setSession(null);
    }
  }, []);

  const authorizedRequest = useCallback(async (path, options = {}) => {
    if (!session?.accessToken) {
      throw new Error("Vui lòng đăng nhập để tiếp tục.");
    }
    try {
      return await apiRequest(path, {
        ...options,
        headers: {
          ...options.headers,
          authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch (error) {
      if (error.status !== 401) throw error;
      const renewed = await refresh();
      if (!renewed) throw error;
      return apiRequest(path, {
        ...options,
        headers: {
          ...options.headers,
          authorization: `Bearer ${renewed.accessToken}`,
        },
      });
    }
  }, [session, refresh]);

  const authorizedResponse = useCallback(async (path, options = {}) => {
    if (!session?.accessToken) {
      throw new Error("Vui lòng đăng nhập để tiếp tục.");
    }
    try {
      return await apiResponse(path, {
        ...options,
        headers: {
          ...options.headers,
          authorization: `Bearer ${session.accessToken}`,
        },
      });
    } catch (error) {
      if (error.status !== 401) throw error;
      const renewed = await refresh();
      if (!renewed) throw error;
      return apiResponse(path, {
        ...options,
        headers: {
          ...options.headers,
          authorization: `Bearer ${renewed.accessToken}`,
        },
      });
    }
  }, [session, refresh]);

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
    login,
    activateCompanyAccount,
    logout,
    refresh,
    authorizedRequest,
    authorizedResponse,
  }), [session, loading, login, activateCompanyAccount, logout, refresh, authorizedRequest, authorizedResponse]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong AuthProvider.");
  return context;
}
