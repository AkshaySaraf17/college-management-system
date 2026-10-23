package com.cms.backend.faculty;

import com.cms.backend.common.ApiResponse;
import com.cms.backend.faculty.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/faculty")
@RequiredArgsConstructor
public class FacultyController {

    private final FacultyService facultyService;

    @PostMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<FacultyRegisterResult> register(@Valid @RequestBody FacultyRegisterRequest request) {
        return ApiResponse.ok("Faculty registered.", facultyService.register(request));
    }

    @GetMapping
    public ApiResponse<List<FacultyResponse>> listAll(@RequestParam(required = false) Long departmentId) {
        return ApiResponse.ok(departmentId != null
                ? facultyService.listByDepartment(departmentId)
                : facultyService.listAll());
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('FACULTY')")
    public ApiResponse<FacultyResponse> getMyProfile(Authentication authentication) {
        return ApiResponse.ok(facultyService.getMyProfile(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ApiResponse<FacultyResponse> getById(@PathVariable UUID id) {
        return ApiResponse.ok(facultyService.getById(id));
    }

    @PatchMapping("/{id}/department")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<FacultyResponse> assignDepartment(@PathVariable UUID id, @RequestBody Map<String, Long> body) {
        return ApiResponse.ok("Department assigned.", facultyService.assignDepartment(id, body.get("departmentId")));
    }

    @PostMapping("/{id}/documents")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY')")
    public ApiResponse<FacultyDocumentResponse> uploadDocument(@PathVariable UUID id, @Valid @RequestBody DocumentUploadRequest request) {
        return ApiResponse.ok("Document uploaded.", facultyService.uploadDocument(id, request));
    }

    @GetMapping("/{id}/documents")
    public ApiResponse<List<FacultyDocumentResponse>> listDocuments(@PathVariable UUID id) {
        return ApiResponse.ok(facultyService.listDocuments(id));
    }

    @PatchMapping("/documents/{documentId}/verify")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Void> verifyDocument(@PathVariable Long documentId) {
        facultyService.verifyDocument(documentId);
        return ApiResponse.message("Document verified.");
    }

    @PostMapping("/allocations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD')")
    public ApiResponse<SubjectAllocationResponse> allocateSubject(@Valid @RequestBody SubjectAllocationRequest request) {
        return ApiResponse.ok("Subject allocated.", facultyService.allocateSubject(request));
    }

    @GetMapping("/{id}/allocations")
    public ApiResponse<List<SubjectAllocationResponse>> listAllocations(@PathVariable UUID id) {
        return ApiResponse.ok(facultyService.listAllocations(id));
    }

    @PostMapping("/{id}/leaves")
    @PreAuthorize("hasAnyRole('FACULTY','SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<LeaveResponse> applyLeave(@PathVariable UUID id, @Valid @RequestBody LeaveRequest request) {
        return ApiResponse.ok("Leave request submitted.", facultyService.applyLeave(id, request));
    }

    @GetMapping("/{id}/leaves")
    public ApiResponse<List<LeaveResponse>> listLeaves(@PathVariable UUID id) {
        return ApiResponse.ok(facultyService.listLeaves(id));
    }

    @PatchMapping("/leaves/{leaveId}/approve")
    @PreAuthorize("hasAnyRole('HOD','SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<LeaveResponse> approveLeave(@PathVariable Long leaveId) {
        return ApiResponse.ok("Leave approved.", facultyService.decideLeave(leaveId, true));
    }

    @PatchMapping("/leaves/{leaveId}/reject")
    @PreAuthorize("hasAnyRole('HOD','SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<LeaveResponse> rejectLeave(@PathVariable Long leaveId) {
        return ApiResponse.ok("Leave rejected.", facultyService.decideLeave(leaveId, false));
    }
}
