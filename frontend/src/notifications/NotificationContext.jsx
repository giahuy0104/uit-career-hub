import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "../auth/AuthContext.jsx";
import { consumeNotificationStream } from "./notification-stream.js";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, authorizedRequest, authorizedResponse } = useAuth();
  const userId = user?.id;
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationRevision, setNotificationRevision] = useState(0);
  const lastUnreadCount = useRef(null);
  const streamCursor = useRef(null);

  const applyUnreadCount = useCallback((value, notify = false) => {
    const count = Math.max(0, Number(value) || 0);
    const changed = lastUnreadCount.current !== null && lastUnreadCount.current !== count;
    lastUnreadCount.current = count;
    setUnreadCount(count);
    if (notify && changed) setNotificationRevision((current) => current + 1);
    return count;
  }, []);

  const refreshUnreadCount = useCallback(async () => {
    if (!userId) {
      applyUnreadCount(0);
      return 0;
    }
    try {
      const response = await authorizedRequest("/notifications/unread-count");
      const count = response?.data?.count ?? 0;
      return applyUnreadCount(count, true);
    } catch {
      return lastUnreadCount.current ?? 0;
    }
  }, [applyUnreadCount, authorizedRequest, userId]);

  const receiveSnapshot = useCallback((payload, eventId) => {
    const count = Math.max(0, Number(payload?.unreadCount) || 0);
    const nextCursor = payload?.cursor || eventId || null;
    const cursorChanged = streamCursor.current !== null
      && nextCursor !== null
      && streamCursor.current !== nextCursor;
    const countChanged = lastUnreadCount.current !== null && lastUnreadCount.current !== count;

    streamCursor.current = nextCursor;
    lastUnreadCount.current = count;
    setUnreadCount(count);
    if (cursorChanged || countChanged) {
      setNotificationRevision((current) => current + 1);
    }
  }, []);

  useEffect(() => {
    lastUnreadCount.current = null;
    streamCursor.current = null;
    setUnreadCount(0);
    setNotificationRevision((current) => current + 1);
  }, [userId]);

  useEffect(() => {
    void refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (!userId) return undefined;

    let stopped = false;
    let controller = null;
    let reconnectTimer = null;
    let retryDelay = 1_000;

    const connect = async () => {
      controller = new AbortController();
      try {
        const response = await authorizedResponse("/notifications/stream", {
          headers: { accept: "text/event-stream" },
          signal: controller.signal,
        });
        retryDelay = 1_000;
        await consumeNotificationStream(response, (message) => {
          if (message.event !== "notifications") return;
          try {
            receiveSnapshot(JSON.parse(message.data), message.id);
          } catch {
            // Bỏ qua một event lỗi; kết nối vẫn tiếp tục nhận event kế tiếp.
          }
        });
      } catch (error) {
        if (stopped || error?.name === "AbortError") return;
        await refreshUnreadCount();
      }

      if (stopped) return;
      reconnectTimer = window.setTimeout(() => void connect(), retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10_000);
    };

    const refreshWhenActive = () => {
      if (!document.hidden) void refreshUnreadCount();
    };

    void connect();
    const fallbackTimer = window.setInterval(() => void refreshUnreadCount(), 30_000);
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      stopped = true;
      controller?.abort();
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(fallbackTimer);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
    };
  }, [authorizedResponse, receiveSnapshot, refreshUnreadCount, userId]);

  const markOneReadLocally = useCallback(() => {
    setUnreadCount((current) => {
      const next = Math.max(0, current - 1);
      lastUnreadCount.current = next;
      return next;
    });
  }, []);

  const markAllReadLocally = useCallback(() => {
    lastUnreadCount.current = 0;
    setUnreadCount(0);
  }, []);

  const value = useMemo(() => ({
    unreadCount,
    notificationRevision,
    refreshUnreadCount,
    markOneReadLocally,
    markAllReadLocally,
  }), [unreadCount, notificationRevision, refreshUnreadCount, markOneReadLocally, markAllReadLocally]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications phải được dùng bên trong NotificationProvider.");
  return context;
}
