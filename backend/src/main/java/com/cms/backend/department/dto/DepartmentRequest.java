package com.cms.backend.department.dto;

import jakarta.validation.constraints.NotBlank;

public record DepartmentRequest(
        @NotBlank String name,
        @NotBlank String code,
        Integer establishedYear
) {
}
