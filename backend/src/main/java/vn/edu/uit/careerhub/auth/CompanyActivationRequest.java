package vn.edu.uit.careerhub.auth;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CompanyActivationRequest(
        @NotBlank @Size(min = 32) String token,
        @NotBlank @Size(min = 8, max = 128, message = "Mật khẩu phải có từ 8 đến 128 ký tự.")
        @Pattern(regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).+$",
                message = "Mật khẩu phải có chữ thường, chữ hoa và chữ số.") String password,
        @AssertTrue(message = "Bạn phải chấp nhận điều khoản.") boolean acceptedTerms) {}
