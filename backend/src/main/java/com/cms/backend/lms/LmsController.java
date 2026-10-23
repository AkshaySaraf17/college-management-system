package com.cms.backend.lms;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/lms")
public class LmsController {

    private static final String TEACHERS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')";

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public LmsController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record MaterialRequest(@NotNull Long subjectId, Long batchId, @NotBlank String title, String description, UUID fileId, String linkUrl) {}
    public record AssignmentRequest(@NotNull Long subjectId, @NotNull Long batchId, @NotBlank String title, String description,
                                    @NotNull LocalDate dueDate, @NotNull @Min(1) Integer maxMarks) {}
    public record SubmitRequest(String content, UUID fileId) {}
    public record GradeRequest(@NotNull BigDecimal marks, String feedback) {}

    // ---------------- Materials ----------------

    @GetMapping("/materials")
    public ApiResponse<List<Map<String, Object>>> materials(@RequestParam(required = false) Long subjectId, @RequestParam(required = false) Long batchId,
                                                             @RequestParam(required = false) UUID studentId) {
        String base = """
                SELECT m.id, m.subject_id, sub.name AS subject_name, m.batch_id, m.title, m.description, m.file_id, f.original_name AS file_name,
                       m.link_url, m.created_at, u.first_name || ' ' || u.last_name AS uploaded_by_name
                FROM course_materials m JOIN subjects sub ON sub.id = m.subject_id LEFT JOIN stored_files f ON f.id = m.file_id LEFT JOIN users u ON u.id = m.uploaded_by
                WHERE TRUE""";
        StringBuilder sql = new StringBuilder(base);
        List<Object> args = new ArrayList<>();
        if (!access.isStudentDataStaff()) {
            UUID sid = studentId != null ? studentId : access.currentStudentId();
            if (sid == null) throw ApiException.badRequest("Choose a student.");
            access.requireStudentAccess(sid);
            sql.append(" AND (m.batch_id IS NULL OR m.batch_id = (SELECT batch_id FROM students WHERE id = ?))");
            sql.append(" AND m.subject_id IN (SELECT sb.id FROM students st JOIN semesters sm ON sm.course_id = st.course_id JOIN subjects sb ON sb.semester_id = sm.id WHERE st.id = ?)");
            args.add(sid);
            args.add(sid);
        }
        if (subjectId != null) {
            sql.append(" AND m.subject_id = ?");
            args.add(subjectId);
        }
        if (batchId != null) {
            sql.append(" AND (m.batch_id IS NULL OR m.batch_id = ?)");
            args.add(batchId);
        }
        sql.append(" ORDER BY m.created_at DESC LIMIT 200");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @PostMapping("/materials")
    @PreAuthorize(TEACHERS)
    public ApiResponse<Map<String, Object>> addMaterial(@Valid @RequestBody MaterialRequest r) {
        if (r.fileId() == null && (r.linkUrl() == null || r.linkUrl().isBlank())) throw ApiException.badRequest("Attach a file or provide a link.");
        if (r.linkUrl() != null && !r.linkUrl().isBlank() && !r.linkUrl().matches("(?i)^https?://\\S+$")) {
            throw ApiException.badRequest("Links must start with http:// or https://.");
        }
        requireTeaches(r.subjectId(), r.batchId());
        Long id = db.scalar(Long.class, """
                INSERT INTO course_materials (subject_id, batch_id, title, description, file_id, link_url, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.subjectId(), r.batchId(), r.title(), r.description(), r.fileId(), r.linkUrl(), access.userId());
        if (r.batchId() != null) notifications.notifyBatch(r.batchId(), "New study material", r.title(), "LMS", "/my/learning");
        return ApiResponse.ok("Material added.", Map.of("id", id));
    }

    @DeleteMapping("/materials/{id}")
    @PreAuthorize(TEACHERS)
    public ApiResponse<Void> deleteMaterial(@PathVariable long id) {
        int n = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD") ? db.exec("DELETE FROM course_materials WHERE id = ?", id)
                : db.exec("DELETE FROM course_materials WHERE id = ? AND uploaded_by = ?", id, access.userId());
        if (n == 0) throw ApiException.notFound("Material not found or not yours to delete.");
        return ApiResponse.message("Material removed.");
    }

    // ---------------- Assignments ----------------

    @PostMapping("/assignments")
    @PreAuthorize(TEACHERS)
    public ApiResponse<Map<String, Object>> createAssignment(@Valid @RequestBody AssignmentRequest r) {
        requireTeaches(r.subjectId(), r.batchId());
        Long id = db.scalar(Long.class, """
                INSERT INTO assignments (subject_id, batch_id, title, description, due_date, max_marks, created_by) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.subjectId(), r.batchId(), r.title(), r.description(), r.dueDate(), r.maxMarks(), access.userId());
        notifications.notifyBatch(r.batchId(), "New assignment", r.title() + " is due on " + r.dueDate() + ".", "ASSIGNMENT", "/my/learning");
        return ApiResponse.ok("Assignment posted.", Map.of("id", id));
    }

    @GetMapping("/assignments")
    @PreAuthorize(TEACHERS)
    public ApiResponse<List<Map<String, Object>>> assignments(@RequestParam(required = false) Long batchId, @RequestParam(required = false) Long subjectId) {
        StringBuilder sql = new StringBuilder("""
                SELECT a.id, a.subject_id, sub.name AS subject_name, a.batch_id, b.name AS batch_name, a.title, a.description, a.due_date, a.max_marks, a.created_at,
                       (SELECT count(*) FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submissions,
                       (SELECT count(*) FROM assignment_submissions s WHERE s.assignment_id = a.id AND s.graded_at IS NOT NULL) AS graded,
                       (SELECT count(*) FROM students st WHERE st.batch_id = a.batch_id AND st.status = 'ACTIVE') AS class_size
                FROM assignments a JOIN subjects sub ON sub.id = a.subject_id JOIN batches b ON b.id = a.batch_id WHERE TRUE""");
        List<Object> args = new ArrayList<>();
        if (batchId != null) {
            sql.append(" AND a.batch_id = ?");
            args.add(batchId);
        }
        if (subjectId != null) {
            sql.append(" AND a.subject_id = ?");
            args.add(subjectId);
        }
        sql.append(" ORDER BY a.due_date DESC LIMIT 200");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @GetMapping("/assignments/my")
    public ApiResponse<List<Map<String, Object>>> myAssignments(@RequestParam(required = false) UUID studentId) {
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("Choose a student.");
        access.requireStudentAccess(sid);
        return ApiResponse.ok(db.list("""
                SELECT a.id, a.title, a.description, a.due_date, a.max_marks, sub.name AS subject_name,
                       s.id AS submission_id, s.submitted_at, s.content, s.file_id, s.marks, s.feedback, s.graded_at,
                       (s.id IS NOT NULL AND s.submitted_at::date > a.due_date) AS late,
                       (s.id IS NULL AND a.due_date < CURRENT_DATE) AS missed
                FROM students st JOIN assignments a ON a.batch_id = st.batch_id JOIN subjects sub ON sub.id = a.subject_id
                LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = st.id
                WHERE st.id = ? ORDER BY a.due_date DESC""", sid));
    }

    @PostMapping("/assignments/{id}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<Void> submit(@PathVariable long id, @RequestBody SubmitRequest r) {
        UUID sid = access.currentStudentId();
        if ((r.content() == null || r.content().isBlank()) && r.fileId() == null) throw ApiException.badRequest("Write an answer or attach a file.");
        Map<String, Object> a = db.one("SELECT batch_id FROM assignments WHERE id = ?", "Assignment not found.", id);
        if (!db.exists("SELECT 1 FROM students WHERE id = ? AND batch_id = ?", sid, a.get("batchId"))) throw ApiException.forbidden("This assignment is not for your batch.");
        if (db.exists("SELECT 1 FROM assignment_submissions WHERE assignment_id = ? AND student_id = ? AND graded_at IS NOT NULL", id, sid)) {
            throw ApiException.conflict("This submission has been graded and can no longer be changed.");
        }
        db.exec("""
                INSERT INTO assignment_submissions (assignment_id, student_id, content, file_id) VALUES (?, ?, ?, ?)
                ON CONFLICT (assignment_id, student_id) DO UPDATE SET content = EXCLUDED.content, file_id = EXCLUDED.file_id, submitted_at = now()""",
                id, sid, r.content(), r.fileId());
        return ApiResponse.message("Submitted.");
    }

    @GetMapping("/assignments/{id}/submissions")
    @PreAuthorize(TEACHERS)
    public ApiResponse<List<Map<String, Object>>> submissions(@PathVariable long id) {
        return ApiResponse.ok(db.list("""
                SELECT st.id AS student_id, st.roll_number, u.first_name || ' ' || u.last_name AS student_name,
                       s.id AS submission_id, s.content, s.file_id, f.original_name AS file_name, s.submitted_at, s.marks, s.feedback, s.graded_at,
                       (s.id IS NOT NULL AND s.submitted_at::date > a.due_date) AS late
                FROM assignments a JOIN students st ON st.batch_id = a.batch_id AND st.status = 'ACTIVE' JOIN users u ON u.id = st.user_id
                LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = st.id LEFT JOIN stored_files f ON f.id = s.file_id
                WHERE a.id = ? ORDER BY st.roll_number""", id));
    }

    @PatchMapping("/submissions/{id}/grade")
    @PreAuthorize(TEACHERS)
    public ApiResponse<Void> grade(@PathVariable long id, @Valid @RequestBody GradeRequest r) {
        Map<String, Object> s = db.one("""
                SELECT s.student_id, a.max_marks, a.title FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id WHERE s.id = ?""",
                "Submission not found.", id);
        if (r.marks().signum() < 0 || r.marks().compareTo(BigDecimal.valueOf(((Number) s.get("maxMarks")).longValue())) > 0) {
            throw ApiException.badRequest("Marks must be between 0 and " + s.get("maxMarks") + ".");
        }
        db.exec("UPDATE assignment_submissions SET marks = ?, feedback = ?, graded_at = now() WHERE id = ?", r.marks(), r.feedback(), id);
        notifications.notifyStudent((UUID) s.get("studentId"), "Assignment graded", "\"" + s.get("title") + "\": " + r.marks() + "/" + s.get("maxMarks"), "ASSIGNMENT", "/my/learning");
        return ApiResponse.message("Graded.");
    }

    @DeleteMapping("/assignments/{id}")
    @PreAuthorize(TEACHERS)
    public ApiResponse<Void> deleteAssignment(@PathVariable long id) {
        int n = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD") ? db.exec("DELETE FROM assignments WHERE id = ?", id)
                : db.exec("DELETE FROM assignments WHERE id = ? AND created_by = ?", id, access.userId());
        if (n == 0) throw ApiException.notFound("Assignment not found or not yours to delete.");
        return ApiResponse.message("Assignment removed.");
    }

    private void requireTeaches(Long subjectId, Long batchId) {
        if (access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOD")) return;
        UUID fid = access.currentFacultyId();
        boolean ok = fid != null && (batchId == null
                ? db.exists("SELECT 1 FROM faculty_subject_allocations WHERE faculty_id = ? AND subject_id = ?", fid, subjectId)
                : db.exists("SELECT 1 FROM faculty_subject_allocations WHERE faculty_id = ? AND subject_id = ? AND batch_id = ?", fid, subjectId, batchId));
        if (!ok) throw ApiException.forbidden("You are not allocated to teach this subject for this batch.");
    }
}
