package com.cms.backend.course.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CalendarEventRequest(
        @NotBlank String title,
        String description,
        @NotBlank String eventType,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        Long departmentId
) {
}
