package com.cms.backend.placement;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.exam.AcademicMetrics;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/placement")
public class PlacementController {

    private static final String OFFICERS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PLACEMENT_OFFICER')";
    private static final List<String> APP_STATUSES = List.of("APPLIED", "SHORTLISTED", "INTERVIEW", "SELECTED", "REJECTED");

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;
    private final AcademicMetrics metrics;

    public PlacementController(Db db, AccessService access, NotificationService notifications, AcademicMetrics metrics) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    public record CompanyRequest(@NotBlank String name, String industry, String website, String contactEmail) {}
    public record DriveRequest(@NotNull Long companyId, @NotBlank String title, String description, BigDecimal packageLpa, @NotNull LocalDate driveDate,
                               @NotNull LocalDate lastApplyDate, BigDecimal minCgpa, Long courseId) {}
    public record StatusUpdate(@NotBlank String status, String remarks) {}

    @GetMapping("/companies")
    @PreAuthorize(OFFICERS)
    public ApiResponse<List<Map<String, Object>>> companies() {
        return ApiResponse.ok(db.list("""
                SELECT c.id, c.name, c.industry, c.website, c.contact_email, (SELECT count(*) FROM placement_drives d WHERE d.company_id = c.id) AS drives
                FROM companies c ORDER BY c.name"""));
    }

    @PostMapping("/companies")
    @PreAuthorize(OFFICERS)
    public ApiResponse<Map<String, Object>> addCompany(@Valid @RequestBody CompanyRequest r) {
        Long id = db.scalar(Long.class, "INSERT INTO companies (name, industry, website, contact_email) VALUES (?, ?, ?, ?) RETURNING id",
                r.name(), r.industry(), r.website(), r.contactEmail());
        return ApiResponse.ok("Company added.", Map.of("id", id));
    }

    @DeleteMapping("/companies/{id}")
    @PreAuthorize(OFFICERS)
    public ApiResponse<Void> deleteCompany(@PathVariable long id) {
        if (db.exists("SELECT 1 FROM placement_drives WHERE company_id = ?", id)) throw ApiException.conflict("This company has drives; remove them first.");
        if (db.exec("DELETE FROM companies WHERE id = ?", id) == 0) throw ApiException.notFound("Company not found.");
        return ApiResponse.message("Company removed.");
    }

    @GetMapping("/drives")
    public ApiResponse<List<Map<String, Object>>> drives() {
        List<Map<String, Object>> drives = db.list("""
                SELECT d.id, d.company_id, c.name AS company_name, c.industry, d.title, d.description, d.package_lpa, d.drive_date, d.last_apply_date,
                       d.min_cgpa, d.course_id, co.name AS course_name, d.status,
                       (SELECT count(*) FROM placement_applications a WHERE a.drive_id = d.id) AS applicants
                FROM placement_drives d JOIN companies c ON c.id = d.company_id LEFT JOIN courses co ON co.id = d.course_id
                ORDER BY d.drive_date DESC""");
        if (!access.hasAnyRole("STUDENT")) return ApiResponse.ok(drives);

        UUID sid = access.currentStudentId();
        BigDecimal cgpa = metrics.cgpa(sid);
        Long courseId = db.scalar(Long.class, "SELECT course_id FROM students WHERE id = ?", sid);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> d : drives) {
            Map<String, Object> m = new LinkedHashMap<>(d);
            String reason = ineligibleReason(d, cgpa, courseId);
            m.put("eligible", reason == null);
            m.put("ineligibleReason", reason);
            Optional<Map<String, Object>> app = db.find("SELECT status FROM placement_applications WHERE drive_id = ? AND student_id = ?", d.get("id"), sid);
            m.put("applied", app.isPresent());
            m.put("applicationStatus", app.map(a -> a.get("status")).orElse(null));
            out.add(m);
        }
        return ApiResponse.ok(out);
    }

    @PostMapping("/drives")
    @PreAuthorize(OFFICERS)
    public ApiResponse<Map<String, Object>> addDrive(@Valid @RequestBody DriveRequest r) {
        if (r.lastApplyDate().isAfter(r.driveDate())) throw ApiException.badRequest("The application deadline must be on or before the drive date.");
        Long id = db.scalar(Long.class, """
                INSERT INTO placement_drives (company_id, title, description, package_lpa, drive_date, last_apply_date, min_cgpa, course_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.companyId(), r.title(), r.description(), r.packageLpa(), r.driveDate(), r.lastApplyDate(), r.minCgpa(), r.courseId());
        notifications.notifyRole("STUDENT", "New placement drive", r.title(), "PLACEMENT", "/placement");
        return ApiResponse.ok("Drive created.", Map.of("id", id));
    }

    @PatchMapping("/drives/{id}/status")
    @PreAuthorize(OFFICERS)
    public ApiResponse<Void> setDriveStatus(@PathVariable long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (!List.of("OPEN", "CLOSED", "COMPLETED").contains(status)) throw ApiException.badRequest("Invalid status.");
        if (db.exec("UPDATE placement_drives SET status = ? WHERE id = ?", status, id) == 0) throw ApiException.notFound("Drive not found.");
        return ApiResponse.message("Drive updated.");
    }

    @PostMapping("/drives/{id}/apply")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<Void> apply(@PathVariable long id) {
        UUID sid = access.currentStudentId();
        Map<String, Object> drive = db.one("SELECT id, status, last_apply_date, min_cgpa, course_id FROM placement_drives WHERE id = ?", "Drive not found.", id);
        Long courseId = db.scalar(Long.class, "SELECT course_id FROM students WHERE id = ?", sid);
        String reason = ineligibleReason(drive, metrics.cgpa(sid), courseId);
        if (reason != null) throw ApiException.badRequest(reason);
        if (db.exists("SELECT 1 FROM placement_applications WHERE drive_id = ? AND student_id = ?", id, sid)) throw ApiException.conflict("You have already applied to this drive.");
        db.exec("INSERT INTO placement_applications (drive_id, student_id) VALUES (?, ?)", id, sid);
        return ApiResponse.message("Application submitted.");
    }

    @GetMapping("/drives/{id}/applications")
    @PreAuthorize(OFFICERS)
    public ApiResponse<List<Map<String, Object>>> applications(@PathVariable long id) {
        List<Map<String, Object>> rows = db.list("""
                SELECT a.id, a.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name, u.email, co.name AS course_name,
                       a.status, a.remarks, a.applied_at
                FROM placement_applications a JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id JOIN courses co ON co.id = s.course_id
                WHERE a.drive_id = ? ORDER BY a.applied_at""", id);
        rows.forEach(r -> r.put("cgpa", metrics.cgpa((UUID) r.get("studentId"))));
        return ApiResponse.ok(rows);
    }

    @PatchMapping("/applications/{id}")
    @PreAuthorize(OFFICERS)
    public ApiResponse<Void> updateApplication(@PathVariable long id, @Valid @RequestBody StatusUpdate r) {
        if (!APP_STATUSES.contains(r.status())) throw ApiException.badRequest("Status must be one of " + APP_STATUSES);
        Map<String, Object> app = db.one("""
                SELECT a.student_id, d.title FROM placement_applications a JOIN placement_drives d ON d.id = a.drive_id WHERE a.id = ?""", "Application not found.", id);
        db.exec("UPDATE placement_applications SET status = ?, remarks = ? WHERE id = ?", r.status(), r.remarks(), id);
        notifications.notifyStudent((UUID) app.get("studentId"), "Placement update",
                "Your application for \"" + app.get("title") + "\" is now " + r.status().toLowerCase() + ".", "PLACEMENT", "/placement");
        return ApiResponse.message("Application updated.");
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<Map<String, Object>>> myApplications() {
        return ApiResponse.ok(db.list("""
                SELECT a.id, d.title, c.name AS company_name, d.package_lpa, d.drive_date, a.status, a.remarks, a.applied_at
                FROM placement_applications a JOIN placement_drives d ON d.id = a.drive_id JOIN companies c ON c.id = d.company_id
                WHERE a.student_id = ? ORDER BY a.applied_at DESC""", access.currentStudentId()));
    }

    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','PLACEMENT_OFFICER')")
    public ApiResponse<Map<String, Object>> stats() {
        Map<String, Object> out = new LinkedHashMap<>(db.one("""
                SELECT (SELECT count(*) FROM companies) AS companies,
                       (SELECT count(*) FROM placement_drives) AS drives,
                       (SELECT count(*) FROM placement_applications) AS applications,
                       (SELECT count(DISTINCT student_id) FROM placement_applications WHERE status = 'SELECTED') AS students_placed,
                       (SELECT count(*) FROM students WHERE status = 'ACTIVE') AS active_students,
                       (SELECT round(avg(d.package_lpa), 2) FROM placement_applications a JOIN placement_drives d ON d.id = a.drive_id WHERE a.status = 'SELECTED') AS average_package,
                       (SELECT max(d.package_lpa) FROM placement_applications a JOIN placement_drives d ON d.id = a.drive_id WHERE a.status = 'SELECTED') AS highest_package""", "No data"));
        out.put("topRecruiters", db.list("""
                SELECT c.name AS company_name, count(*) AS selected FROM placement_applications a JOIN placement_drives d ON d.id = a.drive_id
                JOIN companies c ON c.id = d.company_id WHERE a.status = 'SELECTED' GROUP BY c.name ORDER BY selected DESC LIMIT 5"""));
        return ApiResponse.ok(out);
    }

    private String ineligibleReason(Map<String, Object> drive, BigDecimal cgpa, Long studentCourseId) {
        if (!"OPEN".equals(drive.get("status"))) return "This drive is no longer open.";
        Object deadline = drive.get("lastApplyDate");
        if (deadline != null && ((java.sql.Date) deadline).toLocalDate().isBefore(LocalDate.now())) return "The application deadline has passed.";
        Object course = drive.get("courseId");
        if (course != null && !course.equals(studentCourseId)) return "This drive is restricted to a different course.";
        BigDecimal min = (BigDecimal) drive.get("minCgpa");
        if (min != null) {
            if (cgpa == null) return "A minimum CGPA of " + min + " is required, and you have no published results yet.";
            if (cgpa.compareTo(min) < 0) return "A minimum CGPA of " + min + " is required (yours is " + cgpa + ").";
        }
        return null;
    }
}
