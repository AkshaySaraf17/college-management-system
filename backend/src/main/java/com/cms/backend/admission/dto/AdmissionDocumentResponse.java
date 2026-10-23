package com.cms.backend.admission.dto;

import com.cms.backend.admission.AdmissionDocument;

public record AdmissionDocumentResponse(Long id, String docType, String fileUrl, boolean verified) {
    public static AdmissionDocumentResponse from(AdmissionDocument d) {
        return new AdmissionDocumentResponse(d.getId(), d.getDocType(), d.getFileUrl(), d.isVerified());
    }
}
