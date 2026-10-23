package com.cms.backend.exam;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.*;

@RestController
@RequestMapping("/api/exams")
public class ExamController {

    private static final Set<String> TYPES = Set.of("INTERNAL", "MIDTERM", "FINAL", "ONLINE");
    private static final Set<String> STATUSES = Set.of("SCHEDULED", "ONGOING", "COMPLETED");

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;

    public ExamController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record ExamRequest(@NotBlank String name, @NotBlank String examType, @NotNull Long batchId, @NotNull Long semesterId,
                              @NotBlank String academicYear, @NotNull LocalDate startDate, @NotNull LocalDate endDate) {}
    public record ScheduleRequest(@NotNull Long subjectId, @NotNull LocalDate examDate, @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                                  String room, @NotNull Integer maxMarks, @NotNull Integer passMarks, boolean online, Integer durationMinutes) {}
    public record QuestionRequest(@NotBlank String questionText, @NotBlank String optionA, @NotBlank String optionB, String optionC, String optionD,
                                  @NotNull @Pattern(regexp = "[ABCD]") String correctOption, Integer marks) {}
    public record Answer(@NotNull Long questionId, String selected) {}
    public record SubmitRequest(@NotNull List<Answer> answers) {}

    private static final String EXAM_SELECT = """
            SELECT e.id, e.name, e.exam_type, e.batch_id, b.name AS batch_name, e.semester_id, sem.name AS semester_name,
                   e.academic_year, e.start_date, e.end_date, e.status,
                   (SELECT count(*) FROM exam_schedules x WHERE x.exam_id = e.id) AS schedule_count
            FROM exams e JOIN batches b ON b.id = e.batch_id JOIN semesters sem ON sem.id = e.semester_id""";

    private static final String SCHEDULE_SELECT = """
            SELECT x.id, x.exam_id, x.subject_id, sub.name AS subject_name, sub.code AS subject_code, sub.credits, x.exam_date,
                   x.start_time, x.end_time, x.room, x.max_marks, x.pass_marks, x.is_online, x.duration_minutes
            FROM exam_schedules x JOIN subjects sub ON sub.id = x.subject_id""";

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) Long batchId) {
        if (batchId != null) return ApiResponse.ok(db.list(EXAM_SELECT + " WHERE e.batch_id = ? ORDER BY e.start_date DESC", batchId));
        return ApiResponse.ok(db.list(EXAM_SELECT + " ORDER BY e.start_date DESC"));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody ExamRequest r) {
        if (!TYPES.contains(r.examType())) throw ApiException.badRequest("Exam type must be one of " + TYPES);
        if (r.endDate().isBefore(r.startDate())) throw ApiException.badRequest("End date cannot be before start date.");
        if (!db.exists("SELECT 1 FROM batches b JOIN semesters s ON s.course_id = b.course_id WHERE b.id = ? AND s.id = ?", r.batchId(), r.semesterId())) {
            throw ApiException.badRequest("That semester does not belong to the batch's course.");
        }
        Long id = db.scalar(Long.class, """
                INSERT INTO exams (name, exam_type, batch_id, semester_id, academic_year, start_date, end_date)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.name(), r.examType(), r.batchId(), r.semesterId(), r.academicYear(), r.startDate(), r.endDate());
        return ApiResponse.ok("Exam created.", Map.of("id", id));
    }

    @GetMapping("/my")
    public ApiResponse<List<Map<String, Object>>> myExams(@RequestParam(required = false) UUID studentId) {
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("No student profile is associated with this account.");
        access.requireStudentAccess(sid);
        return ApiResponse.ok(db.list("""
                SELECT x.id AS schedule_id, e.id AS exam_id, e.name AS exam_name, e.exam_type, e.status AS exam_status,
                       sub.name AS subject_name, sub.code AS subject_code, x.exam_date, x.start_time, x.end_time, x.room,
                       x.max_marks, x.pass_marks, x.is_online, x.duration_minutes,
                       (SELECT a.submitted_at FROM exam_attempts a WHERE a.schedule_id = x.id AND a.student_id = s.id) AS submitted_at,
                       (SELECT a.id FROM exam_attempts a WHERE a.schedule_id = x.id AND a.student_id = s.id) AS attempt_id
                FROM students s JOIN exams e ON e.batch_id = s.batch_id
                JOIN exam_schedules x ON x.exam_id = e.id JOIN subjects sub ON sub.id = x.subject_id
                WHERE s.id = ? ORDER BY x.exam_date, x.start_time""", sid));
    }

    @GetMapping("/{id}")
    public ApiResponse<Map<String, Object>> get(@PathVariable long id) {
        Map<String, Object> exam = db.one(EXAM_SELECT + " WHERE e.id = ?", "Exam not found.", id);
        requireBatchVisible((Long) exam.get("batchId"));
        Map<String, Object> out = new LinkedHashMap<>(exam);
        out.put("schedules", db.list(SCHEDULE_SELECT + " WHERE x.exam_id = ? ORDER BY x.exam_date, x.start_time", id));
        return ApiResponse.ok(out);
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Void> setStatus(@PathVariable long id, @RequestBody Map<String, String> body) {
        String status = body.get("status");
        if (!STATUSES.contains(status)) throw ApiException.badRequest("Status must be one of " + STATUSES + " (use the publish action for results).");
        String current = db.scalar(String.class, "SELECT status FROM exams WHERE id = ?", id);
        if (current == null) throw ApiException.notFound("Exam not found.");
        if (current.equals("RESULTS_PUBLISHED")) throw ApiException.conflict("Results are already published for this exam.");
        db.exec("UPDATE exams SET status = ? WHERE id = ?", status, id);
        return ApiResponse.message("Exam status updated.");
    }

    @PostMapping("/{id}/schedules")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Map<String, Object>> addSchedule(@PathVariable long id, @Valid @RequestBody ScheduleRequest r) {
        Map<String, Object> exam = db.one("SELECT semester_id, start_date, end_date, status FROM exams WHERE id = ?", "Exam not found.", id);
        if ("RESULTS_PUBLISHED".equals(exam.get("status"))) throw ApiException.conflict("Results are already published.");
        if (!db.exists("SELECT 1 FROM subjects WHERE id = ? AND semester_id = ?", r.subjectId(), exam.get("semesterId"))) {
            throw ApiException.badRequest("That subject is not part of the exam's semester.");
        }
        if (r.passMarks() > r.maxMarks() || r.maxMarks() <= 0) throw ApiException.badRequest("Pass marks must not exceed max marks.");
        if (!r.endTime().isAfter(r.startTime())) throw ApiException.badRequest("End time must be after start time.");
        LocalDate start = ((java.sql.Date) exam.get("startDate")).toLocalDate();
        LocalDate end = ((java.sql.Date) exam.get("endDate")).toLocalDate();
        if (r.examDate().isBefore(start) || r.examDate().isAfter(end)) throw ApiException.badRequest("Exam date must fall within the exam window (" + start + " to " + end + ").");
        if (r.online() && (r.durationMinutes() == null || r.durationMinutes() <= 0)) throw ApiException.badRequest("Online exams need a duration in minutes.");
        Long sid = db.scalar(Long.class, """
                INSERT INTO exam_schedules (exam_id, subject_id, exam_date, start_time, end_time, room, max_marks, pass_marks, is_online, duration_minutes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                id, r.subjectId(), r.examDate(), r.startTime(), r.endTime(), r.room(), r.maxMarks(), r.passMarks(), r.online(), r.durationMinutes());
        Long batchId = db.scalar(Long.class, "SELECT batch_id FROM exams WHERE id = ?", id);
        notifications.notifyBatch(batchId, "Exam scheduled", "A new exam paper was scheduled for " + r.examDate() + ".", "EXAM", "/my/exams");
        return ApiResponse.ok("Exam schedule added.", Map.of("id", sid));
    }

    @DeleteMapping("/schedules/{sid}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Void> deleteSchedule(@PathVariable long sid) {
        String status = db.scalar(String.class, "SELECT e.status FROM exam_schedules x JOIN exams e ON e.id = x.exam_id WHERE x.id = ?", sid);
        if (status == null) throw ApiException.notFound("Schedule not found.");
        if (status.equals("RESULTS_PUBLISHED")) throw ApiException.conflict("Results are already published.");
        db.exec("DELETE FROM exam_schedules WHERE id = ?", sid);
        return ApiResponse.message("Schedule removed.");
    }

    // ---------------- Online exams ----------------

    @PostMapping("/schedules/{sid}/questions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    public ApiResponse<Map<String, Object>> addQuestion(@PathVariable long sid, @Valid @RequestBody QuestionRequest q) {
        requireOnlineSchedule(sid);
        if (q.marks() != null && q.marks() <= 0) throw ApiException.badRequest("Marks must be positive.");
        Long qid = db.scalar(Long.class, """
                INSERT INTO exam_questions (schedule_id, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                sid, q.questionText(), q.optionA(), q.optionB(), q.optionC(), q.optionD(), q.correctOption(), q.marks() == null ? 1 : q.marks());
        return ApiResponse.ok("Question added.", Map.of("id", qid));
    }

    @GetMapping("/schedules/{sid}/questions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> questions(@PathVariable long sid) {
        return ApiResponse.ok(db.list("SELECT * FROM exam_questions WHERE schedule_id = ? ORDER BY id", sid));
    }

    @DeleteMapping("/questions/{qid}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    public ApiResponse<Void> deleteQuestion(@PathVariable long qid) {
        if (db.exec("DELETE FROM exam_questions WHERE id = ?", qid) == 0) throw ApiException.notFound("Question not found.");
        return ApiResponse.message("Question removed.");
    }

    @PostMapping("/schedules/{sid}/start")
    @PreAuthorize("hasRole('STUDENT')")
    @Transactional
    public ApiResponse<Map<String, Object>> start(@PathVariable long sid) {
        Map<String, Object> sched = requireOnlineSchedule(sid);
        UUID studentId = access.currentStudentId();
        Map<String, Object> exam = db.one("SELECT e.batch_id, e.status FROM exam_schedules x JOIN exams e ON e.id = x.exam_id WHERE x.id = ?", "Exam not found.", sid);
        if (!db.exists("SELECT 1 FROM students WHERE id = ? AND batch_id = ?", studentId, exam.get("batchId"))) throw ApiException.forbidden("This exam is not for your batch.");
        if ("RESULTS_PUBLISHED".equals(exam.get("status"))) throw ApiException.conflict("This exam is closed.");
        LocalDate date = ((java.sql.Date) sched.get("examDate")).toLocalDate();
        if (!date.equals(LocalDate.now())) throw ApiException.badRequest("This exam can only be taken on " + date + ".");
        if (!db.exists("SELECT 1 FROM exam_questions WHERE schedule_id = ?", sid)) throw ApiException.conflict("The question paper is not ready yet.");

        Map<String, Object> attempt = db.find("SELECT id, submitted_at FROM exam_attempts WHERE schedule_id = ? AND student_id = ?", sid, studentId).orElse(null);
        if (attempt != null && attempt.get("submittedAt") != null) throw ApiException.conflict("You have already submitted this exam.");
        if (attempt == null) {
            db.exec("INSERT INTO exam_attempts (schedule_id, student_id) VALUES (?, ?) ON CONFLICT (schedule_id, student_id) DO NOTHING", sid, studentId);
        }
        return ApiResponse.ok(paper(sid, studentId));
    }

    @GetMapping("/schedules/{sid}/paper")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<Map<String, Object>> paperFor(@PathVariable long sid) {
        return ApiResponse.ok(paper(sid, access.currentStudentId()));
    }

    @PostMapping("/schedules/{sid}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    @Transactional
    public ApiResponse<Map<String, Object>> submit(@PathVariable long sid, @Valid @RequestBody SubmitRequest req) {
        UUID studentId = access.currentStudentId();
        Map<String, Object> attempt = db.find("SELECT id, submitted_at FROM exam_attempts WHERE schedule_id = ? AND student_id = ?", sid, studentId)
                .orElseThrow(() -> ApiException.badRequest("You have not started this exam."));
        if (attempt.get("submittedAt") != null) throw ApiException.conflict("You have already submitted this exam.");
        Long attemptId = (Long) attempt.get("id");

        Map<Long, String> correct = new HashMap<>();
        Map<Long, Integer> marks = new HashMap<>();
        int totalMarks = 0;
        for (Map<String, Object> q : db.list("SELECT id, correct_option, marks FROM exam_questions WHERE schedule_id = ?", sid)) {
            correct.put((Long) q.get("id"), String.valueOf(q.get("correctOption")));
            int m = ((Number) q.get("marks")).intValue();
            marks.put((Long) q.get("id"), m);
            totalMarks += m;
        }
        int score = 0;
        for (Answer a : req.answers()) {
            if (!correct.containsKey(a.questionId())) throw ApiException.badRequest("Question " + a.questionId() + " is not part of this exam.");
            String selected = a.selected() == null ? null : a.selected().toUpperCase();
            if (selected != null && !selected.matches("[ABCD]")) throw ApiException.badRequest("Invalid option: " + a.selected());
            db.exec("""
                    INSERT INTO exam_answers (attempt_id, question_id, selected_option) VALUES (?, ?, ?)
                    ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option = EXCLUDED.selected_option""", attemptId, a.questionId(), selected);
            if (selected != null && selected.equals(correct.get(a.questionId()))) score += marks.get(a.questionId());
        }
        Map<String, Object> sched = db.one("SELECT max_marks FROM exam_schedules WHERE id = ?", "Schedule not found.", sid);
        int maxMarks = ((Number) sched.get("maxMarks")).intValue();
        BigDecimal scaled = totalMarks == 0 ? BigDecimal.ZERO
                : BigDecimal.valueOf(score * (double) maxMarks / totalMarks).setScale(2, RoundingMode.HALF_UP);

        db.exec("UPDATE exam_attempts SET submitted_at = now(), score = ? WHERE id = ?", scaled, attemptId);
        db.exec("""
                INSERT INTO results (schedule_id, student_id, marks_obtained, absent) VALUES (?, ?, ?, FALSE)
                ON CONFLICT (schedule_id, student_id) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, absent = FALSE""", sid, studentId, scaled);
        return ApiResponse.ok("Exam submitted.", Map.of("score", score, "totalMarks", totalMarks, "marksObtained", scaled, "maxMarks", maxMarks));
    }

    private Map<String, Object> paper(long sid, UUID studentId) {
        Map<String, Object> attempt = db.find("SELECT id, started_at, submitted_at FROM exam_attempts WHERE schedule_id = ? AND student_id = ?", sid, studentId)
                .orElseThrow(() -> ApiException.badRequest("Start the exam first."));
        if (attempt.get("submittedAt") != null) throw ApiException.conflict("You have already submitted this exam.");
        Map<String, Object> sched = requireOnlineSchedule(sid);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("scheduleId", sid);
        out.put("startedAt", attempt.get("startedAt"));
        out.put("durationMinutes", sched.get("durationMinutes"));
        out.put("questions", db.list("""
                SELECT id, question_text, option_a, option_b, option_c, option_d, marks FROM exam_questions WHERE schedule_id = ? ORDER BY id""", sid));
        return out;
    }

    private Map<String, Object> requireOnlineSchedule(long sid) {
        Map<String, Object> sched = db.one("SELECT id, exam_date, is_online, duration_minutes FROM exam_schedules WHERE id = ?", "Exam schedule not found.", sid);
        if (!Boolean.TRUE.equals(sched.get("isOnline"))) throw ApiException.badRequest("This paper is not an online exam.");
        return sched;
    }

    private void requireBatchVisible(Long batchId) {
        if (access.isStudentDataStaff()) return;
        UUID uid = access.userId();
        boolean ok = db.exists("""
                SELECT 1 FROM students s WHERE s.batch_id = ? AND (s.user_id = ? OR EXISTS (
                    SELECT 1 FROM student_parents sp JOIN parents p ON p.id = sp.parent_id WHERE sp.student_id = s.id AND p.user_id = ?))""", batchId, uid, uid);
        if (!ok) throw ApiException.forbidden("You do not have access to this exam.");
    }
}
