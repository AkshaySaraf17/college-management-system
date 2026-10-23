package com.cms.backend.attendance;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    static final int THRESHOLD_PERCENT = 75;
    private static final Set<String> STUDENT_STATUSES = Set.of("PRESENT", "ABSENT", "LATE", "EXCUSED");
    private static final Set<String> FACULTY_STATUSES = Set.of("PRESENT", "ABSENT", "HALF_DAY", "ON_LEAVE");

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public AttendanceController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record Entry(@NotNull UUID studentId, @NotNull String status) {}
    public record MarkRequest(@NotNull Long subjectId, @NotNull Long batchId, @NotNull LocalDate date, Integer period,
                              String topic, @NotEmpty List<@Valid Entry> records) {}
    public record FacultyMarkRequest(@NotNull UUID facultyId, @NotNull LocalDate date, @NotNull String status) {}

    @GetMapping("/roster")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> roster(@RequestParam long batchId, @RequestParam long subjectId,
                                                          @RequestParam LocalDate date, @RequestParam(defaultValue = "1") int period) {
        return ApiResponse.ok(db.list("""
                SELECT s.id AS student_id, s.roll_number, u.first_name || ' ' || u.last_name AS full_name,
                  (SELECT r.status FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id
                    WHERE r.student_id = s.id AND a.subject_id = ? AND a.batch_id = ? AND a.session_date = ? AND a.period = ?) AS status
                FROM students s JOIN users u ON u.id = s.user_id
                WHERE s.batch_id = ? AND s.status = 'ACTIVE' ORDER BY s.roll_number""",
                subjectId, batchId, date, period, batchId));
    }

    @PostMapping("/mark")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    @Transactional
    public ApiResponse<Map<String, Object>> mark(@Valid @RequestBody MarkRequest req) {
        if (req.date().isAfter(LocalDate.now())) throw ApiException.badRequest("Attendance cannot be marked for a future date.");
        for (Entry e : req.records()) {
            if (!STUDENT_STATUSES.contains(e.status())) throw ApiException.badRequest("Invalid status: " + e.status());
        }
        UUID facultyId = access.currentFacultyId();
        if (access.hasAnyRole("FACULTY") && !access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD")) {
            if (facultyId == null || !db.exists("SELECT 1 FROM faculty_subject_allocations WHERE faculty_id = ? AND subject_id = ? AND batch_id = ?",
                    facultyId, req.subjectId(), req.batchId())) {
                throw ApiException.forbidden("You are not allocated to teach this subject for this batch.");
            }
        }
        int period = req.period() == null ? 1 : req.period();
        Long sessionId = db.scalar(Long.class, """
                INSERT INTO attendance_sessions (subject_id, batch_id, faculty_id, session_date, period, topic)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT (subject_id, batch_id, session_date, period)
                DO UPDATE SET topic = EXCLUDED.topic, faculty_id = COALESCE(EXCLUDED.faculty_id, attendance_sessions.faculty_id)
                RETURNING id""", req.subjectId(), req.batchId(), facultyId, req.date(), period, req.topic());

        Set<UUID> alreadyAbsent = new HashSet<>();
        db.list("SELECT student_id FROM attendance_records WHERE session_id = ? AND status = 'ABSENT'", sessionId)
                .forEach(r -> alreadyAbsent.add((UUID) r.get("studentId")));

        String subjectName = db.scalar(String.class, "SELECT name FROM subjects WHERE id = ?", req.subjectId());
        int absent = 0;
        for (Entry e : req.records()) {
            if (!db.exists("SELECT 1 FROM students WHERE id = ? AND batch_id = ?", e.studentId(), req.batchId())) {
                throw ApiException.badRequest("Student " + e.studentId() + " does not belong to this batch.");
            }
            db.exec("""
                    INSERT INTO attendance_records (session_id, student_id, status) VALUES (?, ?, ?)
                    ON CONFLICT (session_id, student_id) DO UPDATE SET status = EXCLUDED.status""", sessionId, e.studentId(), e.status());
            if (e.status().equals("ABSENT")) {
                absent++;
                if (!alreadyAbsent.contains(e.studentId())) {
                    notifications.notifyStudent(e.studentId(), "Marked absent",
                            "You were marked absent for " + subjectName + " on " + req.date() + ".", "ATTENDANCE", "/my/attendance");
                }
            }
        }
        return ApiResponse.ok("Attendance saved.", Map.of("sessionId", sessionId, "marked", req.records().size(), "absent", absent));
    }

    @GetMapping("/student/{studentId}/summary")
    public ApiResponse<Map<String, Object>> studentSummary(@PathVariable UUID studentId) {
        access.requireStudentAccess(studentId);
        return ApiResponse.ok(buildSummary(studentId));
    }

    @GetMapping("/student/{studentId}/records")
    public ApiResponse<List<Map<String, Object>>> studentRecords(@PathVariable UUID studentId, @RequestParam(required = false) String month) {
        access.requireStudentAccess(studentId);
        YearMonth ym = month == null ? YearMonth.now() : YearMonth.parse(month);
        return ApiResponse.ok(db.list("""
                SELECT a.session_date AS date, a.period, sub.name AS subject_name, r.status
                FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id JOIN subjects sub ON sub.id = a.subject_id
                WHERE r.student_id = ? AND a.session_date >= ? AND a.session_date <= ?
                ORDER BY a.session_date DESC, a.period""", studentId, ym.atDay(1), ym.atEndOfMonth()));
    }

    @GetMapping("/batch-summary")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> batchSummary(@RequestParam long batchId, @RequestParam(required = false) Long subjectId) {
        String subjectFilter = subjectId == null ? "" : " AND a.subject_id = " + subjectId;
        List<Map<String, Object>> rows = db.list("""
                SELECT s.id AS student_id, s.roll_number, u.first_name || ' ' || u.last_name AS full_name,
                  count(*) FILTER (WHERE r.status <> 'EXCUSED') AS total_classes,
                  count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) AS attended
                FROM students s JOIN users u ON u.id = s.user_id
                LEFT JOIN (attendance_records r JOIN attendance_sessions a ON a.id = r.session_id AND a.batch_id = ?""" + subjectFilter + """
                ) ON r.student_id = s.id
                WHERE s.batch_id = ? AND s.status = 'ACTIVE'
                GROUP BY s.id, s.roll_number, u.first_name, u.last_name ORDER BY s.roll_number""", batchId, batchId);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> m = new LinkedHashMap<>(row);
            BigDecimal pct = pct(row.get("attended"), row.get("totalClasses"));
            m.put("percentage", pct);
            m.put("belowThreshold", pct != null && pct.intValue() < THRESHOLD_PERCENT);
            out.add(m);
        }
        return ApiResponse.ok(out);
    }

    @PostMapping("/faculty")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','PRINCIPAL')")
    public ApiResponse<Void> markFaculty(@Valid @RequestBody FacultyMarkRequest req) {
        if (!FACULTY_STATUSES.contains(req.status())) throw ApiException.badRequest("Invalid status: " + req.status());
        db.exec("""
                INSERT INTO faculty_attendance (faculty_id, att_date, status) VALUES (?, ?, ?)
                ON CONFLICT (faculty_id, att_date) DO UPDATE SET status = EXCLUDED.status""", req.facultyId(), req.date(), req.status());
        return ApiResponse.message("Faculty attendance saved.");
    }

    @GetMapping("/faculty")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','PRINCIPAL','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> facultyAttendance(@RequestParam(required = false) String month) {
        YearMonth ym = month == null ? YearMonth.now() : YearMonth.parse(month);
        String own = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD", "PRINCIPAL") ? "" : " WHERE f.user_id = '" + access.userId() + "'";
        return ApiResponse.ok(db.list("""
                SELECT f.id AS faculty_id, f.employee_code, u.first_name || ' ' || u.last_name AS full_name,
                  count(*) FILTER (WHERE fa.status = 'PRESENT') AS present,
                  count(*) FILTER (WHERE fa.status = 'ABSENT') AS absent,
                  count(*) FILTER (WHERE fa.status = 'HALF_DAY') AS half_days,
                  count(*) FILTER (WHERE fa.status = 'ON_LEAVE') AS on_leave
                FROM faculties f JOIN users u ON u.id = f.user_id
                LEFT JOIN faculty_attendance fa ON fa.faculty_id = f.id AND fa.att_date >= ? AND fa.att_date <= ?""" + own + """
                 GROUP BY f.id, f.employee_code, u.first_name, u.last_name ORDER BY f.employee_code""", ym.atDay(1), ym.atEndOfMonth()));
    }

    Map<String, Object> buildSummary(UUID studentId) {
        List<Map<String, Object>> rows = db.list("""
                SELECT sub.id AS subject_id, sub.name AS subject_name, sub.code AS subject_code,
                  count(*) FILTER (WHERE r.status <> 'EXCUSED') AS total_classes,
                  count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) AS attended
                FROM attendance_records r JOIN attendance_sessions a ON a.id = r.session_id JOIN subjects sub ON sub.id = a.subject_id
                WHERE r.student_id = ? GROUP BY sub.id, sub.name, sub.code ORDER BY sub.name""", studentId);
        long total = 0, attended = 0;
        List<Map<String, Object>> subjects = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> m = new LinkedHashMap<>(row);
            BigDecimal p = pct(row.get("attended"), row.get("totalClasses"));
            m.put("percentage", p);
            m.put("belowThreshold", p != null && p.intValue() < THRESHOLD_PERCENT);
            subjects.add(m);
            total += ((Number) row.get("totalClasses")).longValue();
            attended += ((Number) row.get("attended")).longValue();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("subjects", subjects);
        out.put("totalClasses", total);
        out.put("attended", attended);
        out.put("percentage", pct(attended, total));
        out.put("threshold", THRESHOLD_PERCENT);
        return out;
    }

    static BigDecimal pct(Object attended, Object total) {
        long t = total == null ? 0 : ((Number) total).longValue();
        if (t == 0) return null;
        return BigDecimal.valueOf(((Number) attended).longValue() * 100.0 / t).setScale(1, RoundingMode.HALF_UP);
    }
}
