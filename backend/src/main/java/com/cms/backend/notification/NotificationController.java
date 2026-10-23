package com.cms.backend.notification;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private static final Set<String> AUDIENCES = Set.of("ALL", "STUDENTS", "FACULTY", "PARENTS", "STAFF");

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public NotificationController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record BroadcastRequest(@NotBlank String audience, Long batchId, @NotBlank String title, @NotBlank String message) {}

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> mine(@RequestParam(defaultValue = "false") boolean unreadOnly) {
        String filter = unreadOnly ? " AND is_read = FALSE" : "";
        return ApiResponse.ok(db.list("SELECT id, title, message, type, link, is_read, created_at FROM notifications WHERE user_id = ?"
                + filter + " ORDER BY created_at DESC LIMIT 100", access.userId()));
    }

    @GetMapping("/unread-count")
    public ApiResponse<Map<String, Object>> unreadCount() {
        Long n = db.scalar(Long.class, "SELECT count(*) FROM notifications WHERE user_id = ? AND is_read = FALSE", access.userId());
        return ApiResponse.ok(Map.of("count", n == null ? 0 : n));
    }

    @PostMapping("/{id}/read")
    public ApiResponse<Void> markRead(@PathVariable long id) {
        db.exec("UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?", id, access.userId());
        return ApiResponse.message("Marked as read.");
    }

    @PostMapping("/read-all")
    public ApiResponse<Void> markAllRead() {
        db.exec("UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE", access.userId());
        return ApiResponse.message("All notifications marked as read.");
    }

    @PostMapping("/broadcast")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<Map<String, Object>> broadcast(@Valid @RequestBody BroadcastRequest req) {
        if (!AUDIENCES.contains(req.audience())) throw ApiException.badRequest("Unknown audience: " + req.audience());
        int sent = notifications.notifyAudience(req.audience(), req.batchId(), req.title(), req.message(), "BROADCAST", null);
        return ApiResponse.ok("Broadcast sent.", Map.of("recipients", sent));
    }
}
