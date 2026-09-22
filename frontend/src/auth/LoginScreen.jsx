import { lazy, Suspense, useState } from "react";
import {
  ArrowRight,
  Buildings,
  EnvelopeSimple,
  Eye,
  EyeSlash,
  GraduationCap,
  LockKey,
  SealCheck,
  ShieldCheck,
  SpinnerGap,
  UserCircle,
} from "@phosphor-icons/react";

const KineticOrbit3D = lazy(() => import("./KineticOrbit3D.jsx").then((module) => ({ default: module.KineticOrbit3D })));

const demoAccounts = [
  { label: "Sinh viên", icon: GraduationCap, email: "20521067@student.uit.edu.vn", password: "Student@12345" },
  { label: "UIT Admin", icon: ShieldCheck, email: "admin.career@uit.edu.vn", password: "Admin@12345" },
  { label: "Doanh nghiệp", icon: Buildings, email: "recruiter@vng.example", password: "Company@12345" },
];

const registrationPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+$/;

export function LoginScreen({ onLogin, onRegister }) {
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const showDemoAccounts = import.meta.env.MODE === "development" && import.meta.env.VITE_SHOW_DEMO_ACCOUNTS !== "false";

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "register") {
        if (!registrationPasswordPattern.test(password)) {
          throw new Error("Mật khẩu phải có chữ thường, chữ hoa và chữ số.");
        }
        if (password !== confirmPassword) {
          throw new Error("Mật khẩu xác nhận chưa khớp.");
        }
        await onRegister({ fullName, studentCode, email, password, acceptedTerms });
      } else {
        await onLogin(email, password);
      }
    } catch (requestError) {
      setError(requestError.message || "Không thể đăng nhập.");
    } finally {
      setSubmitting(false);
    }
  };

  const switchMode = () => {
    setMode((current) => current === "login" ? "register" : "login");
    setError("");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
  };

  const selectDemo = (account) => {
    setEmail(account.email);
    setPassword(account.password);
    setError("");
  };

  return (
    <main className="login-screen">
      <section className="login-story" aria-label="Hành trình học tập và nghề nghiệp tại UIT">
        <div className="login-brand">
          <img src="/images/uit-mark-official.png" alt="Logo Trường Đại học Công nghệ Thông tin" />
          <div><strong>UIT Career Hub</strong><small>Kết nối tri thức · Dẫn lối sự nghiệp</small></div>
        </div>
        <div className="login-journey-stage">
          <img
            className="login-journey-art"
            src="/images/login-career-journey-v1.png"
            alt="Sinh viên UIT học tập trên hành trình dẫn đến cơ hội nghề nghiệp"
            fetchPriority="high"
          />
          <div className="login-orbit-slot"><Suspense fallback={null}><KineticOrbit3D /></Suspense></div>
        </div>
      </section>

      <section className="login-panel">
        <form className={`login-card ${mode === "register" ? "register-card" : ""}`} onSubmit={submit}>
          <div className="login-card-heading"><p className="eyebrow">CỔNG VIỆC LÀM VÀ THỰC TẬP UIT</p><h2>{mode === "register" ? "Tạo tài khoản sinh viên" : "Chào mừng bạn trở lại"}</h2><p>{mode === "register" ? "Đăng ký bằng email sinh viên UIT để bắt đầu sử dụng hệ thống." : "Tiếp tục hành trình học tập và nghề nghiệp của bạn."}</p></div>
          {mode === "register" && <>
            <div className="login-field"><label htmlFor="register-name">Họ và tên</label><div><UserCircle size={20} /><input id="register-name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Nguyễn Văn An" autoComplete="name" minLength={2} maxLength={120} required /></div></div>
            <div className="login-field"><label htmlFor="register-student-code">Mã số sinh viên</label><div><GraduationCap size={20} /><input id="register-student-code" inputMode="numeric" pattern="[0-9]{8,12}" value={studentCode} onChange={(event) => setStudentCode(event.target.value.replace(/\D/g, ""))} placeholder="20521067" autoComplete="off" required /></div></div>
          </>}
          <div className="login-field"><label htmlFor="login-email">Email</label><div><EnvelopeSimple size={20} /><input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={mode === "register" ? "mssv@student.uit.edu.vn" : "you@uit.edu.vn"} autoComplete="username" required /></div></div>
          <div className="login-field"><label htmlFor="login-password">Mật khẩu</label><div><LockKey size={20} /><input id="login-password" type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"} autoComplete={mode === "register" ? "new-password" : "current-password"} minLength={mode === "register" ? 8 : undefined} required /><button className="login-password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword}>{showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}</button></div></div>
          {mode === "register" && <>
            <div className="login-field"><label htmlFor="register-password-confirmation">Xác nhận mật khẩu</label><div><LockKey size={20} /><input id="register-password-confirmation" type={showPassword ? "text" : "password"} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Nhập lại mật khẩu" autoComplete="new-password" minLength={8} required /></div></div>
            <label className="registration-terms"><input type="checkbox" checked={acceptedTerms} onChange={(event) => setAcceptedTerms(event.target.checked)} required /><span>Tôi đồng ý sử dụng thông tin đã nhập để tạo hồ sơ sinh viên trên UIT Career Hub.</span></label>
          </>}
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="primary-button login-submit" type="submit" disabled={submitting}>{submitting ? <><SpinnerGap className="spin" size={20} />Đang xử lý</> : <>{mode === "register" ? "Đăng ký" : "Đăng nhập"}<ArrowRight size={19} /></>}</button>

          <p className="auth-mode-switch">{mode === "register" ? "Đã có tài khoản?" : "Chưa có tài khoản?"}<button type="button" onClick={switchMode}>{mode === "register" ? "Đăng nhập" : "Đăng ký sinh viên"}</button></p>

          {mode === "login" && showDemoAccounts && <div className="demo-accounts"><div><span>Tài khoản demo</span><small>Chọn vai trò để tự điền thông tin đăng nhập.</small></div><div>{demoAccounts.map((account) => { const Icon = account.icon; return <button type="button" key={account.label} onClick={() => selectDemo(account)}><Icon size={18} /><span><strong>{account.label}</strong><small>{account.email}</small></span></button>; })}</div></div>}
          <p className="login-privacy"><ShieldCheck size={18} />{mode === "register" ? "Mật khẩu được mã hóa trước khi lưu; tài khoản mới chỉ nhận quyền sinh viên." : "Refresh token được bảo vệ trong cookie HttpOnly; mật khẩu không được lưu trên trình duyệt."}</p>
        </form>
      </section>
    </main>
  );
}

export function SessionLoadingScreen() {
  return <main className="session-loading"><SealCheck size={42} weight="duotone" /><strong>UIT Career Hub</strong><span><SpinnerGap className="spin" size={20} />Đang kiểm tra phiên đăng nhập...</span></main>;
}
