package com.cms.backend.auth;

import com.cms.backend.user.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface OtpCodeRepository extends JpaRepository<OtpCode, Long> {
    Optional<OtpCode> findTopByUserAndPurposeAndConsumedAtIsNullOrderByCreatedAtDesc(User user, String purpose);
}
