package com.cms.backend.course;

import com.cms.backend.common.ApiResponse;
import com.cms.backend.course.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CourseController {

    private final CourseService courseService;

    // ----- Courses -----

    @GetMapping("/courses")
    public ApiResponse<List<CourseResponse>> listCourses() {
        return ApiResponse.ok(courseService.listCourses());
    }

    @GetMapping("/courses/{id}")
    public ApiResponse<CourseResponse> getCourse(@PathVariable Long id) {
        return ApiResponse.ok(courseService.getCourse(id));
    }

    @PostMapping("/courses")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<CourseResponse> createCourse(@Valid @RequestBody CourseRequest request) {
        return ApiResponse.ok("Course created.", courseService.createCourse(request));
    }

    @DeleteMapping("/courses/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Void> deleteCourse(@PathVariable Long id) {
        courseService.deleteCourse(id);
        return ApiResponse.message("Course deleted.");
    }

    // ----- Batches -----

    @GetMapping("/courses/{courseId}/batches")
    public ApiResponse<List<BatchResponse>> listBatches(@PathVariable Long courseId) {
        return ApiResponse.ok(courseService.listBatches(courseId));
    }

    @PostMapping("/batches")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<BatchResponse> createBatch(@Valid @RequestBody BatchRequest request) {
        return ApiResponse.ok("Batch created.", courseService.createBatch(request));
    }

    // ----- Semesters -----

    @GetMapping("/courses/{courseId}/semesters")
    public ApiResponse<List<SemesterResponse>> listSemesters(@PathVariable Long courseId) {
        return ApiResponse.ok(courseService.listSemesters(courseId));
    }

    // ----- Subjects -----

    @GetMapping("/semesters/{semesterId}/subjects")
    public ApiResponse<List<SubjectResponse>> listSubjects(@PathVariable Long semesterId) {
        return ApiResponse.ok(courseService.listSubjects(semesterId));
    }

    @PostMapping("/subjects")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD')")
    public ApiResponse<SubjectResponse> createSubject(@Valid @RequestBody SubjectRequest request) {
        return ApiResponse.ok("Subject created.", courseService.createSubject(request));
    }

    @DeleteMapping("/subjects/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD')")
    public ApiResponse<Void> deleteSubject(@PathVariable Long id) {
        courseService.deleteSubject(id);
        return ApiResponse.message("Subject deleted.");
    }

    // ----- Academic calendar -----

    @GetMapping("/calendar-events")
    public ApiResponse<List<CalendarEventResponse>> listCalendarEvents() {
        return ApiResponse.ok(courseService.listCalendarEvents());
    }

    @PostMapping("/calendar-events")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<CalendarEventResponse> createCalendarEvent(@Valid @RequestBody CalendarEventRequest request) {
        return ApiResponse.ok("Event created.", courseService.createCalendarEvent(request));
    }
}
