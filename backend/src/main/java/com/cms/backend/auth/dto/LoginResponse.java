package com.cms.backend.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Set;

@Getter
@AllArgsConstructor
public class LoginResponse {
    private boolean otpRequired;
    private String accessToken;
    private String refreshToken;
    private String email;
    private String fullName;
    private Set<String> roles;

    public static LoginResponse otpRequired(String email) {
        return new LoginResponse(true, null, null, email, null, null);
    }

    public static LoginResponse authenticated(AuthResponse auth) {
        return new LoginResponse(false, auth.getAccessToken(), auth.getRefreshToken(),
                auth.getEmail(), auth.getFullName(), auth.getRoles());
    }
}
