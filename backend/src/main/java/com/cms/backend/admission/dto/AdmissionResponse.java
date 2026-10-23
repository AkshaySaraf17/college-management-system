package com.cms.backend.admission.dto;

import com.cms.backend.admission.AdmissionApplication;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record AdmissionResponse(
        UUID id,
        String applicationNumber,
        Long courseId,
        String courseName,
        String fullName,
        String email,
        String phone,
        LocalDate dateOfBirth,
        String status,
        BigDecimal entranceExamScore,
        BigDecimal meritScore,
        Integer meritRank,
        boolean admissionFeePaid,
        BigDecimal admissionFeeAmount,
        UUID enrolledStudentId,
        String reviewNotes
) {
    public static AdmissionResponse from(AdmissionApplication a) {
        return new AdmissionResponse(
                a.getId(), a.getApplicationNumber(), a.getCourse().getId(), a.getCourse().getName(),
                a.getFullName(), a.getEmail(), a.getPhone(), a.getDateOfBirth(), a.getStatus().name(),
                a.getEntranceExamScore(), a.getMeritScore(), a.getMeritRank(),
                a.isAdmissionFeePaid(), a.getAdmissionFeeAmount(), a.getEnrolledStudentId(), a.getReviewNotes()
        );
    }
}
