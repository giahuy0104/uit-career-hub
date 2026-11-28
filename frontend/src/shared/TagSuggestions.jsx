import { CircleNotch, Plus, Sparkle } from "@phosphor-icons/react";

import "./tag-picker.css";

const percent = (value) => `${Math.round(value * 100)}%`;

/** Company job form: skills and categories suggested from the text; nothing is added until clicked. */
export function TagSuggestions({ result, busy, error, canRun, onRun, skillIds, categoryIds, onAddSkill, onAddCategory }) {
  const skills = (result?.skills || []).filter((item) => !skillIds.includes(item.id));
  const categories = (result?.categories || []).filter((item) => !categoryIds.includes(item.id)).slice(0, 1);
  return <div className="tag-suggestions">
    <div className="tag-suggestions-bar">
      <span><Sparkle weight="duotone" />Hệ thống đọc mô tả và yêu cầu để gợi ý kỹ năng, nhóm ngành. Bạn tự chọn có thêm hay không.</span>
      <button type="button" className="secondary-button small" disabled={busy || !canRun} title={canRun ? undefined : "Viết mô tả và yêu cầu trước"}
        onClick={onRun}>{busy ? <CircleNotch className="spin" /> : <Sparkle />}Gợi ý từ nội dung</button>
    </div>
    {error && <p className="tag-suggestions-note" role="alert">{error}</p>}
    {result && !result.available && <p className="tag-suggestions-note" role="status">{result.message}</p>}
    {result?.available && (skills.length || categories.length
      ? <div className="tag-suggestions-list">
        {categories.map((item) => <button key={item.id} type="button" onClick={() => onAddCategory(item.id)}><Plus />{item.name}<small>nhóm ngành phù hợp nhất</small></button>)}
        {skills.map((item) => <button key={item.id} type="button" onClick={() => onAddSkill(item.id)}><Plus />{item.name}<small>{item.mentioned ? "có nhắc trong tin" : "suy ra từ nội dung"} · {percent(item.probability)}</small></button>)}
        {skills.length > 1 && <button type="button" className="add-all" onClick={() => skills.forEach((item) => onAddSkill(item.id))}>Thêm tất cả kỹ năng</button>}
      </div>
      : <p className="tag-suggestions-note" role="status">Không có gợi ý mới: các kỹ năng phù hợp đã được chọn hoặc nội dung chưa đủ rõ.</p>)}
  </div>;
}
