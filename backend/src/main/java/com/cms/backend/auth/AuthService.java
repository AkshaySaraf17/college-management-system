package com.cms.backend.auth;

import com.cms.backend.auth.dto.*;
import com.cms.backend.common.ApiException;
import com.cms.backend.security.JwtService;
import com.cms.backend.user.Role;
import com.cms.backend.user.RoleRepository;
import com.cms.backend.user.User;
import com.cms.backend.user.UserRepository;
import com.cms.backend.user.UserStatus;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AuthService {

    private static final Set<String> SELF_REGISTERABLE_ROLES = Set.of("STUDENT", "PARENT");

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final OtpCodeRepository otpCodeRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final OtpService otpService;
    private final JwtService jwtService;
    private final SecureRandom random = new SecureRandom();

    @Transactional
    public User register(RegisterRequest request) {
        if (!SELF_REGISTERABLE_ROLES.contains(request.getRole().toUpperCase())) {
            throw ApiException.forbidden(
                    "Self-registration is only available for students and parents. " +
                    "Staff accounts are created by a college administrator.");
        }
        if (userRepository.existsByEmail(request.getEmail())) {
            throw ApiException.conflict("An account with this email already exists.");
        }

        Role role = roleRepository.findByName(request.getRole().toUpperCase())
                .orElseThrow(() -> ApiException.badRequest("Unknown role: " + request.getRole()));

        User user = new User();
        user.setEmail(request.getEmail().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        user.setStatus(UserStatus.PENDING_VERIFICATION);
        user.getRoles().add(role);
        userRepository.save(user);

        otpService.issueOtp(user, OtpPurpose.EMAIL_VERIFICATION);
        return user;
    }

    @Transactional
    public AdminCreateUserResult adminCreateUser(AdminCreateUserRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw ApiException.conflict("An account with this email already exists.");
        }
        Role role = roleRepository.findByName(request.getRole().toUpperCase())
                .orElseThrow(() -> ApiException.badRequest("Unknown role: " + request.getRole()));

        String tempPassword = request.getTemporaryPassword() != null && !request.getTemporaryPassword().isBlank()
                ? request.getTemporaryPassword()
                : generateTemporaryPassword();

        User user = new User();
        user.setEmail(request.getEmail().toLowerCase());
        user.setPasswordHash(passwordEncoder.encode(tempPassword));
        user.setFirstName(request.getFirstName());
        user.setLastName(request.getLastName());
        user.setPhone(request.getPhone());
        // Admin-created accounts are pre-approved; the user still verifies their email on first login.
        user.setStatus(UserStatus.ACTIVE);
        user.getRoles().add(role);
        userRepository.save(user);

        return new AdminCreateUserResult(user, tempPassword);
    }

    @Transactional
    public void verifyEmail(VerifyOtpRequest request) {
        User user = findByEmailOrThrow(request.getEmail());
        otpService.verifyOtp(user, OtpPurpose.EMAIL_VERIFICATION, request.getCode());
        user.setEmailVerified(true);
        if (user.getStatus() == UserStatus.PENDING_VERIFICATION) {
            user.setStatus(UserStatus.ACTIVE);
        }
        userRepository.save(user);
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail().toLowerCase())
                .orElseThrow(() -> ApiException.unauthorized("Invalid email or password."));

        if (user.getLockedUntil() != null && user.getLockedUntil().isAfter(Instant.now())) {
            throw ApiException.forbidden("Account temporarily locked due to failed login attempts. Try again later.");
        }
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            registerFailedAttempt(user);
            throw ApiException.unauthorized("Invalid email or password.");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw ApiException.forbidden("Account is not active (" + user.getStatus() + "). Please verify your email or contact an administrator.");
        }

        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);

        if (user.isTwoFactorEnabled()) {
            otpService.issueOtp(user, OtpPurpose.LOGIN_2FA);
            userRepository.save(user);
            return LoginResponse.otpRequired(user.getEmail());
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return LoginResponse.authenticated(issueTokens(user));
    }

    @Transactional
    public AuthResponse verifyLoginOtp(VerifyOtpRequest request) {
        User user = findByEmailOrThrow(request.getEmail());
        otpService.verifyOtp(user, OtpPurpose.LOGIN_2FA, request.getCode());
        user.setLastLoginAt(Instant.now());
        userRepository.save(user);
        return issueTokens(user);
    }

    @Transactional
    public void forgotPassword(EmailRequest request) {
        userRepository.findByEmail(request.getEmail().toLowerCase()).ifPresent(user ->
                otpService.issueOtp(user, OtpPurpose.PASSWORD_RESET));
        // Deliberately does not reveal whether the email exists.
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        User user = findByEmailOrThrow(request.getEmail());
        otpService.verifyOtp(user, OtpPurpose.PASSWORD_RESET, request.getCode());
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        user.setFailedLoginAttempts(0);
        user.setLockedUntil(null);
        userRepository.save(user);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> ApiException.unauthorized("Invalid refresh token."));

        if (stored.getRevokedAt() != null || stored.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.unauthorized("Refresh token expired or revoked. Please log in again.");
        }
        stored.setRevokedAt(Instant.now());
        refreshTokenRepository.save(stored);

        return issueTokens(stored.getUser());
    }

    @Transactional
    public void logout(RefreshRequest request) {
        String tokenHash = hashToken(request.getRefreshToken());
        refreshTokenRepository.findByTokenHash(tokenHash).ifPresent(rt -> {
            rt.setRevokedAt(Instant.now());
            refreshTokenRepository.save(rt);
        });
    }

    private AuthResponse issueTokens(User user) {
        Set<String> roleNames = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        String accessToken = jwtService.generateAccessToken(user.getEmail(), roleNames);

        String rawRefreshToken = generateOpaqueToken();
        RefreshToken refreshToken = new RefreshToken();
        refreshToken.setUser(user);
        refreshToken.setTokenHash(hashToken(rawRefreshToken));
        refreshToken.setExpiresAt(Instant.now().plus(7, ChronoUnit.DAYS));
        refreshTokenRepository.save(refreshToken);

        return new AuthResponse(accessToken, rawRefreshToken, user.getEmail(), user.getFullName(), roleNames);
    }

    private void registerFailedAttempt(User user) {
        user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
        if (user.getFailedLoginAttempts() >= 5) {
            user.setLockedUntil(Instant.now().plus(15, ChronoUnit.MINUTES));
        }
        userRepository.save(user);
    }

    private User findByEmailOrThrow(String email) {
        return userRepository.findByEmail(email.toLowerCase())
                .orElseThrow(() -> ApiException.badRequest("No account found for this email."));
    }

    private String generateTemporaryPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }
        return sb.toString();
    }

    private String generateOpaqueToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
