package com.cms.backend.hostel;

import com.cms.backend.common.*;
import com.cms.backend.notification.NotificationService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/hostel")
public class HostelController {

    private static final String WARDENS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOSTEL_WARDEN')";

    private final Db db;
    private final AccessService access;
    private final Lookups lookups;
    private final NotificationService notifications;

    public HostelController(Db db, AccessService access, Lookups lookups, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.lookups = lookups;
        this.notifications = notifications;
    }

    public record HostelRequest(@NotBlank String name, @NotBlank String hostelType) {}
    public record RoomRequest(@NotNull Long hostelId, @NotBlank String roomNumber, @NotNull @Min(1) Integer capacity, @DecimalMin("0") BigDecimal feePerTerm) {}
    public record AllocateRequest(@NotBlank String student, @NotNull Long roomId, LocalDate fromDate) {}
    public record ComplaintRequest(@NotBlank String subject, String description) {}
    public record ComplaintUpdate(@NotBlank String status, String resolution) {}

    @GetMapping("/hostels")
    @PreAuthorize(WARDENS)
    public ApiResponse<List<Map<String, Object>>> hostels() {
        return ApiResponse.ok(db.list("""
                SELECT h.id, h.name, h.hostel_type,
                       (SELECT count(*) FROM hostel_rooms r WHERE r.hostel_id = h.id) AS rooms,
                       (SELECT COALESCE(sum(r.capacity), 0) FROM hostel_rooms r WHERE r.hostel_id = h.id) AS capacity,
                       (SELECT count(*) FROM hostel_allocations a JOIN hostel_rooms r ON r.id = a.room_id WHERE r.hostel_id = h.id AND a.status = 'ACTIVE') AS occupied
                FROM hostels h ORDER BY h.name"""));
    }

    @PostMapping("/hostels")
    @PreAuthorize(WARDENS)
    public ApiResponse<Map<String, Object>> addHostel(@Valid @RequestBody HostelRequest r) {
        if (!List.of("BOYS", "GIRLS").contains(r.hostelType())) throw ApiException.badRequest("Hostel type must be BOYS or GIRLS.");
        Long id = db.scalar(Long.class, "INSERT INTO hostels (name, hostel_type, warden_id) VALUES (?, ?, ?) RETURNING id",
                r.name(), r.hostelType(), access.hasAnyRole("HOSTEL_WARDEN") ? access.userId() : null);
        return ApiResponse.ok("Hostel added.", Map.of("id", id));
    }

    @DeleteMapping("/hostels/{id}")
    @PreAuthorize(WARDENS)
    public ApiResponse<Void> deleteHostel(@PathVariable long id) {
        if (db.exists("SELECT 1 FROM hostel_allocations a JOIN hostel_rooms r ON r.id = a.room_id WHERE r.hostel_id = ? AND a.status = 'ACTIVE'", id)) {
            throw ApiException.conflict("Students are still allocated in this hostel.");
        }
        if (db.exec("DELETE FROM hostels WHERE id = ?", id) == 0) throw ApiException.notFound("Hostel not found.");
        return ApiResponse.message("Hostel removed.");
    }

    @GetMapping("/rooms")
    @PreAuthorize(WARDENS)
    public ApiResponse<List<Map<String, Object>>> rooms(@RequestParam(required = false) Long hostelId, @RequestParam(defaultValue = "false") boolean availableOnly) {
        String base = """
                SELECT * FROM (
                  SELECT r.id, r.hostel_id, h.name AS hostel_name, h.hostel_type, r.room_number, r.capacity, r.fee_per_term,
                         (SELECT count(*) FROM hostel_allocations a WHERE a.room_id = r.id AND a.status = 'ACTIVE') AS occupied
                  FROM hostel_rooms r JOIN hostels h ON h.id = r.hostel_id) t WHERE TRUE""";
        StringBuilder sql = new StringBuilder(base);
        List<Object> args = new ArrayList<>();
        if (hostelId != null) {
            sql.append(" AND hostel_id = ?");
            args.add(hostelId);
        }
        if (availableOnly) sql.append(" AND occupied < capacity");
        sql.append(" ORDER BY hostel_name, room_number");
        return ApiResponse.ok(db.list(sql.toString(), args.toArray()));
    }

    @PostMapping("/rooms")
    @PreAuthorize(WARDENS)
    public ApiResponse<Map<String, Object>> addRoom(@Valid @RequestBody RoomRequest r) {
        Long id = db.scalar(Long.class, "INSERT INTO hostel_rooms (hostel_id, room_number, capacity, fee_per_term) VALUES (?, ?, ?, ?) RETURNING id",
                r.hostelId(), r.roomNumber(), r.capacity(), r.feePerTerm() == null ? BigDecimal.ZERO : r.feePerTerm());
        return ApiResponse.ok("Room added.", Map.of("id", id));
    }

    @DeleteMapping("/rooms/{id}")
    @PreAuthorize(WARDENS)
    public ApiResponse<Void> deleteRoom(@PathVariable long id) {
        if (db.exists("SELECT 1 FROM hostel_allocations WHERE room_id = ? AND status = 'ACTIVE'", id)) throw ApiException.conflict("Students are still allocated in this room.");
        if (db.exec("DELETE FROM hostel_rooms WHERE id = ?", id) == 0) throw ApiException.notFound("Room not found.");
        return ApiResponse.message("Room removed.");
    }

    @PostMapping("/allocations")
    @PreAuthorize(WARDENS)
    @Transactional
    public ApiResponse<Map<String, Object>> allocate(@Valid @RequestBody AllocateRequest r) {
        UUID studentId = lookups.studentId(r.student());
        Map<String, Object> room = db.one("""
                SELECT r.id, r.capacity, r.room_number, h.hostel_type FROM hostel_rooms r JOIN hostels h ON h.id = r.hostel_id WHERE r.id = ? FOR UPDATE""",
                "Room not found.", r.roomId());
        Long occupied = db.scalar(Long.class, "SELECT count(*) FROM hostel_allocations WHERE room_id = ? AND status = 'ACTIVE'", r.roomId());
        if (occupied != null && occupied >= ((Number) room.get("capacity")).longValue()) throw ApiException.conflict("Room " + room.get("roomNumber") + " is full.");
        if (db.exists("SELECT 1 FROM hostel_allocations WHERE student_id = ? AND status = 'ACTIVE'", studentId)) throw ApiException.conflict("The student already has a hostel room.");
        String gender = db.scalar(String.class, "SELECT gender FROM students WHERE id = ?", studentId);
        if (gender != null) {
            boolean boys = "BOYS".equals(room.get("hostelType"));
            if (boys && gender.equalsIgnoreCase("FEMALE") || !boys && gender.equalsIgnoreCase("MALE")) {
                throw ApiException.badRequest("This is a " + room.get("hostelType").toString().toLowerCase() + " hostel; it does not match the student's gender.");
            }
        }
        Long id = db.scalar(Long.class, "INSERT INTO hostel_allocations (room_id, student_id, from_date) VALUES (?, ?, ?) RETURNING id",
                r.roomId(), studentId, r.fromDate() == null ? LocalDate.now() : r.fromDate());
        notifications.notifyStudent(studentId, "Hostel room allocated", "You have been allotted room " + room.get("roomNumber") + ".", "HOSTEL", "/my/campus");
        return ApiResponse.ok("Room allocated.", Map.of("id", id));
    }

    @PostMapping("/allocations/{id}/vacate")
    @PreAuthorize(WARDENS)
    public ApiResponse<Void> vacate(@PathVariable long id) {
        if (db.exec("UPDATE hostel_allocations SET status = 'VACATED', to_date = CURRENT_DATE WHERE id = ? AND status = 'ACTIVE'", id) == 0) {
            throw ApiException.conflict("Allocation not found or already vacated.");
        }
        return ApiResponse.message("Room vacated.");
    }

    @GetMapping("/allocations")
    @PreAuthorize(WARDENS)
    public ApiResponse<List<Map<String, Object>>> allocations(@RequestParam(required = false) Long hostelId, @RequestParam(defaultValue = "ACTIVE") String status) {
        String base = allocationSelect() + " WHERE a.status = ?";
        return ApiResponse.ok(hostelId == null ? db.list(base + " ORDER BY h.name, r.room_number", status)
                : db.list(base + " AND h.id = ? ORDER BY r.room_number", status, hostelId));
    }

    @GetMapping("/my")
    public ApiResponse<Map<String, Object>> mine(@RequestParam(required = false) UUID studentId) {
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("Choose a student.");
        access.requireStudentAccess(sid);
        Optional<Map<String, Object>> allocation = db.find(allocationSelect() + " WHERE a.student_id = ? AND a.status = 'ACTIVE'", sid);
        return ApiResponse.ok(allocation.isPresent()
                ? Map.of("allocated", true, "allocation", allocation.get())
                : Map.of("allocated", false));
    }

    @PostMapping("/complaints")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<Map<String, Object>> complain(@Valid @RequestBody ComplaintRequest r) {
        UUID sid = access.currentStudentId();
        if (!db.exists("SELECT 1 FROM hostel_allocations WHERE student_id = ? AND status = 'ACTIVE'", sid)) {
            throw ApiException.badRequest("Only students with an allocated hostel room can raise hostel complaints.");
        }
        Long id = db.scalar(Long.class, "INSERT INTO hostel_complaints (student_id, subject, description) VALUES (?, ?, ?) RETURNING id", sid, r.subject(), r.description());
        notifications.notifyRole("HOSTEL_WARDEN", "New hostel complaint", r.subject(), "HOSTEL", "/hostel");
        return ApiResponse.ok("Complaint submitted.", Map.of("id", id));
    }

    @GetMapping("/complaints")
    public ApiResponse<List<Map<String, Object>>> complaints(@RequestParam(required = false) UUID studentId) {
        String base = """
                SELECT c.id, c.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name, c.subject, c.description, c.status, c.resolution, c.created_at
                FROM hostel_complaints c JOIN students s ON s.id = c.student_id JOIN users u ON u.id = s.user_id""";
        if (access.hasAnyRole("SUPER_ADMIN", "COLLEGE_ADMIN", "HOSTEL_WARDEN")) {
            return ApiResponse.ok(db.list(base + " ORDER BY (c.status = 'RESOLVED'), c.created_at DESC"));
        }
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("Choose a student.");
        access.requireStudentAccess(sid);
        return ApiResponse.ok(db.list(base + " WHERE c.student_id = ? ORDER BY c.created_at DESC", sid));
    }

    @PatchMapping("/complaints/{id}")
    @PreAuthorize(WARDENS)
    public ApiResponse<Void> updateComplaint(@PathVariable long id, @Valid @RequestBody ComplaintUpdate r) {
        if (!List.of("OPEN", "IN_PROGRESS", "RESOLVED").contains(r.status())) throw ApiException.badRequest("Invalid status.");
        UUID studentId = db.scalar(UUID.class, "SELECT student_id FROM hostel_complaints WHERE id = ?", id);
        if (studentId == null) throw ApiException.notFound("Complaint not found.");
        db.exec("UPDATE hostel_complaints SET status = ?, resolution = ? WHERE id = ?", r.status(), r.resolution(), id);
        notifications.notifyStudent(studentId, "Hostel complaint update", "Your complaint is now " + r.status().replace('_', ' ').toLowerCase() + ".", "HOSTEL", "/my/campus");
        return ApiResponse.message("Complaint updated.");
    }

    private String allocationSelect() {
        return """
                SELECT a.id, a.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name, r.id AS room_id, r.room_number,
                       h.id AS hostel_id, h.name AS hostel_name, r.fee_per_term, a.from_date, a.to_date, a.status
                FROM hostel_allocations a JOIN hostel_rooms r ON r.id = a.room_id JOIN hostels h ON h.id = r.hostel_id
                JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id""";
    }
}
