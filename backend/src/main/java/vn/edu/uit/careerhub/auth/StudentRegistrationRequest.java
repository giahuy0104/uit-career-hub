package vn.edu.uit.careerhub.auth;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record StudentRegistrationRequest(
        @NotBlank(message = "Vui lòng nhập họ và tên.")
        @Size(min = 2, max = 120, message = "Họ và tên phải có từ 2 đến 120 ký tự.") String fullName,
        @NotBlank(message = "Vui lòng nhập mã số sinh viên.")
        @Pattern(regexp = "^[0-9]{8,12}$", message = "Mã số sinh viên phải có từ 8 đến 12 chữ số.") String studentCode,
        @NotBlank(message = "Email không hợp lệ.")
        @Email(message = "Email không hợp lệ.")
        @Size(max = 254, message = "Email quá dài.") String email,
        @NotBlank(message = "Vui lòng nhập mật khẩu.")
        @Size(min = 8, max = 128, message = "Mật khẩu phải có từ 8 đến 128 ký tự.")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+$",
                message = "Mật khẩu phải có chữ thường, chữ hoa và chữ số.") String password,
        @AssertTrue(message = "Bạn phải đồng ý với điều khoản sử dụng.") boolean acceptedTerms) {}
