package com.cms.backend.admission;

import com.cms.backend.admission.dto.*;
import com.cms.backend.common.ApiException;
import com.cms.backend.common.ApiResponse;
import com.cms.backend.common.Db;
import com.cms.backend.file.FileStorageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admissions")
@RequiredArgsConstructor
public class AdmissionController {

    private final AdmissionService admissionService;
    private final FileStorageService files;
    private final Db db;

    @PostMapping("/apply")
    public ApiResponse<AdmissionResponse> apply(@Valid @RequestBody AdmissionApplyRequest request) {
        return ApiResponse.ok("Application submitted.", admissionService.apply(request));
    }

    @GetMapping("/track/{applicationNumber}")
    public ApiResponse<AdmissionResponse> track(@PathVariable String applicationNumber) {
        return ApiResponse.ok(admissionService.getByApplicationNumber(applicationNumber));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','ACCOUNTANT')")
    public ApiResponse<List<AdmissionResponse>> listAll(@RequestParam(required = false) Long courseId) {
        return ApiResponse.ok(courseId != null ? admissionService.listByCourse(courseId) : admissionService.listAll());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD','ACCOUNTANT')")
    public ApiResponse<AdmissionResponse> getById(@PathVariable UUID id) {
        return ApiResponse.ok(admissionService.getById(id));
    }

    @PostMapping("/{id}/documents")
    public ApiResponse<AdmissionDocumentResponse> uploadDocument(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return ApiResponse.ok("Document uploaded.", admissionService.uploadDocument(id, body.get("docType"), body.get("fileUrl")));
    }

    /** Applicants are not logged in yet, so uploads are keyed by the (unguessable) application id. */
    @PostMapping("/{id}/documents/upload")
    public ApiResponse<AdmissionDocumentResponse> uploadDocumentFile(@PathVariable UUID id, @RequestParam String docType,
                                                                      @RequestParam("file") MultipartFile file) {
        Map<String, Object> stored = files.store(file, null);
        return ApiResponse.ok("Document uploaded.", admissionService.uploadDocument(id, docType, (String) stored.get("url")));
    }

    @PatchMapping("/documents/{documentId}/verify")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<Void> verifyDocument(@PathVariable long documentId) {
        if (db.exec("UPDATE admission_documents SET verified = TRUE WHERE id = ?", documentId) == 0) {
            throw ApiException.notFound("Document not found.");
        }
        return ApiResponse.message("Document verified.");
    }

    @GetMapping("/{id}/documents")
    public ApiResponse<List<AdmissionDocumentResponse>> listDocuments(@PathVariable UUID id) {
        return ApiResponse.ok(admissionService.listDocuments(id));
    }

    @PatchMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<AdmissionResponse> review(@PathVariable UUID id, @RequestBody ReviewRequest request) {
        return ApiResponse.ok("Application under review.", admissionService.review(id, request));
    }

    @PatchMapping("/{id}/reject")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL','HOD')")
    public ApiResponse<AdmissionResponse> reject(@PathVariable UUID id, @RequestBody Map<String, String> body) {
        return ApiResponse.ok("Application rejected.", admissionService.reject(id, body.get("notes")));
    }

    @PostMapping("/merit-list")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<List<AdmissionResponse>> generateMeritList(@RequestParam Long courseId) {
        return ApiResponse.ok("Merit list generated.", admissionService.generateMeritList(courseId));
    }

    @PatchMapping("/{id}/approve")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','PRINCIPAL')")
    public ApiResponse<AdmissionResponse> approve(@PathVariable UUID id) {
        return ApiResponse.ok("Application approved, pending fee payment.", admissionService.approve(id));
    }

    @PostMapping("/{id}/fee-payment")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','ACCOUNTANT')")
    public ApiResponse<AdmissionResponse> recordFeePayment(@PathVariable UUID id, @Valid @RequestBody FeePaymentRequest request) {
        return ApiResponse.ok("Admission fee recorded.", admissionService.recordFeePayment(id, request));
    }

    @PostMapping("/{id}/enroll")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ApiResponse<Map<String, Object>> enroll(@PathVariable UUID id, @RequestBody Map<String, Long> body) {
        return ApiResponse.ok("Student enrolled.", admissionService.enroll(id, body.get("batchId")));
    }

    @PatchMapping("/{id}/withdraw")
    public ApiResponse<AdmissionResponse> withdraw(@PathVariable UUID id) {
        return ApiResponse.ok("Application withdrawn.", admissionService.withdraw(id));
    }
}
