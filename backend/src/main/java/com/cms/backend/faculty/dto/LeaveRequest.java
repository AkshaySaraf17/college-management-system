package com.cms.backend.faculty.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record LeaveRequest(
        @NotBlank String leaveType,
        @NotNull LocalDate startDate,
        @NotNull LocalDate endDate,
        String reason
) {
}
