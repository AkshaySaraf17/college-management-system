package com.cms.backend.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record SubjectRequest(
        @NotNull Long semesterId,
        @NotBlank String name,
        @NotBlank String code,
        @NotNull BigDecimal credits,
        boolean elective
) {
}
