package com.cms.backend.config;

import com.cms.backend.common.Db;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/** Creates the first Super Admin from environment configuration when the system has none. */
@Component
@Slf4j
public class AdminBootstrap implements ApplicationRunner {

    private final Db db;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;

    public AdminBootstrap(Db db, PasswordEncoder encoder,
                          @Value("${app.bootstrap.admin-email}") String email,
                          @Value("${app.bootstrap.admin-password:}") String password) {
        this.db = db;
        this.encoder = encoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        boolean hasAdmin = db.exists("""
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'SUPER_ADMIN'""");
        if (hasAdmin) return;
        if (password.isBlank()) {
            log.warn("No Super Admin exists and BOOTSTRAP_ADMIN_PASSWORD is not set; nobody will be able to sign in as an administrator.");
            return;
        }
        db.exec("""
                INSERT INTO users (email, password_hash, first_name, last_name, status, email_verified)
                VALUES (?, ?, 'System', 'Administrator', 'ACTIVE', TRUE)""", email.toLowerCase(), encoder.encode(password));
        db.exec("""
                INSERT INTO user_roles (user_id, role_id)
                SELECT u.id, r.id FROM users u, roles r WHERE u.email = ? AND r.name = 'SUPER_ADMIN'""", email.toLowerCase());
        log.info("Created initial Super Admin {}", email);
    }
}
