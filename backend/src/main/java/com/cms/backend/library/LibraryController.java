package com.cms.backend.library;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.*;

@RestController
@RequestMapping("/api/library")
public class LibraryController {

    private static final String LIBRARIANS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','LIBRARIAN')";
    private static final int MAX_RENEWALS = 2;

    private final Db db;
    private final AccessService access;
    private final NotificationService notifications;
    private final BigDecimal finePerDay;

    public LibraryController(Db db, AccessService access, NotificationService notifications,
                             @Value("${app.library.fine-per-day:2.00}") BigDecimal finePerDay) {
        this.db = db;
        this.access = access;
        this.notifications = notifications;
        this.finePerDay = finePerDay;
    }

    public record BookRequest(String isbn, @NotBlank String title, @NotBlank String author, String publisher, String category,
                              @NotNull @Min(0) Integer totalCopies, String shelfLocation) {}
    public record IssueRequest(@NotNull Long bookId, @NotBlank String member, Integer days) {}

    @GetMapping("/books")
    public ApiResponse<List<Map<String, Object>>> books(@RequestParam(required = false) String q, @RequestParam(required = false) String category) {
        StringBuilder sql = new StringBuilder("SELECT id, isbn, title, author, publisher, category, total_copies, available_copies, shelf_location FROM books WHERE TRUE");
        List<Object> args = new ArrayList<>();
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(title) LIKE ? OR lower(author) LIKE ? OR lower(COALESCE(isbn, '')) LIKE ?)");
            String like = "%" + q.toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        if (category != null && !category.isBlank()) {
            sql.append(" AND category = ?");
            args.add(category);
        }
        sql.append(" ORDER BY title LIMIT 200");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @PostMapping("/books")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Map<String, Object>> addBook(@Valid @RequestBody BookRequest r) {
        Long id = db.scalar(Long.class, """
                INSERT INTO books (isbn, title, author, publisher, category, total_copies, available_copies, shelf_location)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING id""",
                r.isbn(), r.title(), r.author(), r.publisher(), r.category(), r.totalCopies(), r.totalCopies(), r.shelfLocation());
        return ApiResponse.ok("Book added.", Map.of("id", id));
    }

    @PutMapping("/books/{id}")
    @PreAuthorize(LIBRARIANS)
    @Transactional
    public ApiResponse<Void> updateBook(@PathVariable long id, @Valid @RequestBody BookRequest r) {
        Long out = db.scalar(Long.class, "SELECT count(*) FROM book_issues WHERE book_id = ? AND returned_on IS NULL", id);
        long onLoan = out == null ? 0 : out;
        if (r.totalCopies() < onLoan) throw ApiException.badRequest(onLoan + " copies are currently on loan; total copies cannot be lower.");
        int n = db.exec("""
                UPDATE books SET isbn = ?, title = ?, author = ?, publisher = ?, category = ?, total_copies = ?, available_copies = ?, shelf_location = ? WHERE id = ?""",
                r.isbn(), r.title(), r.author(), r.publisher(), r.category(), r.totalCopies(), r.totalCopies() - onLoan, r.shelfLocation(), id);
        if (n == 0) throw ApiException.notFound("Book not found.");
        return ApiResponse.message("Book updated.");
    }

    @DeleteMapping("/books/{id}")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Void> deleteBook(@PathVariable long id) {
        if (db.exists("SELECT 1 FROM book_issues WHERE book_id = ? AND returned_on IS NULL", id)) throw ApiException.conflict("This book has copies on loan.");
        if (db.exec("DELETE FROM books WHERE id = ?", id) == 0) throw ApiException.notFound("Book not found.");
        return ApiResponse.message("Book removed.");
    }

    @GetMapping("/members/lookup")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Map<String, Object>> lookup(@RequestParam String q) {
        Map<String, Object> m = resolveMember(q);
        Map<String, Object> out = new LinkedHashMap<>(m);
        out.put("activeLoans", db.scalar(Long.class, "SELECT count(*) FROM book_issues WHERE member_id = ? AND returned_on IS NULL", m.get("id")));
        out.put("unpaidFines", db.scalar(BigDecimal.class, "SELECT COALESCE(sum(fine_amount), 0) FROM book_issues WHERE member_id = ? AND fine_amount > 0 AND fine_paid = FALSE", m.get("id")));
        out.put("loanLimit", loanLimit((String) m.get("roles")));
        return ApiResponse.ok(out);
    }

    @PostMapping("/issues")
    @PreAuthorize(LIBRARIANS)
    @Transactional
    public ApiResponse<Map<String, Object>> issue(@Valid @RequestBody IssueRequest r) {
        Map<String, Object> member = resolveMember(r.member());
        UUID memberId = (UUID) member.get("id");
        Map<String, Object> book = db.one("SELECT id, title, available_copies FROM books WHERE id = ? FOR UPDATE", "Book not found.", r.bookId());
        if (((Number) book.get("availableCopies")).intValue() <= 0) throw ApiException.conflict("No copies of \"" + book.get("title") + "\" are available.");

        long active = db.scalar(Long.class, "SELECT count(*) FROM book_issues WHERE member_id = ? AND returned_on IS NULL", memberId);
        int limit = loanLimit((String) member.get("roles"));
        if (active >= limit) throw ApiException.conflict(member.get("name") + " already has " + active + " books out (limit " + limit + ").");
        if (db.exists("SELECT 1 FROM book_issues WHERE member_id = ? AND returned_on IS NULL AND due_on < CURRENT_DATE", memberId)) {
            throw ApiException.conflict("The member has overdue books; return them before borrowing more.");
        }
        BigDecimal unpaid = db.scalar(BigDecimal.class, "SELECT COALESCE(sum(fine_amount), 0) FROM book_issues WHERE member_id = ? AND fine_amount > 0 AND fine_paid = FALSE", memberId);
        if (unpaid != null && unpaid.signum() > 0) throw ApiException.conflict("The member has unpaid library fines of " + unpaid + ".");
        if (db.exists("SELECT 1 FROM book_issues WHERE member_id = ? AND book_id = ? AND returned_on IS NULL", memberId, r.bookId())) {
            throw ApiException.conflict("The member already has a copy of this book.");
        }

        int days = r.days() == null ? 14 : Math.max(1, Math.min(r.days(), 60));
        Long id = db.scalar(Long.class, "INSERT INTO book_issues (book_id, member_id, due_on) VALUES (?, ?, CURRENT_DATE + ?::int) RETURNING id", r.bookId(), memberId, days);
        db.exec("UPDATE books SET available_copies = available_copies - 1 WHERE id = ?", r.bookId());
        notifications.notifyUser(memberId, "Book issued", "\"" + book.get("title") + "\" is due in " + days + " days.", "LIBRARY", "/my/library");
        return ApiResponse.ok("Book issued.", Map.of("id", id, "dueOn", LocalDate.now().plusDays(days)));
    }

    @PostMapping("/issues/{id}/return")
    @PreAuthorize(LIBRARIANS)
    @Transactional
    public ApiResponse<Map<String, Object>> returnBook(@PathVariable long id) {
        Map<String, Object> issue = db.one("SELECT id, book_id, member_id, due_on, returned_on FROM book_issues WHERE id = ? FOR UPDATE", "Issue record not found.", id);
        if (issue.get("returnedOn") != null) throw ApiException.conflict("This book was already returned.");
        LocalDate due = ((java.sql.Date) issue.get("dueOn")).toLocalDate();
        long late = Math.max(0, ChronoUnit.DAYS.between(due, LocalDate.now()));
        BigDecimal fine = finePerDay.multiply(BigDecimal.valueOf(late));
        db.exec("UPDATE book_issues SET returned_on = CURRENT_DATE, fine_amount = ?, fine_paid = ? WHERE id = ?", fine, fine.signum() == 0, id);
        db.exec("UPDATE books SET available_copies = available_copies + 1 WHERE id = ?", issue.get("bookId"));
        if (fine.signum() > 0) {
            notifications.notifyUser((UUID) issue.get("memberId"), "Library fine", "A fine of " + fine + " applies for returning a book " + late + " day(s) late.", "LIBRARY", "/my/library");
        }
        return ApiResponse.ok("Book returned.", Map.of("daysLate", late, "fine", fine));
    }

    @PostMapping("/issues/{id}/renew")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Map<String, Object>> renew(@PathVariable long id) {
        Map<String, Object> issue = db.one("SELECT due_on, returned_on, renewals FROM book_issues WHERE id = ?", "Issue record not found.", id);
        if (issue.get("returnedOn") != null) throw ApiException.conflict("This book was already returned.");
        if (((java.sql.Date) issue.get("dueOn")).toLocalDate().isBefore(LocalDate.now())) throw ApiException.conflict("Overdue books cannot be renewed.");
        if (((Number) issue.get("renewals")).intValue() >= MAX_RENEWALS) throw ApiException.conflict("Maximum renewals (" + MAX_RENEWALS + ") reached.");
        db.exec("UPDATE book_issues SET due_on = due_on + 7, renewals = renewals + 1 WHERE id = ?", id);
        return ApiResponse.ok("Renewed for 7 more days.", Map.of("renewals", ((Number) issue.get("renewals")).intValue() + 1));
    }

    @PostMapping("/issues/{id}/pay-fine")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Void> payFine(@PathVariable long id) {
        if (db.exec("UPDATE book_issues SET fine_paid = TRUE WHERE id = ? AND fine_amount > 0 AND fine_paid = FALSE", id) == 0) {
            throw ApiException.conflict("There is no unpaid fine on this record.");
        }
        return ApiResponse.message("Fine marked as paid.");
    }

    @GetMapping("/issues")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<List<Map<String, Object>>> issues(@RequestParam(required = false) String status, @RequestParam(required = false) String q) {
        StringBuilder sql = new StringBuilder(issueSelect()).append(" WHERE TRUE");
        List<Object> args = new ArrayList<>();
        if ("ACTIVE".equals(status)) sql.append(" AND i.returned_on IS NULL");
        if ("OVERDUE".equals(status)) sql.append(" AND i.returned_on IS NULL AND i.due_on < CURRENT_DATE");
        if ("RETURNED".equals(status)) sql.append(" AND i.returned_on IS NOT NULL");
        if ("FINES".equals(status)) sql.append(" AND i.fine_amount > 0 AND i.fine_paid = FALSE");
        if (q != null && !q.isBlank()) {
            sql.append(" AND (lower(b.title) LIKE ? OR lower(u.first_name || ' ' || u.last_name) LIKE ? OR lower(u.email) LIKE ?)");
            String like = "%" + q.toLowerCase() + "%";
            args.add(like);
            args.add(like);
            args.add(like);
        }
        sql.append(" ORDER BY i.issued_on DESC, i.id DESC LIMIT 300");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @GetMapping("/issues/my")
    public ApiResponse<List<Map<String, Object>>> myIssues() {
        return ApiResponse.ok(db.list(issueSelect() + " WHERE i.member_id = ? ORDER BY i.issued_on DESC", access.userId()));
    }

    @GetMapping("/stats")
    @PreAuthorize(LIBRARIANS)
    public ApiResponse<Map<String, Object>> stats() {
        return ApiResponse.ok(db.one("""
                SELECT (SELECT count(*) FROM books) AS titles, (SELECT COALESCE(sum(total_copies), 0) FROM books) AS total_copies,
                       (SELECT COALESCE(sum(available_copies), 0) FROM books) AS available_copies,
                       (SELECT count(*) FROM book_issues WHERE returned_on IS NULL) AS on_loan,
                       (SELECT count(*) FROM book_issues WHERE returned_on IS NULL AND due_on < CURRENT_DATE) AS overdue,
                       (SELECT COALESCE(sum(fine_amount), 0) FROM book_issues WHERE fine_amount > 0 AND fine_paid = FALSE) AS unpaid_fines""", "No data"));
    }

    private String issueSelect() {
        return """
                SELECT i.id, i.book_id, b.title, b.author, i.member_id, u.first_name || ' ' || u.last_name AS member_name, u.email AS member_email,
                       i.issued_on, i.due_on, i.returned_on, i.renewals, i.fine_amount, i.fine_paid,
                       (i.returned_on IS NULL AND i.due_on < CURRENT_DATE) AS overdue,
                       CASE WHEN i.returned_on IS NULL AND i.due_on < CURRENT_DATE THEN (CURRENT_DATE - i.due_on) * %s ELSE i.fine_amount END AS current_fine
                FROM book_issues i JOIN books b ON b.id = i.book_id JOIN users u ON u.id = i.member_id""".formatted(finePerDay.toPlainString());
    }

    private Map<String, Object> resolveMember(String query) {
        String q = query.trim();
        return db.find("""
                SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email,
                       (SELECT string_agg(r.name, ',') FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
                FROM users u WHERE u.status = 'ACTIVE' AND (lower(u.email) = lower(?)
                  OR u.id IN (SELECT user_id FROM students WHERE roll_number = ?)
                  OR u.id IN (SELECT user_id FROM faculties WHERE employee_code = ?)) LIMIT 1""", q, q, q)
                .orElseThrow(() -> ApiException.notFound("No active member found for \"" + q + "\" (use email, roll number or employee code)."));
    }

    private int loanLimit(String roles) {
        if (roles != null && roles.contains("FACULTY")) return 5;
        if (roles != null && roles.contains("STUDENT")) return 3;
        return 2;
    }
}
