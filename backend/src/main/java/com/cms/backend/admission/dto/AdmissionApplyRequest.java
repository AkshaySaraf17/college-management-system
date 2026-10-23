package com.cms.backend.admission.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record AdmissionApplyRequest(
        @NotNull Long courseId,
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank @Email String email,
        @NotBlank String phone,
        @NotNull LocalDate dateOfBirth,
        String gender,
        String address,
        String guardianName,
        String guardianPhone,
        String guardianEmail,
        String priorEducationJson
) {
}
