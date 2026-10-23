package com.cms.backend.faculty.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record FacultyRegisterRequest(
        @NotBlank @Email String email,
        @NotBlank String firstName,
        @NotBlank String lastName,
        String phone,
        @NotNull Long departmentId,
        String designation,
        String qualification,
        @NotNull LocalDate dateOfJoining,
        @NotBlank String employmentType
) {
}
