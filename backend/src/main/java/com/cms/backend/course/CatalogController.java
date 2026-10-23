package com.cms.backend.course;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Lookup lists used by pickers across the UI (batches, a batch's subjects, a faculty member's teaching load). */
@RestController
@RequestMapping("/api/catalog")
public class CatalogController {

    private final Db db;
    private final AccessService access;

    public CatalogController(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    @GetMapping("/batches")
    public ApiResponse<List<Map<String, Object>>> batches() {
        return ApiResponse.ok(db.list("""
                SELECT b.id, b.name, b.start_year, b.end_year, b.course_id, c.name AS course_name, c.code AS course_code
                FROM batches b JOIN courses c ON c.id = b.course_id ORDER BY c.code, b.start_year DESC"""));
    }

    @GetMapping("/batches/{batchId}/subjects")
    public ApiResponse<List<Map<String, Object>>> subjects(@PathVariable long batchId) {
        return ApiResponse.ok(db.list("""
                SELECT s.id, s.name, s.code, s.credits, sem.id AS semester_id, sem.name AS semester_name, sem.number AS semester_number
                FROM batches b JOIN semesters sem ON sem.course_id = b.course_id JOIN subjects s ON s.semester_id = sem.id
                WHERE b.id = ? ORDER BY sem.number, s.name""", batchId));
    }

    @GetMapping("/teaching")
    public ApiResponse<List<Map<String, Object>>> teaching() {
        UUID facultyId = access.currentFacultyId();
        if (facultyId == null) return ApiResponse.ok(List.of());
        return ApiResponse.ok(db.list("""
                SELECT a.batch_id, b.name AS batch_name, c.name AS course_name, a.subject_id, s.name AS subject_name, s.code AS subject_code, a.academic_year
                FROM faculty_subject_allocations a JOIN batches b ON b.id = a.batch_id JOIN courses c ON c.id = b.course_id JOIN subjects s ON s.id = a.subject_id
                WHERE a.faculty_id = ? ORDER BY a.academic_year DESC, c.name, s.name""", facultyId));
    }
}
