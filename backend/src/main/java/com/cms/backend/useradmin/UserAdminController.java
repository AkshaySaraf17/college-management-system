package com.cms.backend.useradmin;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.SecureRandom;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserAdminController {

    private static final Set<String> STATUSES = Set.of("ACTIVE", "SUSPENDED", "DISABLED");
    private static final Set<String> PRIVILEGED = Set.of("SUPER_ADMIN", "COLLEGE_ADMIN");

    private final Db db;
    private final AccessService access;
    private final PasswordEncoder encoder;
    private final SecureRandom random = new SecureRandom();

    public UserAdminController(Db db, AccessService access, PasswordEncoder encoder) {
        this.db = db;
        this.access = access;
        this.encoder = encoder;
    }

    public record StatusRequest(@NotBlank String status) {}
    public record RolesRequest(List<String> roles) {}
    public record ChangePasswordRequest(@NotBlank String currentPassword, @NotBlank @Size(min = 8) String newPassword) {}

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) String role,
                                                         @RequestParam(required = false) String q,
                                                         @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder("""
                SELECT u.id, u.email, u.first_name || ' ' || u.last_name AS full_name, u.status, u.email_verified,
                       u.two_factor_enabled, u.last_login_at,
                       (SELECT string_agg(r.name, ',' ORDER BY r.name) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
                FROM users u WHERE TRUE""");
        java.util.ArrayList<Object> args = new java.util.ArrayList<>();
        if (role != null && !role.isBlank()) {
            sql.append(" AND EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = ?)");
            args.add(role);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND u.status = ?");
            args.add(status);
        }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(u.email) LIKE ? OR lower(u.first_name || ' ' || u.last_name) LIKE ?)");
            String like = "%" + q.toLowerCase() + "%";
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY u.created_at DESC LIMIT 200");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Void> setStatus(@PathVariable UUID id, @Valid @RequestBody StatusRequest req) {
        if (!STATUSES.contains(req.status())) throw ApiException.badRequest("Status must be one of " + STATUSES);
        if (id.equals(access.userId())) throw ApiException.badRequest("You cannot change your own account status.");
        requireCanManage(id);
        db.exec("UPDATE users SET status = ?, updated_at = now() WHERE id = ?", req.status(), id);
        if (!req.status().equals("ACTIVE")) {
            db.exec("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", id);
        }
        return ApiResponse.message("User status updated.");
    }

    @PutMapping("/{id}/roles")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    @Transactional
    public ApiResponse<Void> setRoles(@PathVariable UUID id, @RequestBody RolesRequest req) {
        if (req.roles() == null || req.roles().isEmpty()) throw ApiException.badRequest("At least one role is required.");
        requireCanManage(id);
        boolean grantsPrivileged = req.roles().stream().anyMatch(PRIVILEGED::contains);
        if (grantsPrivileged && !access.hasAnyRole("SUPER_ADMIN")) {
            throw ApiException.forbidden("Only a Super Admin can grant administrator roles.");
        }
        for (String role : req.roles()) {
            if (!db.exists("SELECT 1 FROM roles WHERE name = ?", role)) throw ApiException.badRequest("Unknown role: " + role);
        }
        db.exec("DELETE FROM user_roles WHERE user_id = ?", id);
        for (String role : req.roles()) {
            db.exec("INSERT INTO user_roles (user_id, role_id) SELECT ?, id FROM roles WHERE name = ?", id, role);
        }
        return ApiResponse.message("Roles updated.");
    }

    @PostMapping("/{id}/reset-password")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Map<String, String>> resetPassword(@PathVariable UUID id) {
        requireCanManage(id);
        String temp = temporaryPassword();
        db.exec("UPDATE users SET password_hash = ?, failed_login_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = ?",
                encoder.encode(temp), id);
        db.exec("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", id);
        return ApiResponse.ok("Password reset. Share the temporary password securely.", Map.of("temporaryPassword", temp));
    }

    @GetMapping("/me")
    public ApiResponse<Map<String, Object>> me() {
        return ApiResponse.ok(db.one("""
                SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.two_factor_enabled, u.email_verified, u.last_login_at,
                       (SELECT string_agg(r.name, ',') FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
                FROM users u WHERE u.id = ?""", "User not found.", access.userId()));
    }

    @PatchMapping("/me/two-factor")
    public ApiResponse<Void> twoFactor(@RequestBody Map<String, Boolean> body) {
        boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
        db.exec("UPDATE users SET two_factor_enabled = ?, updated_at = now() WHERE id = ?", enabled, access.userId());
        return ApiResponse.message(enabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.");
    }

    @PostMapping("/me/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest req) {
        String hash = db.scalar(String.class, "SELECT password_hash FROM users WHERE id = ?", access.userId());
        if (!encoder.matches(req.currentPassword(), hash)) throw ApiException.badRequest("Current password is incorrect.");
        db.exec("UPDATE users SET password_hash = ?, updated_at = now() WHERE id = ?", encoder.encode(req.newPassword()), access.userId());
        return ApiResponse.message("Password changed.");
    }

    @GetMapping("/me/sessions")
    public ApiResponse<List<Map<String, Object>>> sessions() {
        return ApiResponse.ok(db.list("""
                SELECT id, created_at, expires_at FROM refresh_tokens
                WHERE user_id = ? AND revoked_at IS NULL AND expires_at > now() ORDER BY created_at DESC""", access.userId()));
    }

    @PostMapping("/me/logout-all")
    public ApiResponse<Void> logoutAll() {
        db.exec("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = ? AND revoked_at IS NULL", access.userId());
        return ApiResponse.message("All sessions signed out.");
    }

    private void requireCanManage(UUID targetId) {
        boolean targetPrivileged = db.exists("""
                SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = ? AND r.name IN ('SUPER_ADMIN','COLLEGE_ADMIN')""", targetId);
        if (targetPrivileged && !access.hasAnyRole("SUPER_ADMIN")) {
            throw ApiException.forbidden("Only a Super Admin can manage administrator accounts.");
        }
        if (!db.exists("SELECT 1 FROM users WHERE id = ?", targetId)) throw ApiException.notFound("User not found.");
    }

    private String temporaryPassword() {
        String chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 12; i++) sb.append(chars.charAt(random.nextInt(chars.length())));
        return sb.toString();
    }
}
