import {
  Bell,
  Briefcase,
  Buildings,
  ClipboardText,
  GraduationCap,
  House,
  UserCheck,
} from "@phosphor-icons/react";

export const adminPortalConfig = {
  fallbackIdentity: {
    label: "Bộ phận phụ trách UIT",
    name: "Trần Hoàng Anh",
    meta: "Phòng Quan hệ Doanh nghiệp",
  },
  notificationRoute: "admin-notifications",
  navigation: [
    { key: "admin-dashboard", label: "Tổng quan", Icon: House },
    { key: "admin-companies", label: "Doanh nghiệp đối tác", Icon: Buildings },
    { key: "admin-jobs", label: "Duyệt tin tuyển dụng", Icon: Briefcase },
    { key: "admin-documents", label: "Xác minh tài liệu", Icon: ClipboardText },
    { key: "admin-applications", label: "Duyệt hồ sơ sinh viên", Icon: UserCheck },
    { key: "admin-placements", label: "Theo dõi kết quả", Icon: GraduationCap },
    { key: "admin-notifications", label: "Thông báo", Icon: Bell },
  ],
};
