package com.cms.backend.auth;

import com.cms.backend.auth.dto.*;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.user.User;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ApiResponse<Map<String, String>> register(@Valid @RequestBody RegisterRequest request) {
        User user = authService.register(request);
        return ApiResponse.ok("Registration successful. Check your email for a verification code.",
                Map.of("email", user.getEmail()));
    }

    @PostMapping("/verify-email")
    public ApiResponse<Void> verifyEmail(@Valid @RequestBody VerifyOtpRequest request) {
        authService.verifyEmail(request);
        return ApiResponse.message("Email verified. Your account is now active.");
    }

    @PostMapping("/login")
    public ApiResponse<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        LoginResponse response = authService.login(request);
        String message = response.isOtpRequired() ? "OTP sent for two-factor verification." : "Login successful.";
        return ApiResponse.ok(message, response);
    }

    @PostMapping("/verify-login-otp")
    public ApiResponse<AuthResponse> verifyLoginOtp(@Valid @RequestBody VerifyOtpRequest request) {
        return ApiResponse.ok("Login successful.", authService.verifyLoginOtp(request));
    }

    @PostMapping("/refresh")
    public ApiResponse<AuthResponse> refresh(@Valid @RequestBody RefreshRequest request) {
        return ApiResponse.ok(authService.refresh(request));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(@Valid @RequestBody RefreshRequest request) {
        authService.logout(request);
        return ApiResponse.message("Logged out.");
    }

    @PostMapping("/forgot-password")
    public ApiResponse<Void> forgotPassword(@Valid @RequestBody EmailRequest request) {
        authService.forgotPassword(request);
        return ApiResponse.message("If an account exists for this email, a reset code has been sent.");
    }

    @PostMapping("/reset-password")
    public ApiResponse<Void> resetPassword(@Valid @RequestBody ResetPasswordRequest request) {
        authService.resetPassword(request);
        return ApiResponse.message("Password reset successful. You can now log in.");
    }

    @PostMapping("/admin/create-user")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Map<String, String>> adminCreateUser(@Valid @RequestBody AdminCreateUserRequest request) {
        AdminCreateUserResult result = authService.adminCreateUser(request);
        return ApiResponse.ok("User created.", Map.of(
                "email", result.user().getEmail(),
                "status", result.user().getStatus().name(),
                "temporaryPassword", result.temporaryPassword()));
    }
}
