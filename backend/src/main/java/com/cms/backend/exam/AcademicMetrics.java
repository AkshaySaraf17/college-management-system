package com.cms.backend.exam;

import com.cms.backend.common.Db;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.UUID;

/** Shared academic calculations (CGPA, average marks) reused by scholarships, placement and analytics. */
@Component
public class AcademicMetrics {

    private final Db db;

    public AcademicMetrics(Db db) {
        this.db = db;
    }

    /** Credit-weighted CGPA over the latest published FINAL-exam result for each subject, or null when nothing is published. */
    public BigDecimal cgpa(UUID studentId) {
        return db.scalar(BigDecimal.class, """
                SELECT round(sum(t.grade_points * t.credits) / NULLIF(sum(t.credits), 0), 2) FROM (
                    SELECT DISTINCT ON (x.subject_id) r.grade_points, sub.credits
                    FROM results r JOIN exam_schedules x ON x.id = r.schedule_id JOIN exams e ON e.id = x.exam_id
                    JOIN subjects sub ON sub.id = x.subject_id
                    WHERE r.student_id = ? AND e.status = 'RESULTS_PUBLISHED' AND e.exam_type = 'FINAL' AND r.grade_points IS NOT NULL
                    ORDER BY x.subject_id, x.exam_date DESC
                ) t""", studentId);
    }

    /** Average percentage across all published results, or null when none exist. */
    public BigDecimal averageMarksPercent(UUID studentId) {
        return db.scalar(BigDecimal.class, """
                SELECT round(avg(r.marks_obtained * 100.0 / x.max_marks), 1)
                FROM results r JOIN exam_schedules x ON x.id = r.schedule_id JOIN exams e ON e.id = x.exam_id
                WHERE r.student_id = ? AND e.status = 'RESULTS_PUBLISHED' AND r.absent = FALSE AND r.marks_obtained IS NOT NULL""", studentId);
    }

    public static BigDecimal round2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }
}
