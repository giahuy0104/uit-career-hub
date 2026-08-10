import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowCounterClockwise,
  CheckCircle,
  CircleNotch,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Tag,
  Warning,
  X,
} from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { EmptyHint, MetricCard, Panel, Status } from "../shared/WorkspaceShell.jsx";

const kindCopy = {
  categories: {
    singular: "nhóm ngành",
    title: "Nhóm ngành nghề",
    keyField: "code",
    keyLabel: "Mã nhóm ngành",
    keyPlaceholder: "SOFTWARE_ENGINEERING",
    helper: "Mã viết hoa, dùng dấu gạch dưới và không đổi sau khi tạo.",
  },
  skills: {
    singular: "kỹ năng",
    title: "Kỹ năng",
    keyField: "slug",
    keyLabel: "Slug kỹ năng",
    keyPlaceholder: "react-native",
    helper: "Slug viết thường, ngăn cách bằng dấu gạch ngang và không đổi sau khi tạo.",
  },
};

function apiError(error) {
  return error?.message || "Không thể kết nối đến hệ thống. Vui lòng thử lại.";
}

function formatDateTime(value) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "—";
}

function normalizeKey(kind, value) {
  return kind === "categories"
    ? value.trim().toUpperCase()
    : value.trim().toLowerCase();
}

function validKey(kind, value) {
  return kind === "categories"
    ? /^[A-Z0-9_]{2,50}$/.test(normalizeKey(kind, value))
    : /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizeKey(kind, value));
}

function TaxonomyFormModal({ kind, item, busy, error, onClose, onSubmit }) {
  const copy = kindCopy[kind];
  const [name, setName] = useState(item?.name || "");
  const [keyValue, setKeyValue] = useState(item?.[copy.keyField] || "");
  const editing = Boolean(item);
  const valid = name.trim().length >= 2 && (editing || validKey(kind, keyValue));

  const submit = (event) => {
    event.preventDefault();
    if (!valid) return;
    onSubmit(editing
      ? { name: name.trim(), expectedVersion: item.version }
      : { [copy.keyField]: normalizeKey(kind, keyValue), name: name.trim() });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal portal-modal taxonomy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-form-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button>
        <span className="modal-icon"><Tag /></span>
        <h2 id="taxonomy-form-title">{editing ? `Đổi tên ${copy.singular}` : `Thêm ${copy.singular}`}</h2>
        <p>{editing ? "Mã định danh được giữ nguyên để bảo toàn dữ liệu đã tham chiếu." : "Mục mới sẽ hoạt động ngay và sẵn sàng để gắn vào tin tuyển dụng."}</p>
        <div className="modal-form taxonomy-form">
          <label>
            <span>{copy.keyLabel} *</span>
            <input
              autoFocus={!editing}
              disabled={editing || busy}
              value={keyValue}
              placeholder={copy.keyPlaceholder}
              onChange={(event) => setKeyValue(event.target.value)}
              aria-describedby="taxonomy-key-help"
            />
            <small id="taxonomy-key-help">{copy.helper}</small>
          </label>
          <label>
            <span>Tên hiển thị *</span>
            <input
              autoFocus={editing}
              disabled={busy}
              value={name}
              maxLength={120}
              placeholder={kind === "categories" ? "Kỹ thuật phần mềm" : "React Native"}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        </div>
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className="primary-button" disabled={!valid || busy}>
            {busy ? <><CircleNotch className="spin" />Đang lưu</> : <><CheckCircle />{editing ? "Lưu thay đổi" : "Tạo mới"}</>}
          </button>
        </div>
      </form>
    </div>
  );
}

function TaxonomyStateModal({ kind, item, busy, error, onClose, onSubmit }) {
  const reactivating = item.status === "INACTIVE";
  const [reason, setReason] = useState(reactivating ? "Đã hoàn tất đối chiếu và có thể sử dụng lại." : "Mục này không còn phù hợp với danh mục hiện hành.");
  const action = reactivating ? "Kích hoạt lại" : "Ngừng hoạt động";

  const submit = (event) => {
    event.preventDefault();
    if (reason.trim().length < 5) return;
    onSubmit({ expectedVersion: item.version, reason: reason.trim() });
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form
        className="modal portal-modal taxonomy-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="taxonomy-state-title"
        onMouseDown={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <button type="button" className="modal-close" aria-label="Đóng" onClick={onClose} disabled={busy}><X /></button>
        <span className={`modal-icon ${reactivating ? "" : "danger"}`}>{reactivating ? <ArrowCounterClockwise /> : <Archive />}</span>
        <h2 id="taxonomy-state-title">{action} “{item.name}”?</h2>
        <p>{reactivating
          ? `Mục này sẽ xuất hiện lại trong danh sách ${kindCopy[kind].singular} có thể sử dụng.`
          : "Dữ liệu lịch sử vẫn được giữ nguyên. Hệ thống sẽ từ chối nếu còn tin chưa kết thúc đang sử dụng mục này."}</p>
        <div className="modal-form">
          <label>
            <span>Lý do *</span>
            <textarea autoFocus disabled={busy} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
          </label>
        </div>
        {error && <p className="form-error" role="alert"><Warning />{error}</p>}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose} disabled={busy}>Hủy</button>
          <button className={`primary-button ${reactivating ? "" : "danger-fill"}`} disabled={busy || reason.trim().length < 5}>
            {busy ? <><CircleNotch className="spin" />Đang xử lý</> : action}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AdminTaxonomyManagement() {
  const { authorizedRequest } = useAuth();
  const [kind, setKind] = useState("categories");
  const [query, setQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState({ data: [], meta: { totalItems: 0 } });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const [version, setVersion] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page: "1", pageSize: "100" });
    if (appliedQuery) params.set("query", appliedQuery);
    if (status) params.set("status", status);
    try {
      setResult(await authorizedRequest(`/uit/taxonomy/${kind}?${params}`));
    } catch (requestError) {
      setError(apiError(requestError));
    } finally {
      setLoading(false);
    }
  }, [appliedQuery, authorizedRequest, kind, status, version]);

  useEffect(() => { void load(); }, [load]);

  const metrics = useMemo(() => ({
    active: result.data.filter((item) => item.status === "ACTIVE").length,
    inactive: result.data.filter((item) => item.status === "INACTIVE").length,
    inUse: result.data.filter((item) => item.openJobCount > 0).length,
  }), [result.data]);

  const changeKind = (nextKind) => {
    setKind(nextKind);
    setQuery("");
    setAppliedQuery("");
    setStatus("");
    setMessage("");
    setModal(null);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setAppliedQuery(query.trim());
  };

  const execute = async (payload) => {
    setBusy(true);
    setModalError("");
    const item = modal.item;
    const stateAction = modal.type === "state"
      ? (item.status === "ACTIVE" ? "archive" : "reactivate")
      : null;
    const path = modal.type === "create"
      ? `/uit/taxonomy/${kind}`
      : modal.type === "edit"
        ? `/uit/taxonomy/${kind}/${item.id}`
        : `/uit/taxonomy/${kind}/${item.id}/${stateAction}`;
    const method = modal.type === "edit" ? "PATCH" : "POST";
    try {
      await authorizedRequest(path, { method, body: JSON.stringify(payload) });
      const actionMessage = modal.type === "create"
        ? `Đã tạo ${kindCopy[kind].singular} mới.`
        : modal.type === "edit"
          ? `Đã cập nhật tên ${kindCopy[kind].singular}.`
          : item.status === "ACTIVE"
            ? `Đã ngừng hoạt động ${kindCopy[kind].singular}.`
            : `Đã kích hoạt lại ${kindCopy[kind].singular}.`;
      setModal(null);
      setMessage(actionMessage);
      setVersion((value) => value + 1);
    } catch (requestError) {
      setModalError(apiError(requestError));
    } finally {
      setBusy(false);
    }
  };

  const clearFilters = () => {
    setQuery("");
    setAppliedQuery("");
    setStatus("");
  };

  return (
    <>
      {message && <div className="toast" role="status"><CheckCircle weight="fill" />{message}</div>}
      <div className="taxonomy-tabs" role="tablist" aria-label="Loại danh mục">
        {Object.entries(kindCopy).map(([key, copy]) => (
          <button
            type="button"
            key={key}
            role="tab"
            aria-selected={kind === key}
            className={kind === key ? "active" : ""}
            onClick={() => changeKind(key)}
          >
            <Tag />{copy.title}
          </button>
        ))}
      </div>

      <div className="metric-grid three taxonomy-metrics">
        <MetricCard label="Đang hoạt động" value={metrics.active} helper="Có thể dùng cho tin mới" Icon={CheckCircle} tone="green" />
        <MetricCard label="Ngừng hoạt động" value={metrics.inactive} helper="Chỉ giữ cho dữ liệu lịch sử" Icon={Archive} tone="amber" />
        <MetricCard label="Đang được sử dụng" value={metrics.inUse} helper="Có tin chưa kết thúc tham chiếu" Icon={Tag} />
      </div>

      <Panel
        title={kindCopy[kind].title}
        action={<button type="button" className="primary-button" onClick={() => { setModal({ type: "create" }); setModalError(""); }}><Plus />Thêm mới</button>}
        className="taxonomy-panel"
      >
        <div className="taxonomy-toolbar">
          <form className="portal-search" onSubmit={submitSearch}>
            <MagnifyingGlass />
            <input
              aria-label={`Tìm ${kindCopy[kind].title.toLocaleLowerCase("vi-VN")}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Tìm theo tên hoặc ${kindCopy[kind].keyLabel.toLocaleLowerCase("vi-VN")}...`}
            />
            <button className="secondary-button small">Tìm</button>
          </form>
          <label>
            <span>Trạng thái</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </label>
          {(appliedQuery || status) && <button type="button" className="link-button" onClick={clearFilters}>Xóa bộ lọc</button>}
        </div>

        {loading ? (
          <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải danh mục...</div>
        ) : error ? (
          <div className="portal-error" role="alert"><Warning />{error}<button className="secondary-button small" onClick={() => void load()}>Thử lại</button></div>
        ) : result.data.length === 0 ? (
          <EmptyHint icon={Tag} title="Không có dữ liệu phù hợp" text="Hãy đổi bộ lọc hoặc thêm mục mới để bắt đầu." />
        ) : (
          <div className="taxonomy-table" data-testid={`taxonomy-${kind}-table`}>
            <div className="taxonomy-table-head">
              <span>Tên hiển thị</span><span>Mã ổn định</span><span>Trạng thái</span><span>Sử dụng</span><span>Cập nhật</span><span>Thao tác</span>
            </div>
            {result.data.map((item) => {
              const itemKey = item[kindCopy[kind].keyField];
              return (
                <div className="taxonomy-row" key={item.id}>
                  <span><strong>{item.name}</strong><small>Phiên bản {item.version}</small></span>
                  <code>{itemKey}</code>
                  <Status tone={item.status === "ACTIVE" ? "success" : "neutral"}>{item.status === "ACTIVE" ? "Đang hoạt động" : "Ngừng hoạt động"}</Status>
                  <span><strong>{item.openJobCount} đang mở</strong><small>{item.jobCount} tin tổng cộng</small></span>
                  <time dateTime={item.updatedAt}>{formatDateTime(item.updatedAt)}</time>
                  <span className="taxonomy-actions">
                    <button type="button" aria-label={`Đổi tên ${item.name}`} title="Đổi tên" onClick={() => { setModal({ type: "edit", item }); setModalError(""); }}><PencilSimple /></button>
                    <button
                      type="button"
                      aria-label={item.status === "ACTIVE" ? `Ngừng hoạt động ${item.name}` : `Kích hoạt lại ${item.name}`}
                      title={item.status === "ACTIVE" && item.openJobCount > 0 ? "Còn tin chưa kết thúc đang sử dụng" : item.status === "ACTIVE" ? "Ngừng hoạt động" : "Kích hoạt lại"}
                      disabled={item.status === "ACTIVE" && item.openJobCount > 0}
                      onClick={() => { setModal({ type: "state", item }); setModalError(""); }}
                    >
                      {item.status === "ACTIVE" ? <Archive /> : <ArrowCounterClockwise />}
                    </button>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {(modal?.type === "create" || modal?.type === "edit") && (
        <TaxonomyFormModal kind={kind} item={modal.item} busy={busy} error={modalError} onClose={() => { if (!busy) setModal(null); }} onSubmit={(payload) => void execute(payload)} />
      )}
      {modal?.type === "state" && (
        <TaxonomyStateModal kind={kind} item={modal.item} busy={busy} error={modalError} onClose={() => { if (!busy) setModal(null); }} onSubmit={(payload) => void execute(payload)} />
      )}
    </>
  );
}
