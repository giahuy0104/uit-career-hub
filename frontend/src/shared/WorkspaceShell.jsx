import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  Bell,
  HandWaving,
  Info,
  MagnifyingGlass,
  SealCheck,
  SignOut,
} from "@phosphor-icons/react";

import { useNotifications } from "../notifications/NotificationContext.jsx";
import { findQuickNavigationTarget, getWorkspaceConfig } from "./workspace-config.js";

function Brand({ inverse = false }) {
  return <div className={`portal-brand ${inverse ? "inverse" : ""}`}><span><SealCheck size={27} weight="duotone" /></span><div><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></div></div>;
}

export function userInitials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join("").toUpperCase() || "UIT";
}

export function WorkspaceShell({ role, route, navigate, children, title, description, actions, user, onLogout }) {
  const { unreadCount } = useNotifications();
  const { fallbackIdentity, navigation, notificationRoute } = getWorkspaceConfig(role);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickMessage, setQuickMessage] = useState("");
  const [accountOpen, setAccountOpen] = useState(false);
  const quickListId = useId();
  const accountMenuId = useId();
  const accountButtonRef = useRef(null);
  const contentRef = useRef(null);
  const navigationRef = useRef(null);
  const identity = {
    ...fallbackIdentity,
    name: user?.displayName || fallbackIdentity.name,
    meta: user?.organization || user?.email || fallbackIdentity.meta,
    initials: userInitials(user?.displayName || fallbackIdentity.name),
  };
  const isStudentInternship = role === "student" && route === "internships";

  useEffect(() => {
    setAccountOpen(false);
    setQuickMessage("");
    contentRef.current?.focus({ preventScroll: true });
    const scrollFrame = window.requestAnimationFrame(() => {
      if (!window.matchMedia("(max-width: 900px)").matches) return;
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      navigationRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    });
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [route]);

  useEffect(() => {
    if (!accountOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key !== "Escape") return;
      setAccountOpen(false);
      accountButtonRef.current?.focus();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [accountOpen]);

  const submitQuickNavigation = (event) => {
    event.preventDefault();
    const target = findQuickNavigationTarget(role, quickQuery);
    if (!target) {
      setQuickMessage("Không tìm thấy màn hình phù hợp.");
      return;
    }
    setQuickQuery("");
    setQuickMessage("");
    navigate(target.key);
  };

  return (
    <div className={`workspace-shell role-${role} route-${route}`}>
      <a className="skip-link" href="#workspace-content">Bỏ qua điều hướng</a>
      <aside className="workspace-sidebar">
        <Brand inverse />
        <div className="workspace-role"><small>KHÔNG GIAN LÀM VIỆC</small><strong>{identity.label}</strong></div>
        <nav ref={navigationRef} aria-label={`Điều hướng ${identity.label.toLocaleLowerCase("vi-VN")}`}>{navigation.map(({ key, label, Icon, count }) => { const displayCount = key === notificationRoute ? unreadCount : count; return <button key={key} aria-current={route === key ? "page" : undefined} className={route === key ? "active" : ""} onClick={() => navigate(key)}><Icon size={20} /><span>{label}</span>{displayCount ? <i>{displayCount > 99 ? "99+" : displayCount}</i> : null}</button>; })}</nav>
        <div className="workspace-identity"><span>{identity.initials}</span><div><strong>{identity.name}</strong><small>{identity.meta}</small></div><button aria-label="Đăng xuất" onClick={onLogout}><SignOut size={19} /></button></div>
      </aside>
      <main className="workspace-main" id="workspace-content" ref={contentRef} tabIndex="-1">
        <header className="workspace-topbar">
          {isStudentInternship
            ? <div className="workspace-greeting"><strong>Xin chào, <span>{identity.name}</span></strong><HandWaving size={18} weight="duotone" /><small>Ghi lại hành trình thực tập và phát triển mỗi ngày.</small></div>
            : <div aria-label="Đường dẫn hiện tại"><span>UIT Career Hub</span><ArrowRight size={13} /><strong>{title}</strong></div>}
          <div className="workspace-top-actions">
            {!isStudentInternship && <form className="workspace-quick-nav" onSubmit={submitQuickNavigation}>
              <MagnifyingGlass size={18} />
              <input aria-label="Đi nhanh đến màn hình" list={quickListId} value={quickQuery} onChange={(event) => setQuickQuery(event.target.value)} placeholder="Đi đến màn hình..." />
              <datalist id={quickListId}>{navigation.map(({ key, label }) => <option key={key} value={label} />)}</datalist>
              <button type="submit" aria-label="Mở màn hình đã nhập"><ArrowRight size={16} /></button>
            </form>}
            <button className="icon-button notification-bell" aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ""}`} onClick={() => navigate(notificationRoute)}><Bell size={20} />{unreadCount > 0 && <span>{unreadCount > 99 ? "99+" : unreadCount}</span>}</button>
            <div className="workspace-account">
              <button ref={accountButtonRef} className="workspace-avatar" aria-label="Mở menu tài khoản" aria-expanded={accountOpen} aria-controls={accountMenuId} onClick={() => setAccountOpen((open) => !open)}>{identity.initials}</button>
              {accountOpen && <div className="workspace-account-menu" id={accountMenuId} role="menu"><strong>{identity.name}</strong><small>{user?.email || identity.meta}</small><button role="menuitem" onClick={onLogout}><SignOut size={16} />Đăng xuất</button></div>}
            </div>
          </div>
          {quickMessage && <p className="workspace-quick-message" role="status">{quickMessage}</p>}
        </header>
        {!isStudentInternship && <section className="workspace-page-header"><div><p className="eyebrow">{identity.label.toUpperCase()}</p><h1>{title}</h1>{description && <p>{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</section>}
        <div className="workspace-page">{children}</div>
      </main>
    </div>
  );
}

export function MetricCard({ label, value, helper, Icon, tone = "blue" }) {
  return <article className={`metric-card ${tone}`}><span className="metric-icon"><Icon size={22} weight="duotone" /></span><div><small>{label}</small><strong>{value}</strong><p>{helper}</p></div></article>;
}

export function Status({ children, tone = "neutral" }) {
  return <span className={`portal-status ${tone}`}>{children}</span>;
}

export function Panel({ title, action, children, className = "" }) {
  return <section className={`portal-panel ${className}`}><header><h2>{title}</h2>{action}</header>{children}</section>;
}

export function EmptyHint({ icon: Icon = Info, title, text }) {
  return <div className="empty-hint"><Icon size={30} /><strong>{title}</strong><p>{text}</p></div>;
}
