import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Bell,
  Briefcase,
  CalendarCheck,
  CheckCircle,
  CircleNotch,
  FileText,
  ShieldCheck,
  Warning,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { useNotifications } from "./NotificationContext.jsx";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function notificationTone(type = "") {
  if (/REJECT|FAILED|DECLINED|REVISION|SUPPLEMENT|REMINDER/.test(type)) return "warning";
  if (/APPROVED|FORWARDED|ACCEPTED|HIRED|CONFIRMED|PASS/.test(type)) return "success";
  if (/INTERVIEW/.test(type)) return "calendar";
  if (/JOB/.test(type)) return "job";
  if (/APPLICATION|OFFER|PLACEMENT/.test(type)) return "application";
  return "info";
}

function NoticeIcon({ type }) {
  const tone = notificationTone(type);
  if (tone === "warning") return <Warning />;
  if (tone === "success") return <CheckCircle />;
  if (tone === "calendar") return <CalendarCheck />;
  if (tone === "job") return <Briefcase />;
  if (tone === "application") return <FileText />;
  return <ShieldCheck />;
}

export function notificationRoute(role, notification) {
  const link = notification.deepLink || "";
  const type = notification.type || "";
  if (role === "admin") {
    if (link.includes("/uit/jobs") || notification.resourceType === "JOB_POST") return "admin-jobs";
    if (link.includes("/uit/student-documents") || notification.resourceType === "STUDENT_DOCUMENT") return "admin-documents";
    if (link.includes("/placements") || /PLACEMENT|HIRED/.test(type)) return "admin-placements";
    if (link.includes("/uit/applications") || notification.resourceType === "APPLICATION") return "admin-applications";
    return "admin-dashboard";
  }
  if (role === "company") {
    if (link.includes("/company/jobs") || notification.resourceType === "JOB_POST") return "company-jobs";
    if (link.includes("/interview") || /INTERVIEW/.test(type)) return "company-interviews";
    if (link.includes("/company/candidates") || notification.resourceType === "APPLICATION") return "company-candidates";
    return "company-dashboard";
  }
  if (link.includes("/interview") || /INTERVIEW/.test(type)) return "interviews";
  if (link.includes("/profile") || notification.resourceType === "STUDENT_DOCUMENT") return "profile";
  if (link.includes("/applications") || notification.resourceType === "APPLICATION") return "applications";
  if (link.includes("/jobs") || notification.resourceType === "JOB_POST") return "jobs";
  return "dashboard";
}

export function NotificationInbox({ role, onOpen }) {
  const { authorizedRequest } = useAuth();
  const { unreadCount, markOneReadLocally, markAllReadLocally, refreshUnreadCount } = useNotifications();
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ page: 1, totalPages: 1, totalItems: 0 });
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await authorizedRequest(
        `/notifications?page=${page}&pageSize=20&unreadOnly=${unreadOnly}`,
      );
      setItems(response.data);
      setMeta(response.meta);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, [authorizedRequest, page, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openNotification = async (notification) => {
    setError("");
    if (!notification.readAt) {
      try {
        await authorizedRequest(`/notifications/${notification.id}/read`, { method: "POST" });
        setItems((current) => unreadOnly
          ? current.filter((item) => item.id !== notification.id)
          : current.map((item) => item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item));
        if (unreadOnly) {
          setMeta((current) => ({ ...current, totalItems: Math.max(0, current.totalItems - 1) }));
        }
        markOneReadLocally();
      } catch (requestError) {
        setError(requestError.message);
        return;
      }
    }
    onOpen?.(notification, notificationRoute(role, notification));
  };

  const markAllRead = async () => {
    setBusy(true);
    setError("");
    try {
      await authorizedRequest("/notifications/read-all", { method: "POST" });
      setItems((current) => current.map((item) => ({
        ...item,
        readAt: item.readAt || new Date().toISOString(),
      })));
      markAllReadLocally();
      if (unreadOnly) await load();
    } catch (requestError) {
      setError(requestError.message);
      await refreshUnreadCount();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="portal-panel notification-inbox">
      <header className="notification-inbox-header">
        <div><h2>Hộp thông báo</h2><small>{meta.totalItems} thông báo trong bộ lọc hiện tại</small></div>
        <button className="link-button" disabled={busy || unreadCount === 0} onClick={() => void markAllRead()}>
          {busy ? <CircleNotch className="spin" /> : <CheckCircle />}Đánh dấu tất cả đã đọc
        </button>
      </header>
      <div className="notification-filters" role="group" aria-label="Lọc thông báo">
        <button className={!unreadOnly ? "active" : ""} onClick={() => { setPage(1); setUnreadOnly(false); }}>Tất cả</button>
        <button className={unreadOnly ? "active" : ""} onClick={() => { setPage(1); setUnreadOnly(true); }}>Chưa đọc</button>
        <button className="refresh" onClick={() => void load()}>Làm mới</button>
      </div>
      {error && <p className="notification-error"><Warning />{error}</p>}
      {loading ? (
        <div className="portal-loading"><CircleNotch className="spin" />Đang tải thông báo...</div>
      ) : !items.length ? (
        <div className="notification-empty"><Bell size={34} /><strong>Không có thông báo</strong><p>Các cập nhật mới của quy trình sẽ xuất hiện tại đây.</p></div>
      ) : (
        <div className="notification-list live-notifications">
          {items.map((notification) => {
            const tone = notificationTone(notification.type);
            return <button key={notification.id} className={notification.readAt ? "read" : ""} onClick={() => void openNotification(notification)}>
              <span className={`notice-symbol ${tone}`}><NoticeIcon type={notification.type} /></span>
              <div><strong>{notification.title}</strong><p>{notification.body}</p><small>{dateFormatter.format(new Date(notification.createdAt))}</small></div>
              {!notification.readAt && <i aria-label="Chưa đọc" />}
              <ArrowRight className="notice-arrow" />
            </button>;
          })}
        </div>
      )}
      {meta.totalPages > 1 && <footer className="notification-pagination"><button disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)}>Trước</button><span>Trang {page}/{meta.totalPages}</span><button disabled={page >= meta.totalPages || loading} onClick={() => setPage((current) => current + 1)}>Sau</button></footer>}
    </section>
  );
}
