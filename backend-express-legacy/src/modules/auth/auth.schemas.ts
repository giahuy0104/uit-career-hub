import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
  .max(128, "Mật khẩu không được vượt quá 128 ký tự.")
  .regex(/[a-z]/, "Mật khẩu phải có chữ thường.")
  .regex(/[A-Z]/, "Mật khẩu phải có chữ hoa.")
  .regex(/[0-9]/, "Mật khẩu phải có chữ số.");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email không hợp lệ."),
  password: z.string().min(1, "Vui lòng nhập mật khẩu.").max(128),
});

export const studentRegistrationSchema = z.object({
  fullName: z.string().trim().min(2, "Họ và tên phải có ít nhất 2 ký tự.").max(120),
  studentCode: z.string().trim().regex(/^[0-9]{8,12}$/, "Mã số sinh viên phải có từ 8 đến 12 chữ số."),
  email: z.string().trim().toLowerCase().email("Email không hợp lệ.").max(254),
  password: passwordSchema,
  acceptedTerms: z.literal(true),
});

export const companyActivationSchema = z.object({
  token: z.string().min(32),
  password: passwordSchema,
  acceptedTerms: z.literal(true),
});
