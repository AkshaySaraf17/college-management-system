package com.cms.backend.scholarship;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.exam.AcademicMetrics;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/scholarships")
public class ScholarshipController {

    private static final String MANAGERS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','ACCOUNTANT')";

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;
    private final AcademicMetrics metrics;

    public ScholarshipController(Db db, AccessService access, NotificationService notifications, AcademicMetrics metrics) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    public record SchemeRequest(@NotBlank String name, String description, @NotBlank String discountType,
                                @NotNull @DecimalMin("0.01") BigDecimal discountValue, BigDecimal minCgpa) {}
    public record ApplyRequest(@NotNull Long schemeId, String statement) {}
    public record DecisionRequest(boolean approve, String remarks) {}

    @GetMapping("/schemes")
    public ApiResponse<List<Map<String, Object>>> schemes() {
        return ApiResponse.ok(db.list("SELECT id, name, description, discount_type, discount_value, min_cgpa, active FROM scholarship_schemes ORDER BY active DESC, name"));
    }

    @PostMapping("/schemes")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Map<String, Object>> createScheme(@Valid @RequestBody SchemeRequest r) {
        if (!List.of("PERCENT", "FIXED").contains(r.discountType())) throw ApiException.badRequest("Discount type must be PERCENT or FIXED.");
        if (r.discountType().equals("PERCENT") && r.discountValue().compareTo(BigDecimal.valueOf(100)) > 0) throw ApiException.badRequest("A percentage discount cannot exceed 100.");
        Long id = db.scalar(Long.class, "INSERT INTO scholarship_schemes (name, description, discount_type, discount_value, min_cgpa) VALUES (?, ?, ?, ?, ?) RETURNING id",
                r.name(), r.description(), r.discountType(), r.discountValue(), r.minCgpa());
        return ApiResponse.ok("Scholarship scheme created.", Map.of("id", id));
    }

    @PatchMapping("/schemes/{id}/active")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Void> setActive(@PathVariable long id, @RequestBody Map<String, Boolean> body) {
        db.exec("UPDATE scholarship_schemes SET active = ? WHERE id = ?", Boolean.TRUE.equals(body.get("active")), id);
        return ApiResponse.message("Scheme updated.");
    }

    @PostMapping("/applications")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<Map<String, Object>> apply(@Valid @RequestBody ApplyRequest r) {
        UUID studentId = access.currentStudentId();
        Map<String, Object> scheme = db.one("SELECT id, min_cgpa, active FROM scholarship_schemes WHERE id = ?", "Scheme not found.", r.schemeId());
        if (!Boolean.TRUE.equals(scheme.get("active"))) throw ApiException.conflict("This scheme is not open for applications.");
        BigDecimal min = (BigDecimal) scheme.get("minCgpa");
        BigDecimal cgpa = metrics.cgpa(studentId);
        if (min != null && cgpa != null && cgpa.compareTo(min) < 0) {
            throw ApiException.badRequest("This scheme requires a CGPA of at least " + min + " (yours is " + cgpa + ").");
        }
        if (db.exists("SELECT 1 FROM scholarship_applications WHERE scheme_id = ? AND student_id = ?", r.schemeId(), studentId)) {
            throw ApiException.conflict("You have already applied for this scheme.");
        }
        Long id = db.scalar(Long.class, "INSERT INTO scholarship_applications (scheme_id, student_id, statement) VALUES (?, ?, ?) RETURNING id",
                r.schemeId(), studentId, r.statement());
        notifications.notifyRole("ACCOUNTANT", "New scholarship application", "A student applied for a scholarship scheme.", "SCHOLARSHIP", "/scholarships");
        return ApiResponse.ok("Application submitted.", Map.of("id", id));
    }

    @GetMapping("/applications")
    @PreAuthorize(MANAGERS)
    public ApiResponse<List<Map<String, Object>>> applications(@RequestParam(required = false) String status) {
        String base = """
                SELECT a.id, a.scheme_id, sc.name AS scheme_name, sc.discount_type, sc.discount_value, a.student_id, s.roll_number,
                       u.first_name || ' ' || u.last_name AS student_name, a.statement, a.status, a.remarks, a.discount_applied, a.applied_at
                FROM scholarship_applications a JOIN scholarship_schemes sc ON sc.id = a.scheme_id
                JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id""";
        List<Map<String, Object>> rows = status == null || status.isBlank()
                ? db.list(base + " ORDER BY a.applied_at DESC")
                : db.list(base + " WHERE a.status = ? ORDER BY a.applied_at DESC", status);
        rows.forEach(r -> r.put("cgpa", metrics.cgpa((UUID) r.get("studentId"))));
        return ApiResponse.ok(rows);
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    public ApiResponse<List<Map<String, Object>>> mine(@RequestParam(required = false) UUID studentId) {
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("Choose a student.");
        access.requireStudentAccess(sid);
        return ApiResponse.ok(db.list("""
                SELECT a.id, sc.name AS scheme_name, a.status, a.remarks, a.discount_applied, a.applied_at
                FROM scholarship_applications a JOIN scholarship_schemes sc ON sc.id = a.scheme_id
                WHERE a.student_id = ? ORDER BY a.applied_at DESC""", sid));
    }

    /** On approval the discount is applied to the student's open invoices (percent: to each; fixed: to the earliest, up to its balance). */
    @PatchMapping("/applications/{id}/decide")
    @PreAuthorize(MANAGERS)
    @Transactional
    public ApiResponse<Map<String, Object>> decide(@PathVariable long id, @RequestBody DecisionRequest r) {
        Map<String, Object> app = db.one("""
                SELECT a.id, a.student_id, a.status, sc.name, sc.discount_type, sc.discount_value
                FROM scholarship_applications a JOIN scholarship_schemes sc ON sc.id = a.scheme_id WHERE a.id = ?""", "Application not found.", id);
        if (!"APPLIED".equals(app.get("status"))) throw ApiException.conflict("This application has already been decided.");
        UUID studentId = (UUID) app.get("studentId");

        BigDecimal applied = BigDecimal.ZERO;
        if (r.approve()) {
            BigDecimal value = (BigDecimal) app.get("discountValue");
            boolean percent = "PERCENT".equals(app.get("discountType"));
            BigDecimal fixedLeft = value;
            for (Map<String, Object> inv : db.list("""
                    SELECT id, total_amount, discount, paid_amount FROM fee_invoices
                    WHERE student_id = ? AND status IN ('PENDING','PARTIAL') ORDER BY due_date""", studentId)) {
                BigDecimal total = (BigDecimal) inv.get("totalAmount");
                BigDecimal room = total.subtract((BigDecimal) inv.get("discount")).subtract((BigDecimal) inv.get("paidAmount"));
                BigDecimal d = percent ? total.multiply(value).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP) : fixedLeft;
                d = d.min(room);
                if (d.signum() <= 0) continue;
                db.exec("UPDATE fee_invoices SET discount = discount + ? WHERE id = ?", d, inv.get("id"));
                applied = applied.add(d);
                if (!percent) {
                    fixedLeft = fixedLeft.subtract(d);
                    if (fixedLeft.signum() <= 0) break;
                }
            }
        }
        db.exec("UPDATE scholarship_applications SET status = ?, remarks = ?, discount_applied = ?, decided_at = now() WHERE id = ?",
                r.approve() ? "APPROVED" : "REJECTED", r.remarks(), r.approve() ? applied : null, id);
        notifications.notifyStudent(studentId, "Scholarship " + (r.approve() ? "approved" : "declined"),
                r.approve() ? "\"" + app.get("name") + "\" was approved; " + applied + " was deducted from your open invoices."
                        : "\"" + app.get("name") + "\" was not approved." + (r.remarks() == null ? "" : " " + r.remarks()), "SCHOLARSHIP", "/my/scholarships");
        return ApiResponse.ok(r.approve() ? "Approved." : "Rejected.", Map.of("discountApplied", applied));
    }
}
