import { useState } from "react";
import { Check } from "@phosphor-icons/react";

import "./tag-picker.css";

/** Multi-select chips. `options` is [{ id, name }], `value` is the list of selected ids. */
export function TagPicker({ label, hint, options, value, onChange, max, disabled = false }) {
  const [query, setQuery] = useState("");
  const selected = new Set(value);
  const full = value.length >= max;
  const needle = query.trim().toLocaleLowerCase("vi");
  const visible = options.filter((option) => selected.has(option.id) || !needle || option.name.toLocaleLowerCase("vi").includes(needle));
  const toggle = (id) => onChange(selected.has(id) ? value.filter((item) => item !== id) : [...value, id]);

  return <fieldset className="tag-picker" disabled={disabled}>
    <legend>{label}</legend>
    {hint && <p>{hint}</p>}
    {options.length > 12 && <input type="search" aria-label={`Tìm ${label.toLocaleLowerCase("vi")}`} placeholder="Tìm nhanh..." value={query} onChange={(event) => setQuery(event.target.value)} />}
    <div className="tag-picker-options">
      {visible.map((option) => {
        const active = selected.has(option.id);
        return <button key={option.id} type="button" aria-pressed={active} className={active ? "selected" : ""}
          disabled={!active && full} onClick={() => toggle(option.id)}>{active && <Check weight="bold" />}{option.name}</button>;
      })}
      {options.length === 0 && <small>Chưa có mục nào đang hoạt động.</small>}
      {options.length > 0 && visible.length === 0 && <small>Không tìm thấy mục phù hợp.</small>}
    </div>
    {full && <small role="status">Đã chọn tối đa {max} mục.</small>}
  </fieldset>;
}
