package com.cms.backend.auth;

import com.cms.backend.common.ApiException;
import com.cms.backend.user.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class OtpService {

    private final OtpCodeRepository otpCodeRepository;
    private final MailService mailService;
    private final BCryptPasswordEncoder otpEncoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();

    @Value("${app.otp.ttl-minutes}")
    private long ttlMinutes;

    @Value("${app.otp.log-codes:false}")
    private boolean logCodes;

    public void issueOtp(User user, OtpPurpose purpose) {
        String code = String.format("%06d", random.nextInt(1_000_000));

        OtpCode otp = new OtpCode();
        otp.setUser(user);
        otp.setPurpose(purpose.name());
        otp.setCodeHash(otpEncoder.encode(code));
        otp.setExpiresAt(Instant.now().plus(ttlMinutes, ChronoUnit.MINUTES));
        otpCodeRepository.save(otp);

        // Codes are only logged in local development (OTP_LOG_CODES=true) so the flow is testable without a mail server.
        if (logCodes) {
            log.info("OTP for {} ({}): {}", user.getEmail(), purpose, code);
        }
        mailService.sendOtpEmail(user.getEmail(), purpose.name(), code);
    }

    public void verifyOtp(User user, OtpPurpose purpose, String code) {
        OtpCode otp = otpCodeRepository
                .findTopByUserAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(user, purpose.name())
                .orElseThrow(() -> ApiException.badRequest("No OTP request found. Please request a new code."));

        if (otp.getExpiresAt().isBefore(Instant.now())) {
            throw ApiException.badRequest("OTP has expired. Please request a new code.");
        }
        if (!otpEncoder.matches(code, otp.getCodeHash())) {
            throw ApiException.badRequest("Invalid OTP code.");
        }
        otp.setConsumedAt(Instant.now());
        otpCodeRepository.save(otp);
    }
}
