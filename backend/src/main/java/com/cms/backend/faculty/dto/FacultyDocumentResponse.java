package com.cms.backend.faculty.dto;

import com.cms.backend.faculty.FacultyDocument;

public record FacultyDocumentResponse(Long id, String docType, String fileUrl, boolean verified) {
    public static FacultyDocumentResponse from(FacultyDocument d) {
        return new FacultyDocumentResponse(d.getId(), d.getDocType(), d.getFileUrl(), d.isVerified());
    }
}
