package com.cms.backend.fee;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.Year;
import java.util.*;

@RestController
@RequestMapping("/api/fees")
public class FeeController {

    private static final String FEE_STAFF = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','ACCOUNTANT')";
    private static final Set<String> METHODS = Set.of("CASH", "CARD", "UPI", "ONLINE", "BANK");

    private static final String INVOICE_SELECT = """
            SELECT i.id, i.invoice_number, i.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name,
                   i.title, i.total_amount, i.discount, i.paid_amount, (i.total_amount - i.discount - i.paid_amount) AS balance,
                   i.due_date, i.status, (i.status IN ('PENDING','PARTIAL') AND i.due_date < CURRENT_DATE) AS overdue, i.created_at
            FROM fee_invoices i JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id""";

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;
    private final SecureRandom random = new SecureRandom();

    public FeeController(Db db, AccessService access, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
    }

    public record StructureRequest(@NotNull Long courseId, Long semesterId, @NotBlank String name, @NotNull @DecimalMin("0") BigDecimal amount) {}
    public record GenerateRequest(@NotNull Long batchId, Long semesterId, @NotBlank String title, @NotNull LocalDate dueDate) {}
    public record InvoiceRequest(@NotNull UUID studentId, @NotBlank String title, @NotNull @DecimalMin("0.01") BigDecimal amount, @NotNull LocalDate dueDate) {}
    public record PayRequest(@NotNull @DecimalMin("0.01") BigDecimal amount, String method, String reference) {}
    public record OnlinePayRequest(@NotNull @DecimalMin("0.01") BigDecimal amount) {}

    @GetMapping("/structures")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<List<Map<String, Object>>> structures(@RequestParam(required = false) Long courseId) {
        String base = """
                SELECT f.id, f.course_id, c.name AS course_name, f.semester_id, sem.name AS semester_name, f.name, f.amount
                FROM fee_structures f JOIN courses c ON c.id = f.course_id LEFT JOIN semesters sem ON sem.id = f.semester_id""";
        return ApiResponse.ok(courseId == null ? db.list(base + " ORDER BY c.name, sem.number NULLS FIRST, f.name")
                : db.list(base + " WHERE f.course_id = ? ORDER BY sem.number NULLS FIRST, f.name", courseId));
    }

    @PostMapping("/structures")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<Map<String, Object>> addStructure(@Valid @RequestBody StructureRequest r) {
        if (r.semesterId() != null && !db.exists("SELECT 1 FROM semesters WHERE id = ? AND course_id = ?", r.semesterId(), r.courseId())) {
            throw ApiException.badRequest("That semester does not belong to the course.");
        }
        Long id = db.scalar(Long.class, "INSERT INTO fee_structures (course_id, semester_id, name, amount) VALUES (?, ?, ?, ?) RETURNING id",
                r.courseId(), r.semesterId(), r.name(), r.amount());
        return ApiResponse.ok("Fee head added.", Map.of("id", id));
    }

    @DeleteMapping("/structures/{id}")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<Void> deleteStructure(@PathVariable long id) {
        if (db.exec("DELETE FROM fee_structures WHERE id = ?", id) == 0) throw ApiException.notFound("Fee head not found.");
        return ApiResponse.message("Fee head removed.");
    }

    /** Creates one invoice per active student in the batch, totalling the applicable fee heads. */
    @PostMapping("/invoices/generate")
    @PreAuthorize(FEE_STAFF)
    @Transactional
    public ApiResponse<Map<String, Object>> generate(@Valid @RequestBody GenerateRequest r) {
        Long courseId = db.scalar(Long.class, "SELECT course_id FROM batches WHERE id = ?", r.batchId());
        if (courseId == null) throw ApiException.badRequest("Batch not found.");
        BigDecimal total = r.semesterId() == null
                ? db.scalar(BigDecimal.class, "SELECT COALESCE(sum(amount), 0) FROM fee_structures WHERE course_id = ? AND semester_id IS NULL", courseId)
                : db.scalar(BigDecimal.class, "SELECT COALESCE(sum(amount), 0) FROM fee_structures WHERE course_id = ? AND (semester_id IS NULL OR semester_id = ?)", courseId, r.semesterId());
        if (total == null || total.signum() == 0) throw ApiException.badRequest("No fee heads are defined for this course/semester yet.");

        int created = 0, skipped = 0;
        for (Map<String, Object> st : db.list("SELECT id FROM students WHERE batch_id = ? AND status = 'ACTIVE'", r.batchId())) {
            UUID studentId = (UUID) st.get("id");
            if (db.exists("SELECT 1 FROM fee_invoices WHERE student_id = ? AND title = ?", studentId, r.title())) {
                skipped++;
                continue;
            }
            insertInvoice(studentId, r.title(), total, r.dueDate());
            created++;
        }
        return ApiResponse.ok("Invoices generated.", Map.of("created", created, "skipped", skipped, "amountEach", total));
    }

    @PostMapping("/invoices")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<Map<String, Object>> createInvoice(@Valid @RequestBody InvoiceRequest r) {
        if (!db.exists("SELECT 1 FROM students WHERE id = ?", r.studentId())) throw ApiException.badRequest("Student not found.");
        return ApiResponse.ok("Invoice created.", Map.of("id", insertInvoice(r.studentId(), r.title(), r.amount(), r.dueDate())));
    }

    @GetMapping("/invoices")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<List<Map<String, Object>>> invoices(@RequestParam(required = false) String status,
                                                            @RequestParam(required = false) Long batchId,
                                                            @RequestParam(required = false) String q) {
        StringBuilder sql = new StringBuilder(INVOICE_SELECT).append(" WHERE TRUE");
        List<Object> args = new ArrayList<>();
        if ("OVERDUE".equals(status)) {
            sql.append(" AND i.status IN ('PENDING','PARTIAL') AND i.due_date < CURRENT_DATE");
        } else if (status != null && !status.isBlank()) {
            sql.append(" AND i.status = ?");
            args.add(status);
        }
        if (batchId != null) {
            sql.append(" AND s.batch_id = ?");
            args.add(batchId);
        }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(s.roll_number) LIKE ? OR lower(u.first_name || ' ' || u.last_name) LIKE ? OR lower(i.invoice_number) LIKE ?)");
            String like = "%" + q.toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY i.created_at DESC LIMIT 300");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @GetMapping("/student/{studentId}")
    public ApiResponse<Map<String, Object>> studentFees(@PathVariable UUID studentId) {
        access.requireStudentAccess(studentId);
        List<Map<String, Object>> invoices = db.list(INVOICE_SELECT + " WHERE i.student_id = ? ORDER BY i.due_date DESC", studentId);
        List<Map<String, Object>> out = new ArrayList<>();
        BigDecimal due = BigDecimal.ZERO;
        for (Map<String, Object> inv : invoices) {
            Map<String, Object> m = new LinkedHashMap<>(inv);
            m.put("payments", db.list("SELECT id, amount, method, reference, receipt_number, paid_at FROM fee_payments WHERE invoice_id = ? ORDER BY paid_at", inv.get("id")));
            out.add(m);
            if (!"WAIVED".equals(inv.get("status"))) due = due.add((BigDecimal) inv.get("balance"));
        }
        return ApiResponse.ok(Map.of("invoices", out, "totalDue", due));
    }

    @PostMapping("/invoices/{id}/pay")
    @PreAuthorize(FEE_STAFF)
    @Transactional
    public ApiResponse<Map<String, Object>> pay(@PathVariable long id, @Valid @RequestBody PayRequest r) {
        String method = r.method() == null ? "CASH" : r.method().toUpperCase();
        if (!METHODS.contains(method)) throw ApiException.badRequest("Payment method must be one of " + METHODS);
        return ApiResponse.ok("Payment recorded.", recordPayment(id, r.amount(), method, r.reference(), access.userId()));
    }

    /** Simulated gateway: there is no real payment processor wired up, so this always succeeds. */
    @PostMapping("/invoices/{id}/pay-online")
    @PreAuthorize("hasAnyRole('STUDENT','PARENT')")
    @Transactional
    public ApiResponse<Map<String, Object>> payOnline(@PathVariable long id, @Valid @RequestBody OnlinePayRequest r) {
        UUID studentId = db.scalar(UUID.class, "SELECT student_id FROM fee_invoices WHERE id = ?", id);
        if (studentId == null) throw ApiException.notFound("Invoice not found.");
        access.requireStudentAccess(studentId);
        String reference = "SIM-" + Long.toString(random.nextLong() & Long.MAX_VALUE, 36).toUpperCase();
        return ApiResponse.ok("Payment successful (demo gateway).", recordPayment(id, r.amount(), "ONLINE", reference, access.userId()));
    }

    @PostMapping("/invoices/{id}/waive")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<Void> waive(@PathVariable long id) {
        int n = db.exec("UPDATE fee_invoices SET status = 'WAIVED' WHERE id = ? AND status IN ('PENDING','PARTIAL')", id);
        if (n == 0) throw ApiException.conflict("Only pending or partially paid invoices can be waived.");
        return ApiResponse.message("Invoice waived.");
    }

    @GetMapping("/payments/{id}/receipt")
    public ApiResponse<Map<String, Object>> receipt(@PathVariable long id) {
        Map<String, Object> p = db.one("""
                SELECT p.id, p.amount, p.method, p.reference, p.receipt_number, p.paid_at, i.invoice_number, i.title, i.total_amount, i.discount,
                       i.paid_amount, i.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name, c.name AS course_name,
                       (SELECT ru.first_name || ' ' || ru.last_name FROM users ru WHERE ru.id = p.received_by) AS received_by
                FROM fee_payments p JOIN fee_invoices i ON i.id = p.invoice_id JOIN students s ON s.id = i.student_id
                JOIN users u ON u.id = s.user_id JOIN courses c ON c.id = s.course_id WHERE p.id = ?""", "Receipt not found.", id);
        access.requireStudentAccess((UUID) p.get("studentId"));
        return ApiResponse.ok(p);
    }

    @GetMapping("/summary")
    @PreAuthorize(FEE_STAFF)
    public ApiResponse<Map<String, Object>> summary() {
        Map<String, Object> totals = db.one("""
                SELECT COALESCE(sum(total_amount - discount) FILTER (WHERE status <> 'WAIVED'), 0) AS invoiced,
                       COALESCE(sum(paid_amount), 0) AS collected,
                       COALESCE(sum(total_amount - discount - paid_amount) FILTER (WHERE status IN ('PENDING','PARTIAL')), 0) AS outstanding,
                       COALESCE(sum(total_amount - discount - paid_amount) FILTER (WHERE status IN ('PENDING','PARTIAL') AND due_date < CURRENT_DATE), 0) AS overdue,
                       count(*) FILTER (WHERE status = 'PAID') AS paid_count,
                       count(*) FILTER (WHERE status IN ('PENDING','PARTIAL')) AS open_count
                FROM fee_invoices""", "No data");
        Map<String, Object> out = new LinkedHashMap<>(totals);
        out.put("recentPayments", db.list("""
                SELECT p.id, p.amount, p.method, p.receipt_number, p.paid_at, u.first_name || ' ' || u.last_name AS student_name
                FROM fee_payments p JOIN fee_invoices i ON i.id = p.invoice_id JOIN students s ON s.id = i.student_id JOIN users u ON u.id = s.user_id
                ORDER BY p.paid_at DESC LIMIT 10"""));
        return ApiResponse.ok(out);
    }

    private Map<String, Object> recordPayment(long invoiceId, BigDecimal amount, String method, String reference, UUID receivedBy) {
        Map<String, Object> inv = db.one("SELECT id, student_id, total_amount, discount, paid_amount, status, title FROM fee_invoices WHERE id = ? FOR UPDATE",
                "Invoice not found.", invoiceId);
        String status = (String) inv.get("status");
        if (status.equals("PAID") || status.equals("WAIVED")) throw ApiException.conflict("This invoice is already " + status.toLowerCase() + ".");
        BigDecimal payable = ((BigDecimal) inv.get("totalAmount")).subtract((BigDecimal) inv.get("discount")).subtract((BigDecimal) inv.get("paidAmount"));
        if (amount.compareTo(payable) > 0) throw ApiException.badRequest("Amount exceeds the outstanding balance of " + payable + ".");

        String receipt = "RCT-" + Year.now().getValue() + "-" + String.format("%07d", random.nextInt(10_000_000));
        Long paymentId = db.scalar(Long.class, """
                INSERT INTO fee_payments (invoice_id, amount, method, reference, receipt_number, received_by)
                VALUES (?, ?, ?, ?, ?, ?) RETURNING id""", invoiceId, amount, method, reference, receipt, receivedBy);
        BigDecimal balance = payable.subtract(amount);
        db.exec("UPDATE fee_invoices SET paid_amount = paid_amount + ?, status = ? WHERE id = ?", amount, balance.signum() == 0 ? "PAID" : "PARTIAL", invoiceId);
        notifications.notifyStudent((UUID) inv.get("studentId"), "Payment received",
                "Received " + amount + " towards \"" + inv.get("title") + "\". Receipt " + receipt + ".", "FEE", "/my/fees");
        return Map.of("paymentId", paymentId, "receiptNumber", receipt, "balance", balance);
    }

    private long insertInvoice(UUID studentId, String title, BigDecimal amount, LocalDate dueDate) {
        String number;
        do {
            number = "INV-" + Year.now().getValue() + "-" + String.format("%06d", random.nextInt(1_000_000));
        } while (db.exists("SELECT 1 FROM fee_invoices WHERE invoice_number = ?", number));
        Long id = db.scalar(Long.class, "INSERT INTO fee_invoices (invoice_number, student_id, title, total_amount, due_date) VALUES (?, ?, ?, ?, ?) RETURNING id",
                number, studentId, title, amount, dueDate);
        notifications.notifyStudent(studentId, "New fee invoice", title + ": " + amount + " due on " + dueDate + ".", "FEE", "/my/fees");
        return id;
    }
}
