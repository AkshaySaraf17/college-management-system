package com.cms.backend.faculty;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/faculty")
public class FacultyPerformanceController {

    private final Db db;
    private final AccessService access;

    public FacultyPerformanceController(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    /** Teaching-activity report derived from attendance, exam results, assignments and leave records. */
    @GetMapping("/{id}/performance")
    public ApiResponse<Map<String, Object>> performance(@PathVariable UUID id) {
        boolean admin = access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "PRINCIPAL", "HOD");
        if (!admin && !id.equals(access.currentFacultyId())) throw ApiException.forbidden("You can only view your own performance report.");
        Map<String, Object> faculty = db.one("""
                SELECT f.id, f.employee_code, u.first_name || ' ' || u.last_name AS full_name, d.name AS department_name, f.designation
                FROM faculties f JOIN users u ON u.id = f.user_id LEFT JOIN departments d ON d.id = f.department_id WHERE f.id = ?""", "Faculty not found.", id);

        Map<String, Object> out = new LinkedHashMap<>(faculty);
        out.put("allocations", db.list("""
                SELECT sub.name AS subject_name, b.name AS batch_name, a.academic_year,
                       (SELECT count(*) FROM attendance_sessions s WHERE s.subject_id = a.subject_id AND s.batch_id = a.batch_id AND s.faculty_id = a.faculty_id) AS classes_held,
                       (SELECT round(100.0 * count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) / NULLIF(count(*) FILTER (WHERE r.status <> 'EXCUSED'), 0), 1)
                          FROM attendance_sessions s JOIN attendance_records r ON r.session_id = s.id
                         WHERE s.subject_id = a.subject_id AND s.batch_id = a.batch_id) AS average_attendance,
                       (SELECT round(avg(r.marks_obtained * 100.0 / x.max_marks), 1)
                          FROM exam_schedules x JOIN exams e ON e.id = x.exam_id JOIN results r ON r.schedule_id = x.id
                         WHERE x.subject_id = a.subject_id AND e.batch_id = a.batch_id AND e.status = 'RESULTS_PUBLISHED' AND r.absent = FALSE) AS average_marks_percent,
                       (SELECT round(100.0 * count(*) FILTER (WHERE r.result_status = 'PASS') / NULLIF(count(r.id), 0), 1)
                          FROM exam_schedules x JOIN exams e ON e.id = x.exam_id JOIN results r ON r.schedule_id = x.id
                         WHERE x.subject_id = a.subject_id AND e.batch_id = a.batch_id AND e.status = 'RESULTS_PUBLISHED') AS pass_percentage
                FROM faculty_subject_allocations a JOIN subjects sub ON sub.id = a.subject_id JOIN batches b ON b.id = a.batch_id
                WHERE a.faculty_id = ? ORDER BY a.academic_year DESC, sub.name""", id));
        out.putAll(db.one("""
                SELECT (SELECT count(*) FROM attendance_sessions WHERE faculty_id = ?) AS total_classes_held,
                       (SELECT count(*) FROM assignments a JOIN faculties f ON f.user_id = a.created_by WHERE f.id = ?) AS assignments_posted,
                       (SELECT count(*) FROM course_materials m JOIN faculties f ON f.user_id = m.uploaded_by WHERE f.id = ?) AS materials_shared,
                       (SELECT COALESCE(sum(end_date - start_date + 1), 0) FROM faculty_leaves WHERE faculty_id = ? AND status = 'APPROVED') AS leave_days_taken,
                       (SELECT count(*) FROM faculty_attendance WHERE faculty_id = ? AND status = 'PRESENT') AS days_present""",
                "No data", id, id, id, id, id));
        return ApiResponse.ok(out);
    }
}
