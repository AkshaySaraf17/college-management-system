package com.cms.backend.course.dto;

import com.cms.backend.course.Subject;

import java.math.BigDecimal;

public record SubjectResponse(
        Long id, Long semesterId, String name, String code, BigDecimal credits, boolean elective
) {
    public static SubjectResponse from(Subject s) {
        return new SubjectResponse(s.getId(), s.getSemester().getId(), s.getName(), s.getCode(),
                s.getCredits(), s.isElective());
    }
}
