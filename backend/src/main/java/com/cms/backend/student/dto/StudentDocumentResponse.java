package com.cms.backend.student.dto;

import com.cms.backend.student.StudentDocument;

public record StudentDocumentResponse(Long id, String docType, String fileUrl) {
    public static StudentDocumentResponse from(StudentDocument d) {
        return new StudentDocumentResponse(d.getId(), d.getDocType(), d.getFileUrl());
    }
}
