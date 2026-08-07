import { useState } from "react";
import { CheckCircle, CircleNotch, Key, SealCheck, ShieldCheck, Warning } from "@phosphor-icons/react";

export function CompanyActivationScreen({ token, activate, onDone }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const requirementsMet = password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /[0-9]/.test(password);
  const valid = requirementsMet && password === confirmation && accepted;

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await activate(token, password);
      setComplete(true);
    } catch (requestError) {
      setError(requestError?.message || "Liên kết kích hoạt không hợp lệ hoặc đã hết hạn.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="activation-screen"><section className="activation-card"><div className="activation-brand"><span><SealCheck weight="duotone" /></span><div><strong>UIT Career Hub</strong><small>Cổng việc làm & thực tập UIT</small></div></div>{complete ? <div className="activation-complete"><CheckCircle size={66} weight="fill" /><h1>Kích hoạt thành công</h1><p>Tài khoản doanh nghiệp đã sẵn sàng. Bạn có thể đăng nhập và bắt đầu quản lý tuyển dụng.</p><button className="primary-button full" onClick={onDone}>Đến trang đăng nhập</button></div> : <><span className="activation-icon"><Key /></span><h1>Thiết lập tài khoản doanh nghiệp</h1><p>Tạo mật khẩu cho tài khoản do bộ phận phụ trách UIT cấp. Liên kết chỉ sử dụng được một lần.</p><form onSubmit={submit}><label><span>Mật khẩu mới</span><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Tối thiểu 8 ký tự" /></label><label><span>Nhập lại mật khẩu</span><input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><div className={`password-rules ${requirementsMet ? "valid" : ""}`}><ShieldCheck /><span>Có ít nhất 8 ký tự, gồm chữ hoa, chữ thường và chữ số.</span></div>{confirmation && confirmation !== password && <p className="activation-error"><Warning />Mật khẩu nhập lại chưa khớp.</p>}<label className="activation-consent"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} /><span>Tôi xác nhận đây là tài khoản được UIT cấp và đồng ý bảo vệ thông tin đăng nhập.</span></label>{error && <p className="activation-error"><Warning />{error}</p>}<button className="primary-button full" disabled={!valid || busy}>{busy ? <CircleNotch className="spin" /> : <CheckCircle />}Kích hoạt tài khoản</button></form></>}</section></main>;
}
