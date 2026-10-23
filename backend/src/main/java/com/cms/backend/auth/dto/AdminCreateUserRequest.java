package com.cms.backend.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminCreateUserRequest {

    @NotBlank
    @Email
    private String email;

    @NotBlank
    private String firstName;

    @NotBlank
    private String lastName;

    private String phone;

    /** Any role name, e.g. FACULTY, HOD, ACCOUNTANT, LIBRARIAN, ... */
    @NotBlank
    private String role;

    /** If omitted, a temporary password is generated and returned in the response. */
    private String temporaryPassword;
}
