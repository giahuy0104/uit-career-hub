import { useEffect, useState } from "react";
import { CheckCircle, CircleNotch, Warning } from "@phosphor-icons/react";

import { useAuth } from "../auth/AuthContext.jsx";
import { TagPicker } from "../shared/TagPicker.jsx";
import { Panel } from "../shared/WorkspaceShell.jsx";
import "./job-match.css";

const opportunityOptions = [
  { id: "INTERNSHIP", name: "Thực tập" },
  { id: "FRESHER", name: "Fresher" },
  { id: "FULL_TIME", name: "Toàn thời gian" },
  { id: "PART_TIME", name: "Bán thời gian" },
];

const toForm = (preferences) => ({
  skillIds: preferences.skills.map((item) => item.id),
  categoryIds: preferences.categories.map((item) => item.id),
  opportunityTypes: preferences.opportunityTypes,
});

/** Skills and interests used to rank jobs for the student. */
export function JobPreferencesPanel() {
  const { authorizedRequest } = useAuth();
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(null);
  const [savedForm, setSavedForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let ignore = false;
    setError("");
    Promise.all([authorizedRequest("/taxonomy/options"), authorizedRequest("/students/me/job-preferences")])
      .then(([optionResponse, preferenceResponse]) => {
        if (ignore) return;
        setOptions(optionResponse.data);
        setForm(toForm(preferenceResponse.data));
        setSavedForm(toForm(preferenceResponse.data));
      })
      .catch((requestError) => { if (!ignore) setError(requestError?.message || "Không thể tải kỹ năng."); });
    return () => { ignore = true; };
  }, [authorizedRequest, reload]);

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(savedForm);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await authorizedRequest("/students/me/job-preferences", { method: "PUT", body: JSON.stringify(form) });
      setForm(toForm(response.data));
      setSavedForm(toForm(response.data));
    } catch (requestError) {
      setError(requestError?.message || "Không thể lưu kỹ năng.");
    } finally {
      setBusy(false);
    }
  };

  if (!form) return <Panel title="Kỹ năng & mong muốn">{error
    ? <div className="portal-error" role="alert"><Warning />{error}<button type="button" className="secondary-button small" onClick={() => setReload((value) => value + 1)}>Thử lại</button></div>
    : <div className="portal-loading" role="status"><CircleNotch className="spin" />Đang tải kỹ năng...</div>}</Panel>;

  return <Panel title="Kỹ năng & mong muốn">
    <div className="job-preferences">
      <p>Hệ thống dùng thông tin này để gợi ý việc phù hợp cho riêng bạn. Doanh nghiệp không nhìn thấy.</p>
      <TagPicker label="Kỹ năng của tôi" options={options.skills} value={form.skillIds} max={30} disabled={busy} onChange={(value) => update("skillIds", value)} />
      <TagPicker label="Nhóm ngành quan tâm" hint="Để trống nếu chưa xác định." options={options.categories} value={form.categoryIds} max={10} disabled={busy} onChange={(value) => update("categoryIds", value)} />
      <TagPicker label="Loại cơ hội mong muốn" hint="Để trống nếu loại nào cũng được." options={opportunityOptions} value={form.opportunityTypes} max={4} disabled={busy} onChange={(value) => update("opportunityTypes", value)} />
      {error && <p className="form-error" role="alert"><Warning />{error}</p>}
      <div className="job-preferences-actions">
        <span role="status">{dirty ? "Có thay đổi chưa lưu" : savedForm.skillIds.length ? <><CheckCircle weight="fill" />Đã lưu</> : "Chọn ít nhất một kỹ năng để nhận gợi ý"}</span>
        <button type="button" className="primary-button" disabled={busy || !dirty} onClick={() => void save()}>{busy && <CircleNotch className="spin" />}Lưu kỹ năng</button>
      </div>
    </div>
  </Panel>;
}
