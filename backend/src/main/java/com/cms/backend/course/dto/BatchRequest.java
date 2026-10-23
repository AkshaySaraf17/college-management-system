package com.cms.backend.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record BatchRequest(
        @NotNull Long courseId,
        @NotBlank String name,
        @NotNull Integer startYear,
        @NotNull Integer endYear
) {
}
