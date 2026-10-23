package com.cms.backend.faculty.dto;

import jakarta.validation.constraints.NotBlank;

public record DocumentUploadRequest(@NotBlank String docType, @NotBlank String fileUrl) {
}
