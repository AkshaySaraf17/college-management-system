package com.cms.backend.student.dto;

import jakarta.validation.constraints.NotBlank;

public record StudentDocumentRequest(@NotBlank String docType, @NotBlank String fileUrl) {
}
