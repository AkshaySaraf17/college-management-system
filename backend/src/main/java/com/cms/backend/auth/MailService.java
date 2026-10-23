package com.cms.backend.auth;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class MailService {

    private final JavaMailSender mailSender;

    public void sendOtpEmail(String to, String purpose, String code) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(to);
            message.setSubject("Your verification code");
            message.setText("Your code for " + purpose.replace('_', ' ').toLowerCase() + " is: " + code
                    + "\n\nThis code expires shortly. If you did not request this, you can ignore this email.");
            mailSender.send(message);
        } catch (Exception e) {
            // Non-fatal: local/dev environments often have no SMTP server configured.
            // The OTP is still logged by OtpService so the flow remains testable.
            log.warn("Could not send OTP email to {}: {}", to, e.getMessage());
        }
    }
}
