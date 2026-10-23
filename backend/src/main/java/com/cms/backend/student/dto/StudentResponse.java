package com.cms.backend.student.dto;

import com.cms.backend.student.Student;

import java.time.LocalDate;
import java.util.UUID;

public record StudentResponse(
        UUID id,
        UUID userId,
        String fullName,
        String email,
        String rollNumber,
        String idCardNumber,
        Long courseId,
        String courseName,
        Long batchId,
        String batchName,
        Long currentSemesterId,
        String currentSemesterName,
        LocalDate dateOfBirth,
        String gender,
        String bloodGroup,
        String address,
        String status,
        LocalDate admittedOn
) {
    public static StudentResponse from(Student s) {
        return new StudentResponse(
                s.getId(), s.getUser().getId(), s.getUser().getFullName(), s.getUser().getEmail(),
                s.getRollNumber(), s.getIdCardNumber(),
                s.getCourse().getId(), s.getCourse().getName(),
                s.getBatch().getId(), s.getBatch().getName(),
                s.getCurrentSemester() != null ? s.getCurrentSemester().getId() : null,
                s.getCurrentSemester() != null ? s.getCurrentSemester().getName() : null,
                s.getDateOfBirth(), s.getGender(), s.getBloodGroup(), s.getAddress(),
                s.getStatus().name(), s.getAdmittedOn()
        );
    }
}
