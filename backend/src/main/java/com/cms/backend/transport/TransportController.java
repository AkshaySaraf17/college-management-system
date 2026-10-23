package com.cms.backend.transport;

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
import java.time.LocalTime;
import java.util.*;

@RestController
@RequestMapping("/api/transport")
public class TransportController {

    private static final String MANAGERS = "hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','TRANSPORT_MANAGER')";

    private final Db db;
    private final AccessService access;
    private final Lookups lookups;
    private final NotificationService notifications;

    public TransportController(Db db, AccessService access, Lookups lookups, NotificationService notifications) {
        this.db = db;
        this.access = access;
        this.lookups = lookups;
        this.notifications = notifications;
    }

    public record RouteRequest(@NotBlank String name, @NotBlank String startPoint, @NotBlank String endPoint, @DecimalMin("0") BigDecimal feePerTerm) {}
    public record StopRequest(@NotNull Long routeId, @NotBlank String name, @NotNull LocalTime pickupTime, Integer seq) {}
    public record VehicleRequest(@NotBlank String registrationNo, @NotNull @Min(1) Integer capacity, String driverName, String driverPhone, Long routeId) {}
    public record AllocateRequest(@NotBlank String student, @NotNull Long routeId, Long stopId) {}

    @GetMapping("/routes")
    public ApiResponse<List<Map<String, Object>>> routes() {
        List<Map<String, Object>> routes = db.list("""
                SELECT r.id, r.name, r.start_point, r.end_point, r.fee_per_term,
                       (SELECT COALESCE(sum(v.capacity), 0) FROM vehicles v WHERE v.route_id = r.id) AS seats,
                       (SELECT count(*) FROM transport_allocations a WHERE a.route_id = r.id AND a.status = 'ACTIVE') AS riders
                FROM transport_routes r ORDER BY r.name""");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : routes) {
            Map<String, Object> m = new LinkedHashMap<>(r);
            m.put("stops", db.list("SELECT id, name, pickup_time, seq FROM transport_stops WHERE route_id = ? ORDER BY seq, pickup_time", r.get("id")));
            m.put("vehicles", db.list("SELECT id, registration_no, capacity, driver_name, driver_phone FROM vehicles WHERE route_id = ? ORDER BY registration_no", r.get("id")));
            out.add(m);
        }
        return ApiResponse.ok(out);
    }

    @PostMapping("/routes")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Map<String, Object>> addRoute(@Valid @RequestBody RouteRequest r) {
        Long id = db.scalar(Long.class, "INSERT INTO transport_routes (name, start_point, end_point, fee_per_term) VALUES (?, ?, ?, ?) RETURNING id",
                r.name(), r.startPoint(), r.endPoint(), r.feePerTerm() == null ? BigDecimal.ZERO : r.feePerTerm());
        return ApiResponse.ok("Route added.", Map.of("id", id));
    }

    @DeleteMapping("/routes/{id}")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Void> deleteRoute(@PathVariable long id) {
        if (db.exists("SELECT 1 FROM transport_allocations WHERE route_id = ? AND status = 'ACTIVE'", id)) throw ApiException.conflict("Students are still using this route.");
        if (db.exec("DELETE FROM transport_routes WHERE id = ?", id) == 0) throw ApiException.notFound("Route not found.");
        return ApiResponse.message("Route removed.");
    }

    @PostMapping("/stops")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Map<String, Object>> addStop(@Valid @RequestBody StopRequest r) {
        Long id = db.scalar(Long.class, "INSERT INTO transport_stops (route_id, name, pickup_time, seq) VALUES (?, ?, ?, ?) RETURNING id",
                r.routeId(), r.name(), r.pickupTime(), r.seq() == null ? 1 : r.seq());
        return ApiResponse.ok("Stop added.", Map.of("id", id));
    }

    @DeleteMapping("/stops/{id}")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Void> deleteStop(@PathVariable long id) {
        if (db.exec("DELETE FROM transport_stops WHERE id = ?", id) == 0) throw ApiException.notFound("Stop not found.");
        return ApiResponse.message("Stop removed.");
    }

    @PostMapping("/vehicles")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Map<String, Object>> addVehicle(@Valid @RequestBody VehicleRequest r) {
        Long id = db.scalar(Long.class, "INSERT INTO vehicles (registration_no, capacity, driver_name, driver_phone, route_id) VALUES (?, ?, ?, ?, ?) RETURNING id",
                r.registrationNo(), r.capacity(), r.driverName(), r.driverPhone(), r.routeId());
        return ApiResponse.ok("Vehicle added.", Map.of("id", id));
    }

    @DeleteMapping("/vehicles/{id}")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Void> deleteVehicle(@PathVariable long id) {
        if (db.exec("DELETE FROM vehicles WHERE id = ?", id) == 0) throw ApiException.notFound("Vehicle not found.");
        return ApiResponse.message("Vehicle removed.");
    }

    @PostMapping("/allocations")
    @PreAuthorize(MANAGERS)
    @Transactional
    public ApiResponse<Map<String, Object>> allocate(@Valid @RequestBody AllocateRequest r) {
        UUID studentId = lookups.studentId(r.student());
        db.one("SELECT id FROM transport_routes WHERE id = ? FOR UPDATE", "Route not found.", r.routeId());
        if (r.stopId() != null && !db.exists("SELECT 1 FROM transport_stops WHERE id = ? AND route_id = ?", r.stopId(), r.routeId())) {
            throw ApiException.badRequest("That stop is not on this route.");
        }
        if (db.exists("SELECT 1 FROM transport_allocations WHERE student_id = ? AND status = 'ACTIVE'", studentId)) throw ApiException.conflict("The student already has a transport allocation.");
        long seats = db.scalar(Long.class, "SELECT COALESCE(sum(capacity), 0) FROM vehicles WHERE route_id = ?", r.routeId());
        long riders = db.scalar(Long.class, "SELECT count(*) FROM transport_allocations WHERE route_id = ? AND status = 'ACTIVE'", r.routeId());
        if (seats == 0) throw ApiException.conflict("No vehicle is assigned to this route yet.");
        if (riders >= seats) throw ApiException.conflict("This route is full (" + seats + " seats).");
        Long id = db.scalar(Long.class, "INSERT INTO transport_allocations (student_id, route_id, stop_id) VALUES (?, ?, ?) RETURNING id", studentId, r.routeId(), r.stopId());
        notifications.notifyStudent(studentId, "Transport allocated", "You have been assigned a bus route.", "TRANSPORT", "/my/campus");
        return ApiResponse.ok("Route allocated.", Map.of("id", id));
    }

    @PostMapping("/allocations/{id}/cancel")
    @PreAuthorize(MANAGERS)
    public ApiResponse<Void> cancel(@PathVariable long id) {
        if (db.exec("UPDATE transport_allocations SET status = 'CANCELLED' WHERE id = ? AND status = 'ACTIVE'", id) == 0) throw ApiException.conflict("Allocation not found or already cancelled.");
        return ApiResponse.message("Allocation cancelled.");
    }

    @GetMapping("/allocations")
    @PreAuthorize(MANAGERS)
    public ApiResponse<List<Map<String, Object>>> allocations(@RequestParam(required = false) Long routeId) {
        String base = allocationSelect() + " WHERE a.status = 'ACTIVE'";
        return ApiResponse.ok(routeId == null ? db.list(base + " ORDER BY rt.name, u.first_name") : db.list(base + " AND a.route_id = ? ORDER BY u.first_name", routeId));
    }

    @GetMapping("/my")
    public ApiResponse<Map<String, Object>> mine(@RequestParam(required = false) UUID studentId) {
        UUID sid = studentId != null ? studentId : access.currentStudentId();
        if (sid == null) throw ApiException.badRequest("Choose a student.");
        access.requireStudentAccess(sid);
        Optional<Map<String, Object>> a = db.find(allocationSelect() + " WHERE a.student_id = ? AND a.status = 'ACTIVE'", sid);
        return ApiResponse.ok(a.isPresent() ? Map.of("allocated", true, "allocation", a.get()) : Map.of("allocated", false));
    }

    private String allocationSelect() {
        return """
                SELECT a.id, a.student_id, s.roll_number, u.first_name || ' ' || u.last_name AS student_name, rt.id AS route_id, rt.name AS route_name,
                       rt.fee_per_term, st.name AS stop_name, st.pickup_time, a.from_date,
                       (SELECT v.registration_no FROM vehicles v WHERE v.route_id = rt.id ORDER BY v.id LIMIT 1) AS vehicle,
                       (SELECT v.driver_name FROM vehicles v WHERE v.route_id = rt.id ORDER BY v.id LIMIT 1) AS driver_name,
                       (SELECT v.driver_phone FROM vehicles v WHERE v.route_id = rt.id ORDER BY v.id LIMIT 1) AS driver_phone
                FROM transport_allocations a JOIN transport_routes rt ON rt.id = a.route_id LEFT JOIN transport_stops st ON st.id = a.stop_id
                JOIN students s ON s.id = a.student_id JOIN users u ON u.id = s.user_id""";
    }
}
