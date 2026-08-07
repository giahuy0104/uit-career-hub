import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext.jsx";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, authorizedRequest } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      setUnreadCount(0);
      return 0;
    }
    try {
      const response = await authorizedRequest("/notifications/unread-count");
      const count = response?.data?.count ?? 0;
      setUnreadCount(count);
      return count;
    } catch {
      setUnreadCount(0);
      return 0;
    }
  }, [authorizedRequest, userId]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  const markOneReadLocally = useCallback(() => {
    setUnreadCount((current) => Math.max(0, current - 1));
  }, []);

  const markAllReadLocally = useCallback(() => setUnreadCount(0), []);

  const value = useMemo(() => ({
    unreadCount,
    refreshUnreadCount,
    markOneReadLocally,
    markAllReadLocally,
  }), [unreadCount, refreshUnreadCount, markOneReadLocally, markAllReadLocally]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications phải được dùng bên trong NotificationProvider.");
  return context;
}
