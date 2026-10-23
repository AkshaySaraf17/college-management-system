package com.cms.backend.student.dto;

import jakarta.validation.constraints.NotBlank;

public record ParentRequest(
        @NotBlank String firstName,
        @NotBlank String lastName,
        @NotBlank String relation,
        @NotBlank String phone,
        String email,
        String occupation,
        boolean primaryContact
) {
}
