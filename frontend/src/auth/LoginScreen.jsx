import { useState } from "react";
import {
  ArrowRight,
  Buildings,
  EnvelopeSimple,
  GraduationCap,
  LockKey,
  SealCheck,
  ShieldCheck,
  SpinnerGap,
} from "@phosphor-icons/react";

const demoAccounts = [
  { label: "Sinh viên", icon: GraduationCap, email: "20521067@student.uit.edu.vn", password: "Student@12345" },
  { label: "UIT Admin", icon: ShieldCheck, email: "admin.career@uit.edu.vn", password: "Admin@12345" },
  { label: "Doanh nghiệp", icon: Buildings, email: "recruiter@vng.example", password: "Company@12345" },
];

export function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const showDemoAccounts = import.meta.env.MODE === "development" && import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== "false";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onLogin(email, password);
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  };

  const selectDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  return (
    <main className="login-screen">
      <section className="login-story">
        <div className="login-brand"><span><SealCheck size={32} weight="duotone" /></span><div><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></div></div>
        <div className="login-story-copy">
          <p className="eyebrow">CỔNG VIỆC LÀM VÀ THỰC TẬP UIT</p>
          <h1>Một quy trình minh bạch cho sinh viên, nhà trường và doanh nghiệp.</h1>
          <p>Tin tuyển dụng được UIT kiểm duyệt, hồ sơ chỉ chuyển đến doanh nghiệp sau khi đủ điều kiện và mọi bước đều có lịch sử xử lý.</p>
          <div className="login-assurances"><span><ShieldCheck size={20} />Đối tác được UIT xác thực</span><span><GraduationCap size={20} />Chỉ sinh viên UIT hợp lệ</span><span><Buildings size={20} />Theo dõi xuyên suốt quy trình</span></div>
        </div>
        <small className="login-footer-note">Đồ án tốt nghiệp · Phiên bản MVP một trường UIT</small>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="login-card-heading"><span><LockKey size={24} weight="duotone" /></span><div><p className="eyebrow">ĐĂNG NHẬP AN TOÀN</p><h2>Chào mừng bạn trở lại</h2><p>Sử dụng tài khoản đã được UIT cấp hoặc xác nhận.</p></div></div>
          <label className="login-field"><span>Email</span><div><EnvelopeSimple size={20} /><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@uit.edu.vn" autoComplete="username" required /></div></label>
          <label className="login-field"><span>Mật khẩu</span><div><LockKey size={20} /><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nhập mật khẩu" autoComplete="current-password" required /></div></label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? <><SpinnerGap className="spin" size={20} />Đang xác thực</> : <>Đăng nhập<ArrowRight size={19} /></>}</button>

          {showDemoAccounts && <div className="demo-accounts"><div><span>Tài khoản demo</span><small>Chọn vai trò để tự điền thông tin đăng nhập.</small></div><div>{demoAccounts.map((account) => { const Icon = account.icon; return <button type="button" key={account.label} onClick={() => selectDemo(account)}><Icon size={18} /><span><strong>{account.label}</strong><small>{account.email}</small></span></button>; })}</div></div>}
          <p className="login-privacy"><ShieldCheck size={18} />Refresh token được bảo vệ trong cookie HttpOnly; mật khẩu không được lưu trên trình duyệt.</p>
        </form>
      </section>
    </main>
  );
}

export function SessionLoadingScreen() {
  return <main className="session-loading"><SealCheck size={42} weight="duotone" /><strong>UIT Career Hub</strong><span><SpinnerGap className="spin" size={20} />Đang kiểm tra phiên đăng nhập...</span></main>;
}
