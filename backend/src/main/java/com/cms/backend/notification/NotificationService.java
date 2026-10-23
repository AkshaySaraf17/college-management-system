package com.cms.backend.notification;

import com.cms.backend.common.Db;
import org.springframework.stereotype.Service;

import java.util.UUID;

/** In-app notification fan-out used by the other modules (results published, fee invoices, absences, ...). */
@Service
public class NotificationService {

    private final Db db;

    public NotificationService(Db db) {
        this.db = db;
    }

    public void notifyUser(UUID userId, String title, String message, String type, String link) {
        db.exec("INSERT INTO notifications (user_id, title, message, type, link) VALUES (?, ?, ?, ?, ?)",
                userId, title, message, type, link);
    }

    /** Notifies the student and every linked parent account. */
    public void notifyStudent(UUID studentId, String title, String message, String type, String link) {
        db.exec("""
                INSERT INTO notifications (user_id, title, message, type, link)
                SELECT u, ?, ?, ?, ? FROM (
                    SELECT s.user_id AS u FROM students s WHERE s.id = ?
                    UNION
                    SELECT p.user_id FROM student_parents sp JOIN parents p ON p.id = sp.parent_id
                    WHERE sp.student_id = ? AND p.user_id IS NOT NULL
                ) t""", title, message, type, link, studentId, studentId);
    }

    public void notifyBatch(long batchId, String title, String message, String type, String link) {
        db.exec("""
                INSERT INTO notifications (user_id, title, message, type, link)
                SELECT s.user_id, ?, ?, ?, ? FROM students s WHERE s.batch_id = ? AND s.status = 'ACTIVE'""",
                title, message, type, link, batchId);
    }

    public void notifyRole(String role, String title, String message, String type, String link) {
        db.exec("""
                INSERT INTO notifications (user_id, title, message, type, link)
                SELECT ur.user_id, ?, ?, ?, ? FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = ?""",
                title, message, type, link, role);
    }

    /** audience: ALL, STUDENTS, FACULTY, PARENTS or STAFF (everyone except students and parents). */
    public int notifyAudience(String audience, Long batchId, String title, String message, String type, String link) {
        String roleFilter = switch (audience) {
            case "STUDENTS" -> "r.name = 'STUDENT'";
            case "FACULTY" -> "r.name = 'FACULTY'";
            case "PARENTS" -> "r.name = 'PARENT'";
            case "STAFF" -> "r.name NOT IN ('STUDENT','PARENT')";
            default -> "TRUE";
        };
        if (batchId != null) {
            return db.exec("""
                    INSERT INTO notifications (user_id, title, message, type, link)
                    SELECT DISTINCT u, ?::text, ?::text, ?::text, ?::text FROM (
                        SELECT s.user_id AS u FROM students s WHERE s.batch_id = ?
                        UNION
                        SELECT p.user_id FROM students s JOIN student_parents sp ON sp.student_id = s.id
                            JOIN parents p ON p.id = sp.parent_id WHERE s.batch_id = ? AND p.user_id IS NOT NULL
                    ) t""", title, message, type, link, batchId, batchId);
        }
        return db.exec("""
                INSERT INTO notifications (user_id, title, message, type, link)
                SELECT DISTINCT ur.user_id, ?::text, ?::text, ?::text, ?::text FROM user_roles ur JOIN roles r ON r.id = ur.role_id"""
                + " WHERE " + roleFilter, title, message, type, link);
    }
}
