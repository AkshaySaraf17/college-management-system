package com.cms.backend.faculty.dto;

import com.cms.backend.faculty.Faculty;

import java.time.LocalDate;
import java.util.UUID;

public record FacultyResponse(
        UUID id,
        UUID userId,
        String fullName,
        String email,
        String employeeCode,
        Long departmentId,
        String departmentName,
        String designation,
        String qualification,
        LocalDate dateOfJoining,
        String employmentType,
        String status,
        boolean documentsVerified
) {
    public static FacultyResponse from(Faculty f) {
        return new FacultyResponse(
                f.getId(), f.getUser().getId(), f.getUser().getFullName(), f.getUser().getEmail(),
                f.getEmployeeCode(),
                f.getDepartment() != null ? f.getDepartment().getId() : null,
                f.getDepartment() != null ? f.getDepartment().getName() : null,
                f.getDesignation(), f.getQualification(), f.getDateOfJoining(),
                f.getEmploymentType().name(), f.getStatus().name(), f.isDocumentsVerified()
        );
    }
}
