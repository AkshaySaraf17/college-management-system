package com.cms.backend.student;

import com.cms.backend.common.AccessService;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.file.FileStorageService;
import com.cms.backend.student.dto.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/students")
@RequiredArgsConstructor
public class StudentController {

    private final StudentService studentService;
    private final AccessService access;
    private final Db db;
    private final FileStorageService files;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','FACULTY','ACCOUNTANT')")
    public ApiResponse<List<StudentResponse>> listAll(@RequestParam(required = false) Long courseId,
                                                        @RequestParam(required = false) Long batchId) {
        if (courseId != null) return ApiResponse.ok(studentService.listByCourse(courseId));
        if (batchId != null) return ApiResponse.ok(studentService.listByBatch(batchId));
        return ApiResponse.ok(studentService.listAll());
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<StudentResponse> getMyProfile(Authentication authentication) {
        return ApiResponse.ok(studentService.getMyProfile(authentication.getName()));
    }

    @GetMapping("/{id}")
    public ApiResponse<StudentResponse> getById(@PathVariable UUID id) {
        access.requireStudentAccess(id);
        return ApiResponse.ok(studentService.getById(id));
    }

    @PatchMapping("/{id}/semester")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD')")
    public ApiResponse<StudentResponse> promote(@PathVariable UUID id, @RequestBody Map<String, Long> body) {
        return ApiResponse.ok("Student promoted.", studentService.promoteToSemester(id, body.get("semesterId")));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<StudentResponse> updateStatus(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return ApiResponse.ok("Status updated.", studentService.updateStatus(id, body.get("status")));
    }

    @PatchMapping("/{id}/profile")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<StudentResponse> updateProfile(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        db.exec("UPDATE students SET blood_group = COALESCE(?, blood_group), address = COALESCE(?, address), gender = COALESCE(?, gender), updated_at = now() WHERE id = ?",
                body.get("bloodGroup"), body.get("address"), body.get("gender"), id);
        return ApiResponse.ok("Profile updated.", studentService.getById(id));
    }

    @PostMapping("/{id}/parents")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<ParentResponse> addParent(@PathVariable UUID id, @Valid @RequestBody ParentRequest request) {
        return ApiResponse.ok("Parent added.", studentService.addParent(id, request));
    }

    @GetMapping("/{id}/parents")
    public ApiResponse<List<ParentResponse>> listParents(@PathVariable UUID id) {
        access.requireStudentAccess(id);
        return ApiResponse.ok(studentService.listParents(id));
    }

    @PostMapping("/{id}/academic-history")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','HOD','FACULTY')")
    public ApiResponse<AcademicHistoryResponse> recordSemesterResult(@PathVariable UUID id, @RequestBody Map<String, Object> body) {
        Long semesterId = Long.valueOf(body.get("semesterId").toString());
        String status = body.get("status").toString();
        BigDecimal sgpa = body.get("sgpa") != null ? new BigDecimal(body.get("sgpa").toString()) : null;
        return ApiResponse.ok("Semester result recorded.", studentService.recordSemesterResult(id, semesterId, status, sgpa));
    }

    @GetMapping("/{id}/academic-history")
    public ApiResponse<List<AcademicHistoryResponse>> listAcademicHistory(@PathVariable UUID id) {
        access.requireStudentAccess(id);
        return ApiResponse.ok(studentService.listAcademicHistory(id));
    }

    @PostMapping("/{id}/documents")
    public ApiResponse<StudentDocumentResponse> uploadDocument(@PathVariable UUID id, @Valid @RequestBody StudentDocumentRequest request) {
        access.requireStudentAccess(id);
        return ApiResponse.ok("Document uploaded.", studentService.uploadDocument(id, request));
    }

    @PostMapping("/{id}/documents/upload")
    public ApiResponse<StudentDocumentResponse> uploadDocumentFile(@PathVariable UUID id, @RequestParam String docType,
                                                                    @RequestParam("file") MultipartFile file) {
        access.requireStudentAccess(id);
        Map<String, Object> stored = files.store(file, access.userId());
        return ApiResponse.ok("Document uploaded.",
                studentService.uploadDocument(id, new StudentDocumentRequest(docType, (String) stored.get("url"))));
    }

    @GetMapping("/{id}/documents")
    public ApiResponse<List<StudentDocumentResponse>> listDocuments(@PathVariable UUID id) {
        access.requireStudentAccess(id);
        return ApiResponse.ok(studentService.listDocuments(id));
    }
}
