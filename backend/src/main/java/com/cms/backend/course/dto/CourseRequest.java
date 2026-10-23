package com.cms.backend.course.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record CourseRequest(
        @NotNull Long departmentId,
        @NotBlank String name,
        @NotBlank String code,
        @NotBlank String level,
        @NotNull BigDecimal durationYears,
        @NotNull @Min(1) Integer totalSemesters,
        Integer totalSeats
) {
}
