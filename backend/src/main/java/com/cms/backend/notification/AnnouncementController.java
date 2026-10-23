package com.cms.backend.notification;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/announcements")
public class AnnouncementController {

    private static final Set<String> AUDIENCES = Set.of("ALL", "STUDENTS", "FACULTY", "PARENTS", "STAFF");

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public AnnouncementController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record AnnouncementRequest(@NotBlank String title, @NotBlank String body, String audience, Long batchId, boolean isPublic) {}

    @GetMapping("/public")
    public ApiResponse<List<Map<String, Object>>> publicNotices() {
        return ApiResponse.ok(db.list("SELECT id, title, body, created_at FROM announcements WHERE is_public = TRUE ORDER BY created_at DESC LIMIT 10"));
    }

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> visibleToMe() {
        Set<String> roles = access.roles();
        List<String> audiences = new ArrayList<>(List.of("ALL"));
        if (roles.contains("STUDENT")) audiences.add("STUDENTS");
        if (roles.contains("FACULTY")) audiences.add("FACULTY");
        if (roles.contains("PARENT")) audiences.add("PARENTS");
        if (roles.stream().anyMatch(r -> !r.equals("STUDENT") && !r.equals("PARENT"))) audiences.add("STAFF");
        String audienceList = "'" + String.join("','", audiences) + "'";

        boolean staff = roles.stream().anyMatch(r -> !r.equals("STUDENT") && !r.equals("PARENT"));
        String sql = "SELECT a.id, a.title, a.body, a.audience, a.batch_id, a.is_public, a.created_at, "
                + "(SELECT u.first_name || ' ' || u.last_name FROM users u WHERE u.id = a.created_by) AS author "
                + "FROM announcements a WHERE a.audience IN (" + audienceList + ")";
        if (!staff) {
            sql += """
                     AND (a.batch_id IS NULL OR a.batch_id IN (
                        SELECT s.batch_id FROM students s WHERE s.user_id = ?
                        UNION
                        SELECT s.batch_id FROM students s JOIN student_parents sp ON sp.student_id = s.id
                            JOIN parents p ON p.id = sp.parent_id WHERE p.user_id = ?))""";
            sql += " ORDER BY a.created_at DESC LIMIT 100";
            return ApiResponse.ok(db.list(sql, access.userId(), access.userId()));
        }
        return ApiResponse.ok(db.list(sql + " ORDER BY a.created_at DESC LIMIT 100"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody AnnouncementRequest req) {
        String audience = req.audience() == null ? "ALL" : req.audience();
        if (!AUDIENCES.contains(audience)) throw ApiException.badRequest("Unknown audience: " + audience);
        boolean canPublish = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL");
        if (req.isPublic() && !canPublish) throw ApiException.forbidden("Only administrators can publish public notices.");
        if (access.hasAnyRole("FACULTY") && !canPublish && req.batchId() == null) {
            throw ApiException.forbidden("Faculty can only post announcements to a specific batch.");
        }
        Long id = db.scalar(Long.class, """
                INSERT INTO announcements (title, body, audience, batch_id, is_public, created_by)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id""",
                req.title(), req.body(), audience, req.batchId(), req.isPublic(), access.userId());
        notifications.notifyAudience(audience, req.batchId(), "Announcement: " + req.title(), req.body(), "ANNOUNCEMENT", "/announcements");
        return ApiResponse.ok("Announcement posted.", Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<Void> delete(@PathVariable long id) {
        boolean admin = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL");
        int n = admin
                ? db.exec("DELETE FROM announcements WHERE id = ?", id)
                : db.exec("DELETE FROM announcements WHERE id = ? AND created_by = ?", id, access.userId());
        if (n == 0) throw ApiException.notFound("Announcement not found or not yours to delete.");
        return ApiResponse.message("Announcement deleted.");
    }
}
