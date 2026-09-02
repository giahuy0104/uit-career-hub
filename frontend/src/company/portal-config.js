import {
  Bell,
  Briefcase,
  Buildings,
  CalendarCheck,
  ClipboardText,
  House,
  Users,
} from "@phosphor-icons/react";

export const companyPortalConfig = {
  fallbackIdentity: {
    label: "Doanh nghiệp đối tác",
    name: "Lê Thu Hà",
    meta: "VNG Corporation · Recruiter",
  },
  notificationRoute: "company-notifications",
  navigation: [
    { key: "company-dashboard", label: "Tổng quan", Icon: House },
    { key: "company-profile", label: "Hồ sơ doanh nghiệp", Icon: Buildings },
    { key: "company-jobs", label: "Tin tuyển dụng", Icon: Briefcase },
    { key: "company-candidates", label: "Ứng viên", Icon: Users },
    { key: "company-interviews", label: "Lịch phỏng vấn", Icon: CalendarCheck },
    { key: "company-internships", label: "Sinh viên thực tập", Icon: ClipboardText },
    { key: "company-notifications", label: "Thông báo", Icon: Bell },
  ],
};
