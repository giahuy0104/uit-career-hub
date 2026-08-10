import {
  Bell,
  Briefcase,
  Buildings,
  CalendarBlank,
  FileText,
  House,
  User,
} from "@phosphor-icons/react";

export const studentPortalConfig = {
  fallbackIdentity: {
    label: "Sinh viên",
    name: "Nguyễn Minh Khoa",
    meta: "MSSV 20521067 · K24",
  },
  notificationRoute: "notifications",
  navigation: [
    { key: "dashboard", label: "Tổng quan", Icon: House },
    { key: "jobs", label: "Việc làm", Icon: Briefcase },
    { key: "companies", label: "Doanh nghiệp", Icon: Buildings },
    { key: "applications", label: "Đơn ứng tuyển", Icon: FileText },
    { key: "profile", label: "Hồ sơ & CV", Icon: User },
    { key: "interviews", label: "Lịch phỏng vấn", Icon: CalendarBlank },
    { key: "notifications", label: "Thông báo", Icon: Bell },
  ],
};
