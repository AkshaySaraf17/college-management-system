package com.cms.backend.report;

import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.util.*;

@RestController
@RequestMapping("/api/reports")
@PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','ACCOUNTANT')")
public class ReportsController {

    private final Db db;

    public ReportsController(Db db) {
        this.db = db;
    }

    @GetMapping("/overview")
    public ApiResponse<Map<String, Object>> overview() {
        return ApiResponse.ok(db.one("""
                SELECT (SELECT count(*) FROM students WHERE status = 'ACTIVE') AS active_students,
                       (SELECT count(*) FROM faculties WHERE status IN ('ACTIVE','ON_LEAVE')) AS faculty,
                       (SELECT count(*) FROM departments) AS departments,
                       (SELECT count(*) FROM courses) AS courses,
                       (SELECT count(*) FROM admission_applications WHERE status NOT IN ('ENROLLED','REJECTED','WITHDRAWN')) AS open_admissions,
                       (SELECT COALESCE(sum(paid_amount), 0) FROM fee_invoices) AS fees_collected,
                       (SELECT COALESCE(sum(total_amount - discount - paid_amount), 0) FROM fee_invoices WHERE status IN ('PENDING','PARTIAL')) AS fees_outstanding,
                       (SELECT round(100.0 * count(*) FILTER (WHERE status IN ('PRESENT','LATE')) / NULLIF(count(*) FILTER (WHERE status <> 'EXCUSED'), 0), 1)
                          FROM attendance_records) AS average_attendance,
                       (SELECT count(*) FROM book_issues WHERE returned_on IS NULL) AS books_on_loan,
                       (SELECT count(*) FROM hostel_allocations WHERE status = 'ACTIVE') AS hostel_residents,
                       (SELECT count(*) FROM transport_allocations WHERE status = 'ACTIVE') AS transport_riders,
                       (SELECT count(DISTINCT student_id) FROM placement_applications WHERE status = 'SELECTED') AS students_placed""", "No data"));
    }

    @GetMapping("/enrollment")
    public ApiResponse<List<Map<String, Object>>> enrollment() {
        return ApiResponse.ok(db.list("""
                SELECT c.name AS course_name, c.total_seats, count(s.id) FILTER (WHERE s.status = 'ACTIVE') AS students
                FROM courses c LEFT JOIN students s ON s.course_id = c.id GROUP BY c.id, c.name, c.total_seats ORDER BY c.name"""));
    }

    @GetMapping("/admissions-funnel")
    public ApiResponse<List<Map<String, Object>>> funnel() {
        return ApiResponse.ok(db.list("SELECT status, count(*) AS count FROM admission_applications GROUP BY status ORDER BY count DESC"));
    }

    @GetMapping("/attendance")
    public ApiResponse<List<Map<String, Object>>> attendance() {
        return ApiResponse.ok(db.list("""
                SELECT b.name AS batch_name, c.code AS course_code,
                       round(100.0 * count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) / NULLIF(count(*) FILTER (WHERE r.status <> 'EXCUSED'), 0), 1) AS percentage
                FROM batches b JOIN courses c ON c.id = b.course_id
                LEFT JOIN attendance_sessions a ON a.batch_id = b.id LEFT JOIN attendance_records r ON r.session_id = a.id
                GROUP BY b.id, b.name, c.code ORDER BY c.code, b.name"""));
    }

    @GetMapping("/fees")
    public ApiResponse<List<Map<String, Object>>> fees() {
        return ApiResponse.ok(db.list("""
                SELECT to_char(date_trunc('month', paid_at), 'YYYY-MM') AS month, sum(amount) AS collected, count(*) AS payments
                FROM fee_payments WHERE paid_at >= date_trunc('month', now()) - interval '5 months' GROUP BY 1 ORDER BY 1"""));
    }

    @GetMapping("/results")
    public ApiResponse<List<Map<String, Object>>> results() {
        return ApiResponse.ok(db.list("""
                SELECT e.id AS exam_id, e.name AS exam_name, b.name AS batch_name, count(r.id) AS entries,
                       round(100.0 * count(*) FILTER (WHERE r.result_status = 'PASS') / NULLIF(count(r.id), 0), 1) AS pass_percentage
                FROM exams e JOIN batches b ON b.id = e.batch_id JOIN exam_schedules x ON x.exam_id = e.id JOIN results r ON r.schedule_id = x.id
                WHERE e.status = 'RESULTS_PUBLISHED' GROUP BY e.id, e.name, b.name ORDER BY e.start_date DESC LIMIT 10"""));
    }

    @GetMapping("/export/{dataset}")
    public ResponseEntity<byte[]> export(@PathVariable String dataset) {
        List<Map<String, Object>> rows = switch (dataset) {
            case "students" -> db.list("""
                    SELECT s.roll_number, u.first_name || ' ' || u.last_name AS name, u.email, c.name AS course, b.name AS batch, s.status, s.admitted_on
                    FROM students s JOIN users u ON u.id = s.user_id JOIN courses c ON c.id = s.course_id JOIN batches b ON b.id = s.batch_id ORDER BY s.roll_number""");
            case "fees" -> db.list("""
                    SELECT i.invoice_number, s.roll_number, u.first_name || ' ' || u.last_name AS student, i.title, i.total_amount, i.discount, i.paid_amount,
                           (i.total_amount - i.discount - i.paid_amount) AS balance, i.due_date, i.status
                    FROM fee_invoices i JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id ORDER BY i.created_at DESC""");
            case "attendance" -> db.list("""
                    SELECT s.roll_number, u.first_name || ' ' || u.last_name AS student, count(*) FILTER (WHERE r.status <> 'EXCUSED') AS classes,
                           count(*) FILTER (WHERE r.status IN ('PRESENT','LATE')) AS attended
                    FROM students s JOIN users u ON u.id = s.user_id LEFT JOIN attendance_records r ON r.student_id = s.id
                    GROUP BY s.id, s.roll_number, u.first_name, u.last_name ORDER BY s.roll_number""");
            case "results" -> db.list("""
                    SELECT s.roll_number, u.first_name || ' ' || u.last_name AS student, e.name AS exam, sub.name AS subject, r.marks_obtained, x.max_marks, r.grade, r.result_status
                    FROM results r JOIN students s ON s.id = r.student_id JOIN users u ON u.id = s.user_id JOIN exam_schedules x ON x.id = r.schedule_id
                    JOIN exams e ON e.id = x.exam_id JOIN subjects sub ON sub.id = x.subject_id WHERE e.status = 'RESULTS_PUBLISHED' ORDER BY e.name, s.roll_number""");
            default -> throw ApiException.notFound("Unknown dataset. Use students, fees, attendance or results.");
        };
        StringBuilder csv = new StringBuilder();
        if (!rows.isEmpty()) {
            List<String> headers = new ArrayList<>(rows.get(0).keySet());
            csv.append(String.join(",", headers)).append("\r\n");
            for (Map<String, Object> row : rows) {
                List<String> cells = new ArrayList<>();
                for (String h : headers) cells.add(csvCell(row.get(h)));
                csv.append(String.join(",", cells)).append("\r\n");
            }
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(dataset + ".csv").build().toString())
                .contentType(MediaType.parseMediaType("text/csv"))
                .body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    /** Quotes the value and neutralises spreadsheet formula injection (cells beginning with = + - @). */
    private static String csvCell(Object value) {
        if (value == null) return "";
        String s = value.toString();
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0 && !s.matches("-?\\d+(\\.\\d+)?")) s = "'" + s;
        return "\"" + s.replace("\"", "\"\"") + "\"";
    }
}
