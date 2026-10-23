package com.cms.backend.common;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** Resolves the current caller and enforces per-record access (a student sees only themselves, a parent only their children). */
@Service
public class AccessService {

    private static final Set<String> STUDENT_DATA_STAFF =
            Set.of("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD", "FACULTY", "ACCOUNTANT");

    private final Db db;

    public AccessService(Db db) {
        this.db = db;
    }

    public String email() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null) {
            throw ApiException.unauthorized("Authentication required");
        }
        return auth.getName();
    }

    public Set<String> roles() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.replaceFirst("^ROLE_", ""))
                .collect(Collectors.toSet());
    }

    public boolean hasAnyRole(String... roles) {
        Set<String> mine = roles();
        return Arrays.stream(roles).anyMatch(mine::contains);
    }

    public UUID userId() {
        UUID id = db.scalar(UUID.class, "SELECT id FROM users WHERE email = ?", email());
        if (id == null) throw ApiException.unauthorized("Unknown user");
        return id;
    }

    public UUID currentStudentId() {
        return db.scalar(UUID.class, "SELECT id FROM students WHERE user_id = ?", userId());
    }

    public UUID currentFacultyId() {
        return db.scalar(UUID.class, "SELECT id FROM faculties WHERE user_id = ?", userId());
    }

    public boolean canAccessStudent(UUID studentId) {
        if (roles().stream().anyMatch(STUDENT_DATA_STAFF::contains)) return true;
        UUID uid = userId();
        if (roles().contains("STUDENT")) {
            return db.exists("SELECT 1 FROM students WHERE id = ? AND user_id = ?", studentId, uid);
        }
        if (roles().contains("PARENT")) {
            return db.exists("""
                    SELECT 1 FROM student_parents sp JOIN parents p ON p.id = sp.parent_id
                    WHERE sp.student_id = ? AND p.user_id = ?""", studentId, uid);
        }
        return false;
    }

    public void requireStudentAccess(UUID studentId) {
        if (!canAccessStudent(studentId)) {
            throw ApiException.forbidden("You do not have access to this student's records.");
        }
    }

    public boolean isStudentDataStaff() {
        return roles().stream().anyMatch(STUDENT_DATA_STAFF::contains);
    }
}
