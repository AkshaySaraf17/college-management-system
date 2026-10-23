package com.cms.backend.parent;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/parents")
@PreAuthorize("hasRole('PARENT')")
public class ParentPortalController {

    private final Db db;
    private final AccessService access;

    public ParentPortalController(Db db, AccessService access) {
        this.db = db;
        this.access = access;
    }

    public record LinkRequest(@NotBlank String rollNumber, @NotNull LocalDate dateOfBirth, String relation) {}

    @GetMapping("/me/children")
    public ApiResponse<List<Map<String, Object>>> children() {
        return ApiResponse.ok(db.list("""
                SELECT s.id, u.first_name || ' ' || u.last_name AS full_name, s.roll_number, c.name AS course_name,
                       b.name AS batch_name, sem.name AS current_semester_name, s.status
                FROM parents p
                JOIN student_parents sp ON sp.parent_id = p.id
                JOIN students s ON s.id = sp.student_id
                JOIN users u ON u.id = s.user_id
                JOIN courses c ON c.id = s.course_id
                JOIN batches b ON b.id = s.batch_id
                LEFT JOIN semesters sem ON sem.id = s.current_semester_id
                WHERE p.user_id = ? ORDER BY u.first_name""", access.userId()));
    }

    /** A parent proves relationship by supplying the child's roll number and date of birth. */
    @PostMapping("/link")
    @Transactional
    public ApiResponse<Map<String, Object>> link(@Valid @RequestBody LinkRequest req) {
        Map<String, Object> student = db.find("SELECT id FROM students WHERE roll_number = ? AND date_of_birth = ?",
                req.rollNumber().trim(), req.dateOfBirth())
                .orElseThrow(() -> ApiException.badRequest("No student matches that roll number and date of birth."));
        UUID studentId = (UUID) student.get("id");
        UUID userId = access.userId();

        UUID parentId = db.scalar(UUID.class, "SELECT id FROM parents WHERE user_id = ?", userId);
        if (parentId == null) {
            parentId = db.scalar(UUID.class, """
                    INSERT INTO parents (user_id, first_name, last_name, relation, phone, email)
                    SELECT id, first_name, last_name, ?, COALESCE(phone, ''), email FROM users WHERE id = ? RETURNING id""",
                    normalizeRelation(req.relation()), userId);
        }
        if (db.exists("SELECT 1 FROM student_parents WHERE student_id = ? AND parent_id = ?", studentId, parentId)) {
            throw ApiException.conflict("This child is already linked to your account.");
        }
        db.exec("INSERT INTO student_parents (student_id, parent_id, is_primary_contact) VALUES (?, ?, FALSE)", studentId, parentId);
        return ApiResponse.ok("Child linked to your account.", Map.of("studentId", studentId));
    }

    private String normalizeRelation(String relation) {
        if (relation == null) return "GUARDIAN";
        String r = relation.toUpperCase();
        if (!List.of("FATHER", "MOTHER", "GUARDIAN").contains(r)) throw ApiException.badRequest("Relation must be FATHER, MOTHER or GUARDIAN.");
        return r;
    }
}
