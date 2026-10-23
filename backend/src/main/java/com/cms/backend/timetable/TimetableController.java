package com.cms.backend.timetable;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/timetable")
public class TimetableController {

    private static final String SELECT = """
            SELECT t.id, t.batch_id, b.name AS batch_name, t.subject_id, sub.name AS subject_name, sub.code AS subject_code,
                   t.faculty_id, fu.first_name || ' ' || fu.last_name AS faculty_name, t.day_of_week, t.start_time, t.end_time,
                   t.room, t.academic_year
            FROM timetable_slots t
            JOIN batches b ON b.id = t.batch_id JOIN subjects sub ON sub.id = t.subject_id
            JOIN faculties f ON f.id = t.faculty_id JOIN users fu ON fu.id = f.user_id""";

    private final Db db;
    private final AccessService access;

    public TimetableController(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    public record SlotRequest(@NotNull Long batchId, @NotNull Long subjectId, @NotNull UUID facultyId,
                              @NotNull @Min(1) @Max(7) Integer dayOfWeek, @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                              @NotBlank String room, @NotBlank String academicYear) {}

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    public ApiResponse<List<Map<String, Object>>> list(@RequestParam(required = false) Long batchId,
                                                         @RequestParam(required = false) UUID facultyId) {
        if (batchId != null) return ApiResponse.ok(db.list(SELECT + " WHERE t.batch_id = ? ORDER BY t.day_of_week, t.start_time", batchId));
        if (facultyId != null) return ApiResponse.ok(db.list(SELECT + " WHERE t.faculty_id = ? ORDER BY t.day_of_week, t.start_time", facultyId));
        return ApiResponse.ok(db.list(SELECT + " ORDER BY t.batch_id, t.day_of_week, t.start_time"));
    }

    /** The caller's own timetable: faculty see their classes; students/parents see the batch timetable. */
    @GetMapping("/my")
    public ApiResponse<List<Map<String, Object>>> mine(@RequestParam(required = false) UUID studentId) {
        if (studentId == null && access.hasAnyRole("FACULTY")) {
            UUID facultyId = access.currentFacultyId();
            return ApiResponse.ok(db.list(SELECT + " WHERE t.faculty_id = ? ORDER BY t.day_of_week, t.start_time", facultyId));
        }
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("No student profile is associated with this account.");
        access.requireStudentAccess(sid);
        return ApiResponse.ok(db.list(SELECT + " WHERE t.batch_id = (SELECT batch_id FROM students WHERE id = ?) ORDER BY t.day_of_week, t.start_time", sid));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Map<String, Object>> create(@Valid @RequestBody SlotRequest r) {
        if (!r.endTime().isAfter(r.startTime())) throw ApiException.badRequest("End time must be after start time.");
        if (!db.exists("""
                SELECT 1 FROM batches b JOIN semesters sem ON sem.course_id = b.course_id JOIN subjects s ON s.semester_id = sem.id
                WHERE b.id = ? AND s.id = ?""", r.batchId(), r.subjectId())) {
            throw ApiException.badRequest("That subject does not belong to the batch's course.");
        }
        assertFree("faculty_id", r.facultyId(), r, "This faculty member already has a class at that time.");
        assertFree("batch_id", r.batchId(), r, "This batch already has a class at that time.");
        assertFree("room", r.room(), r, "Room " + r.room() + " is already booked at that time.");

        Long id = db.scalar(Long.class, """
                INSERT INTO timetable_slots (batch_id, subject_id, faculty_id, day_of_week, start_time, end_time, room, academic_year)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.batchId(), r.subjectId(), r.facultyId(), r.dayOfWeek(), r.startTime(), r.endTime(), r.room(), r.academicYear());
        return ApiResponse.ok("Timetable slot added.", Map.of("id", id));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Void> delete(@PathVariable long id) {
        if (db.exec("DELETE FROM timetable_slots WHERE id = ?", id) == 0) throw ApiException.notFound("Slot not found.");
        return ApiResponse.message("Slot removed.");
    }

    private void assertFree(String column, Object value, SlotRequest r, String message) {
        boolean clash = db.exists("SELECT 1 FROM timetable_slots WHERE " + column + " = ? AND day_of_week = ? AND academic_year = ? "
                        + "AND start_time < ? AND end_time > ?",
                value, r.dayOfWeek(), r.academicYear(), r.endTime(), r.startTime());
        if (clash) throw ApiException.conflict(message);
    }
}
