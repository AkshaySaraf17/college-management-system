package com.cms.backend.faculty.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record SubjectAllocationRequest(
        @NotNull UUID facultyId,
        @NotNull Long subjectId,
        @NotNull Long batchId,
        @NotBlank String academicYear
) {
}
