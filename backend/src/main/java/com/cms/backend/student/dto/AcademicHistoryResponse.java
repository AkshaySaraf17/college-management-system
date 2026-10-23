package com.cms.backend.student.dto;

import com.cms.backend.student.StudentAcademicHistory;

import java.math.BigDecimal;

public record AcademicHistoryResponse(Long id, Long semesterId, String semesterName, String status, BigDecimal sgpa) {
    public static AcademicHistoryResponse from(StudentAcademicHistory h) {
        return new AcademicHistoryResponse(h.getId(), h.getSemester().getId(), h.getSemester().getName(),
                h.getStatus().name(), h.getSgpa());
    }
}
