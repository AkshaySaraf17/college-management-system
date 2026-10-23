package com.cms.backend.payroll;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/payroll")
public class PayrollController {

    private static final String PAYROLL_STAFF = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','ACCOUNTANT')";

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public PayrollController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record StructureRequest(@NotNull @DecimalMin("0") BigDecimal basic, BigDecimal hra, BigDecimal allowances, BigDecimal deductions) {}
    public record GenerateRequest(@NotNull @Min(1) @Max(12) Integer month, @NotNull @Min(2000) Integer year) {}

    @GetMapping("/structures")
    @PreAuthorize(PAYROLL_STAFF)
    public ApiResponse<List<Map<String, Object>>> structures() {
        return ApiResponse.ok(db.list("""
                SELECT f.id AS faculty_id, f.employee_code, u.first_name || ' ' || u.last_name AS full_name, d.name AS department_name,
                       s.basic, s.hra, s.allowances, s.deductions
                FROM faculties f JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id
                LEFT JOIN salary_structures s ON s.faculty_id = f.id WHERE f.status IN ('ACTIVE','ON_LEAVE') ORDER BY f.employee_code"""));
    }

    @PutMapping("/structures/{facultyId}")
    @PreAuthorize(PAYROLL_STAFF)
    public ApiResponse<Void> saveStructure(@PathVariable UUID facultyId, @Valid @RequestBody StructureRequest r) {
        if (!db.exists("SELECT 1 FROM faculties WHERE id = ?", facultyId)) throw ApiException.notFound("Faculty not found.");
        db.exec("""
                INSERT INTO salary_structures (faculty_id, basic, hra, allowances, deductions) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (faculty_id) DO UPDATE SET basic = EXCLUDED.basic, hra = EXCLUDED.hra, allowances = EXCLUDED.allowances, deductions = EXCLUDED.deductions""",
                facultyId, r.basic(), nz(r.hra()), nz(r.allowances()), nz(r.deductions()));
        return ApiResponse.message("Salary structure saved.");
    }

    /** Generates (or regenerates, if not yet paid) payslips for everyone with a salary structure; unpaid leave is deducted pro rata over 30 days. */
    @PostMapping("/generate")
    @PreAuthorize(PAYROLL_STAFF)
    @Transactional
    public ApiResponse<Map<String, Object>> generate(@Valid @RequestBody GenerateRequest r) {
        YearMonth ym = YearMonth.of(r.year(), r.month());
        LocalDate from = ym.atDay(1), to = ym.atEndOfMonth();
        int generated = 0, skipped = 0;
        for (Map<String, Object> s : db.list("""
                SELECT s.faculty_id, s.basic, s.hra, s.allowances, s.deductions, f.user_id FROM salary_structures s JOIN faculties f ON f.id = s.faculty_id
                WHERE f.status IN ('ACTIVE','ON_LEAVE')""")) {
            UUID facultyId = (UUID) s.get("facultyId");
            if (db.exists("SELECT 1 FROM payslips WHERE faculty_id = ? AND month = ? AND year = ? AND status = 'PAID'", facultyId, r.month(), r.year())) {
                skipped++;
                continue;
            }
            Long unpaidDays = db.scalar(Long.class, """
                    SELECT COALESCE(sum(GREATEST(0, LEAST(end_date, ?::date) - GREATEST(start_date, ?::date) + 1)), 0)
                    FROM faculty_leaves WHERE faculty_id = ? AND leave_type = 'UNPAID' AND status = 'APPROVED'
                      AND start_date <= ?::date AND end_date >= ?::date""", to, from, facultyId, to, from);
            long days = unpaidDays == null ? 0 : unpaidDays;
            BigDecimal basic = (BigDecimal) s.get("basic"), hra = (BigDecimal) s.get("hra"),
                    allow = (BigDecimal) s.get("allowances"), ded = (BigDecimal) s.get("deductions");
            BigDecimal leaveDed = basic.divide(BigDecimal.valueOf(30), 4, RoundingMode.HALF_UP).multiply(BigDecimal.valueOf(days)).setScale(2, RoundingMode.HALF_UP);
            BigDecimal net = basic.add(hra).add(allow).subtract(ded).subtract(leaveDed);
            db.exec("""
                    INSERT INTO payslips (faculty_id, month, year, basic, hra, allowances, deductions, unpaid_leave_days, leave_deduction, net_pay)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (faculty_id, month, year) DO UPDATE SET basic = EXCLUDED.basic, hra = EXCLUDED.hra, allowances = EXCLUDED.allowances,
                      deductions = EXCLUDED.deductions, unpaid_leave_days = EXCLUDED.unpaid_leave_days, leave_deduction = EXCLUDED.leave_deduction, net_pay = EXCLUDED.net_pay""",
                    facultyId, r.month(), r.year(), basic, hra, allow, ded, (int) days, leaveDed, net);
            notifications.notifyUser((UUID) s.get("userId"), "Payslip generated", "Your payslip for " + ym + " is available.", "PAYROLL", "/my/payslips");
            generated++;
        }
        return ApiResponse.ok("Payslips generated.", Map.of("generated", generated, "skippedAlreadyPaid", skipped));
    }

    @GetMapping("/payslips")
    @PreAuthorize(PAYROLL_STAFF)
    public ApiResponse<List<Map<String, Object>>> payslips(@RequestParam int month, @RequestParam int year) {
        return ApiResponse.ok(db.list("""
                SELECT p.*, f.employee_code, u.first_name || ' ' || u.last_name AS full_name
                FROM payslips p JOIN faculties f ON f.id = p.faculty_id JOIN users u ON u.id = f.user_id
                WHERE p.month = ? AND p.year = ? ORDER BY f.employee_code""", month, year));
    }

    @GetMapping("/payslips/me")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<List<Map<String, Object>>> myPayslips() {
        return ApiResponse.ok(db.list("""
                SELECT p.*, f.employee_code, u.first_name || ' ' || u.last_name AS full_name, d.name AS department_name, f.designation
                FROM payslips p JOIN faculties f ON f.id = p.faculty_id JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id
                WHERE f.user_id = ? ORDER BY p.year DESC, p.month DESC""", access.userId()));
    }

    @PatchMapping("/payslips/{id}/pay")
    @PreAuthorize(PAYROLL_STAFF)
    public ApiResponse<Void> markPaid(@PathVariable long id) {
        if (db.exec("UPDATE payslips SET status = 'PAID' WHERE id = ? AND status = 'GENERATED'", id) == 0) throw ApiException.conflict("Payslip not found or already paid.");
        return ApiResponse.message("Payslip marked as paid.");
    }

    private static BigDecimal nz(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
