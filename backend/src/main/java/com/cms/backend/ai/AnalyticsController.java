package com.cms.backend.ai;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.exam.AcademicMetrics;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.math.BigDecimal;
import java.util.*;

/** Gathers each student's real records and asks the Python analytics service to score and forecast. */
@RestController
@RequestMapping("/api/analytics")
public class AnalyticsController {

    private final Db db;
    private final AccessService access;
    private final AcademicMetrics metrics;
    private final RestClient ai;

    public AnalyticsController(Db db, AccessService access, AcademicMetrics metrics, @Value("${app.ai.url}") String aiUrl) {
        this.db = db;
        this.access = access;
        this.metrics = metrics;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(2000);
        factory.setReadTimeout(8000);
        this.ai = RestClient.builder().baseUrl(aiUrl).requestFactory(factory).build();
    }

    @GetMapping("/student/{studentId}")
    public ApiResponse<Map<String, Object>> student(@PathVariable UUID studentId) {
        access.requireStudentAccess(studentId);
        Map<String, Object> features = features(studentId);
        Map<String, Object> analysis = call("/analyze/student", features);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("studentId", studentId);
        out.put("features", features);
        out.put("analysis", analysis);
        return ApiResponse.ok(out);
    }

    @GetMapping("/at-risk")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY')")
    @SuppressWarnings("unchecked")
    public ApiResponse<List<Map<String, Object>>> atRisk(@RequestParam long batchId) {
        List<Map<String, Object>> students = db.list("""
                SELECT s.id, s.roll_number, u.first_name || ' ' || u.last_name AS full_name
                FROM students s JOIN users u ON u.id = s.user_id WHERE s.batch_id = ? AND s.status = 'ACTIVE' ORDER BY s.roll_number""", batchId);
        if (students.isEmpty()) return ApiResponse.ok(List.of());

        List<Map<String, Object>> items = new ArrayList<>();
        for (Map<String, Object> s : students) {
            items.add(Map.of("id", s.get("id").toString(), "features", features((UUID) s.get("id"))));
        }
        Map<String, Object> response = call("/analyze/batch", Map.of("students", items));
        Map<String, Map<String, Object>> byId = new HashMap<>();
        for (Map<String, Object> r : (List<Map<String, Object>>) response.get("results")) byId.put((String) r.get("id"), r);

        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> s : students) {
            Map<String, Object> r = byId.get(s.get("id").toString());
            Map<String, Object> row = new LinkedHashMap<>(s);
            row.put("riskScore", r.get("risk_score"));
            row.put("riskLevel", r.get("risk_level"));
            row.put("confidence", r.get("confidence"));
            row.put("predictedNextScore", r.get("predicted_next_score"));
            row.put("topFactors", ((List<Map<String, Object>>) r.get("factors")).stream()
                    .filter(f -> ((Number) f.get("points")).doubleValue() > 0)
                    .sorted((a, b) -> Double.compare(((Number) b.get("points")).doubleValue(), ((Number) a.get("points")).doubleValue()))
                    .limit(2).map(f -> f.get("factor")).toList());
            out.add(row);
        }
        out.sort((a, b) -> Double.compare(((Number) b.get("riskScore")).doubleValue(), ((Number) a.get("riskScore")).doubleValue()));
        return ApiResponse.ok(out);
    }

    Map<String, Object> features(UUID studentId) {
        Map<String, Object> f = new LinkedHashMap<>();
        Map<String, Object> att = db.one("""
                SELECT count(*) FILTER (WHERE r.status <> 'EXCUSED') AS total, count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) AS attended
                FROM attendance_records r WHERE r.student_id = ?""", "No data", studentId);
        long total = ((Number) att.get("total")).longValue();
        f.put("attendance_pct", total == 0 ? null : round1(((Number) att.get("attended")).doubleValue() * 100 / total));

        BigDecimal avg = metrics.averageMarksPercent(studentId);
        f.put("avg_marks_pct", avg);

        List<Double> history = new ArrayList<>();
        for (Map<String, Object> r : db.list("""
                SELECT r.marks_obtained * 100.0 / x.max_marks AS pct
                FROM results r JOIN exam_schedules x ON x.id = r.schedule_id JOIN exams e ON e.id = x.exam_id
                WHERE r.student_id = ? AND e.status = 'RESULTS_PUBLISHED' AND r.absent = FALSE AND r.marks_obtained IS NOT NULL
                ORDER BY x.exam_date, x.id""", studentId)) {
            history.add(round1(((Number) r.get("pct")).doubleValue()));
        }
        f.put("score_history", history);

        Map<String, Object> asg = db.one("""
                SELECT count(*) AS due, count(s.id) AS submitted
                FROM students st JOIN assignments a ON a.batch_id = st.batch_id AND a.due_date <= CURRENT_DATE
                LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.student_id = st.id WHERE st.id = ?""", "No data", studentId);
        long due = ((Number) asg.get("due")).longValue();
        f.put("assignment_rate", due == 0 ? null : round1(((Number) asg.get("submitted")).doubleValue() * 100 / due));

        BigDecimal overdue = db.scalar(BigDecimal.class, """
                SELECT COALESCE(sum(total_amount - discount - paid_amount), 0) FROM fee_invoices
                WHERE student_id = ? AND status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE""", studentId);
        f.put("overdue_fee_amount", overdue == null ? 0 : overdue);

        Long backlogs = db.scalar(Long.class, """
                SELECT count(*) FROM results r JOIN exam_schedules x ON x.id = r.schedule_id JOIN exams e ON e.id = x.exam_id
                WHERE r.student_id = ? AND e.status = 'RESULTS_PUBLISHED' AND r.result_status IN ('FAIL','ABSENT')""", studentId);
        f.put("backlogs", backlogs == null ? 0 : backlogs);
        f.put("cgpa", metrics.cgpa(studentId));
        return f;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> call(String path, Object body) {
        try {
            Map<String, Object> result = ai.post().uri(path).body(body).retrieve().body(Map.class);
            if (result == null) throw ApiException.badRequest("Analytics service returned no data.");
            return result;
        } catch (RestClientException e) {
            throw new ApiException(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "The analytics service is not reachable right now. Start it with ./scripts/dev.sh start and try again.");
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
