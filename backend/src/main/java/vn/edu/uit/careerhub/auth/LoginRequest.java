package vn.edu.uit.careerhub.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Email không hợp lệ.") @Email(message = "Email không hợp lệ.") String email,
        @NotBlank(message = "Vui lòng nhập mật khẩu.") @Size(max = 128) String password) {}
