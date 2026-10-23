package com.cms.backend.exam;

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
import java.util.*;

@RestController
@RequestMapping("/api/results")
public class ResultController {

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;
    private final AcademicMetrics metrics;

    public ResultController(Db db, AccessService access, NotificationService notifications, AcademicMetrics metrics) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
        this.metrics = metrics;
    }

    public record MarkEntry(@NotNull UUID studentId, BigDecimal marks, boolean absent) {}
    public record MarksRequest(@NotEmpty List<@Valid MarkEntry> entries) {}

    record Grade(String letter, double points, String status) {}

    static Grade grade(BigDecimal marks, boolean absent, int max, int pass) {
        if (absent || marks == null) return new Grade("AB", 0, "ABSENT");
        if (marks.compareTo(BigDecimal.valueOf(pass)) < 0) return new Grade("F", 0, "FAIL");
        double pct = marks.doubleValue() * 100.0 / max;
        if (pct >= 90) return new Grade("O", 10, "PASS");
        if (pct >= 80) return new Grade("A+", 9, "PASS");
        if (pct >= 70) return new Grade("A", 8, "PASS");
        if (pct >= 60) return new Grade("B+", 7, "PASS");
        if (pct >= 50) return new Grade("B", 6, "PASS");
        if (pct >= 40) return new Grade("C", 5, "PASS");
        return new Grade("D", 4, "PASS");
    }

    @GetMapping("/schedule/{sid}/sheet")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<Map<String, Object>> sheet(@PathVariable long sid) {
        Map<String, Object> sched = db.one("""
                SELECT x.id, x.max_marks, x.pass_marks, sub.name AS subject_name, e.name AS exam_name, e.status AS exam_status, e.batch_id
                FROM exam_schedules x JOIN exams e ON e.id = x.exam_id JOIN subjects sub ON sub.id = x.subject_id WHERE x.id = ?""",
                "Exam schedule not found.", sid);
        Map<String, Object> out = new LinkedHashMap<>(sched);
        out.put("rows", db.list("""
                SELECT s.id AS student_id, s.roll_number, u.first_name || ' ' || u.last_name AS full_name,
                       r.marks_obtained, COALESCE(r.absent, FALSE) AS absent, r.grade, r.result_status
                FROM exam_schedules x JOIN exams e ON e.id = x.exam_id
                JOIN students s ON s.batch_id = e.batch_id AND s.status = 'ACTIVE' JOIN users u ON u.id = s.user_id
                LEFT JOIN results r ON r.schedule_id = x.id AND r.student_id = s.id
                WHERE x.id = ? ORDER BY s.roll_number""", sid));
        return ApiResponse.ok(out);
    }

    @PutMapping("/schedule/{sid}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    @Transactional
    public ApiResponse<Map<String, Object>> saveMarks(@PathVariable long sid, @Valid @RequestBody MarksRequest req) {
        Map<String, Object> sched = db.one("""
                SELECT x.max_marks, x.subject_id, e.batch_id, e.status FROM exam_schedules x JOIN exams e ON e.id = x.exam_id WHERE x.id = ?""",
                "Exam schedule not found.", sid);
        if ("RESULTS_PUBLISHED".equals(sched.get("status"))) throw ApiException.conflict("Results are published; marks can no longer be changed.");
        if (access.hasAnyRole("FACULTY") && !access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD")) {
            UUID fid = access.currentFacultyId();
            if (fid == null || !db.exists("SELECT 1 FROM faculty_subject_allocations WHERE faculty_id = ? AND subject_id = ? AND batch_id = ?",
                    fid, sched.get("subjectId"), sched.get("batchId"))) {
                throw ApiException.forbidden("You are not allocated to teach this subject for this batch.");
            }
        }
        int max = ((Number) sched.get("maxMarks")).intValue();
        for (MarkEntry e : req.entries()) {
            if (!db.exists("SELECT 1 FROM students WHERE id = ? AND batch_id = ?", e.studentId(), sched.get("batchId"))) {
                throw ApiException.badRequest("Student " + e.studentId() + " is not in this exam's batch.");
            }
            if (!e.absent()) {
                if (e.marks() == null) throw ApiException.badRequest("Enter marks or mark the student absent.");
                if (e.marks().signum() < 0 || e.marks().compareTo(BigDecimal.valueOf(max)) > 0) {
                    throw ApiException.badRequest("Marks must be between 0 and " + max + ".");
                }
            }
            db.exec("""
                    INSERT INTO results (schedule_id, student_id, marks_obtained, absent) VALUES (?, ?, ?, ?)
                    ON CONFLICT (schedule_id, student_id) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, absent = EXCLUDED.absent""",
                    sid, e.studentId(), e.absent() ? null : e.marks(), e.absent());
        }
        return ApiResponse.ok("Marks saved.", Map.of("saved", req.entries().size()));
    }

    /** Grades every result, derives each student's SGPA for final exams, and makes results visible to students and parents. */
    @PostMapping("/exam/{examId}/publish")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    @Transactional
    public ApiResponse<Map<String, Object>> publish(@PathVariable long examId) {
        Map<String, Object> exam = db.one("SELECT id, name, exam_type, batch_id, semester_id, status FROM exams WHERE id = ?", "Exam not found.", examId);
        if ("RESULTS_PUBLISHED".equals(exam.get("status"))) throw ApiException.conflict("Results are already published.");

        List<Map<String, Object>> schedules = db.list("""
                SELECT x.id, x.max_marks, x.pass_marks, sub.credits FROM exam_schedules x JOIN subjects sub ON sub.id = x.subject_id WHERE x.exam_id = ?""", examId);
        if (schedules.isEmpty()) throw ApiException.badRequest("This exam has no scheduled papers.");
        Long activeStudents = db.scalar(Long.class, "SELECT count(*) FROM students WHERE batch_id = ? AND status = 'ACTIVE'", exam.get("batchId"));

        for (Map<String, Object> s : schedules) {
            Long entered = db.scalar(Long.class, """
                    SELECT count(*) FROM results r JOIN students st ON st.id = r.student_id
                    WHERE r.schedule_id = ? AND st.status = 'ACTIVE' AND st.batch_id = ?""", s.get("id"), exam.get("batchId"));
            if (entered == null || !entered.equals(activeStudents)) {
                throw ApiException.conflict("Marks are missing for " + (activeStudents - (entered == null ? 0 : entered))
                        + " student(s) in one of the papers. Enter marks or mark them absent before publishing.");
            }
        }

        Map<UUID, double[]> sgpaAcc = new LinkedHashMap<>();
        Map<UUID, Boolean> failed = new HashMap<>();
        for (Map<String, Object> s : schedules) {
            int max = ((Number) s.get("maxMarks")).intValue();
            int pass = ((Number) s.get("passMarks")).intValue();
            double credits = ((Number) s.get("credits")).doubleValue();
            for (Map<String, Object> r : db.list("SELECT student_id, marks_obtained, absent FROM results WHERE schedule_id = ?", s.get("id"))) {
                UUID studentId = (UUID) r.get("studentId");
                Grade g = grade((BigDecimal) r.get("marksObtained"), Boolean.TRUE.equals(r.get("absent")), max, pass);
                db.exec("UPDATE results SET grade = ?, grade_points = ?, result_status = ? WHERE schedule_id = ? AND student_id = ?",
                        g.letter(), g.points(), g.status(), s.get("id"), studentId);
                double[] acc = sgpaAcc.computeIfAbsent(studentId, k -> new double[2]);
                acc[0] += g.points() * credits;
                acc[1] += credits;
                if (!g.status().equals("PASS")) failed.put(studentId, true);
            }
        }

        boolean isFinal = "FINAL".equals(exam.get("examType"));
        db.exec("UPDATE exams SET status = 'RESULTS_PUBLISHED' WHERE id = ?", examId);
        for (Map.Entry<UUID, double[]> e : sgpaAcc.entrySet()) {
            if (isFinal) {
                BigDecimal sgpa = AcademicMetrics.round2(e.getValue()[1] == 0 ? 0 : e.getValue()[0] / e.getValue()[1]);
                db.exec("""
                        INSERT INTO student_academic_history (student_id, semester_id, status, sgpa) VALUES (?, ?, ?, ?)
                        ON CONFLICT (student_id, semester_id) DO UPDATE SET status = EXCLUDED.status, sgpa = EXCLUDED.sgpa""",
                        e.getKey(), exam.get("semesterId"), failed.containsKey(e.getKey()) ? "BACKLOG" : "COMPLETED", sgpa);
            }
            notifications.notifyStudent(e.getKey(), "Results published", "Results for \"" + exam.get("name") + "\" are now available.", "RESULT", "/my/results");
        }
        return ApiResponse.ok("Results published.", Map.of("students", sgpaAcc.size(), "papers", schedules.size()));
    }

    @GetMapping("/student/{studentId}")
    public ApiResponse<Map<String, Object>> studentResults(@PathVariable UUID studentId) {
        access.requireStudentAccess(studentId);
        List<Map<String, Object>> rows = db.list("""
                SELECT e.id AS exam_id, e.name AS exam_name, e.exam_type, sem.name AS semester_name, sub.name AS subject_name,
                       sub.code AS subject_code, sub.credits, x.max_marks, x.pass_marks, r.marks_obtained, r.grade, r.grade_points, r.result_status
                FROM results r JOIN exam_schedules x ON x.id = r.schedule_id JOIN exams e ON e.id = x.exam_id
                JOIN semesters sem ON sem.id = e.semester_id JOIN subjects sub ON sub.id = x.subject_id
                WHERE r.student_id = ? AND e.status = 'RESULTS_PUBLISHED' ORDER BY e.start_date DESC, sub.name""", studentId);
        Map<Long, Map<String, Object>> byExam = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Map<String, Object> exam = byExam.computeIfAbsent((Long) row.get("examId"), k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("examId", row.get("examId"));
                m.put("examName", row.get("examName"));
                m.put("examType", row.get("examType"));
                m.put("semesterName", row.get("semesterName"));
                m.put("results", new ArrayList<Map<String, Object>>());
                return m;
            });
            @SuppressWarnings("unchecked") List<Map<String, Object>> list = (List<Map<String, Object>>) exam.get("results");
            list.add(row);
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("exams", new ArrayList<>(byExam.values()));
        out.put("cgpa", metrics.cgpa(studentId));
        out.put("semesters", db.list("""
                SELECT sem.name AS semester_name, h.sgpa, h.status FROM student_academic_history h JOIN semesters sem ON sem.id = h.semester_id
                WHERE h.student_id = ? ORDER BY sem.number""", studentId));
        return ApiResponse.ok(out);
    }

    @GetMapping("/exam/{examId}/summary")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> examSummary(@PathVariable long examId) {
        return ApiResponse.ok(db.list("""
                SELECT sub.name AS subject_name, count(r.id) AS appeared,
                       count(*) FILTER (WHERE r.result_status = 'PASS') AS passed,
                       count(*) FILTER (WHERE r.result_status = 'FAIL') AS failed,
                       count(*) FILTER (WHERE r.result_status = 'ABSENT') AS absent,
                       round(avg(r.marks_obtained), 1) AS average_marks, max(r.marks_obtained) AS highest, x.max_marks
                FROM exam_schedules x JOIN subjects sub ON sub.id = x.subject_id LEFT JOIN results r ON r.schedule_id = x.id
                WHERE x.exam_id = ? GROUP BY sub.name, x.max_marks, x.id ORDER BY sub.name""", examId));
    }
}
