// Plain-language reasons for the machine-learning models (feature name -> sentence).
const percent = (value) => `${Math.round(value * 100)}%`;
const whole = (value) => Math.round(value);

export const jobFactorCopy = {
  req_skill_ratio: (v) => `Bạn có ${percent(v)} kỹ năng bắt buộc`,
  opt_skill_ratio: (v) => `Bạn có ${percent(v)} kỹ năng nên có`,
  skill_jaccard: () => "Kỹ năng của bạn trùng nhiều với tin",
  category_match: () => "Đúng nhóm ngành bạn quan tâm",
  type_match: () => "Đúng loại cơ hội bạn muốn",
  days_since_published: (v) => v <= 7 ? `Tin mới đăng ${whole(v)} ngày` : "Tin đã đăng một thời gian",
  days_to_deadline: (v) => `Còn ${whole(v)} ngày để nộp`,
  company_popularity: () => "Doanh nghiệp được nhiều sinh viên ứng tuyển",
  history_category_share: () => "Giống các tin bạn từng ứng tuyển",
};

export const riskFactorCopy = {
  submit_ratio: (v) => `Mới nộp ${percent(v)} số tuần đến hạn`,
  late_ratio: (v) => `Nộp trễ ${percent(v)} số tuần`,
  revision_ratio: (v) => `Bị yêu cầu sửa ${percent(v)} số tuần`,
  avg_words: (v) => `Nhật ký ngắn, trung bình ${whole(v)} từ`,
  words_trend: () => "Nhật ký ngày càng ngắn",
  max_repeat: (v) => `Nội dung lặp lại tuần trước (${percent(v)})`,
  difficulty_ratio: () => "Thường nêu khó khăn cần hỗ trợ",
  days_since_last: (v) => `${whole(v)} ngày chưa nộp nhật ký`,
  plan_revisions: (v) => `Kế hoạch bị yêu cầu sửa ${whole(v)} lần`,
};

export function describeFactor(copy, factor) {
  const text = copy[factor.feature];
  return text ? text(factor.value) : factor.feature;
}

export function modelLabel(model) {
  if (!model) return "";
  const kind = model.type === "lightgbm" ? "LightGBM" : "Logistic Regression";
  return `${kind}${model.trainedOn === "simulated" ? ", huấn luyện trên dữ liệu mô phỏng" : ""}`;
}
