package com.cms.backend.course.dto;

import com.cms.backend.course.Semester;

public record SemesterResponse(Long id, Long courseId, Integer number, String name) {
    public static SemesterResponse from(Semester s) {
        return new SemesterResponse(s.getId(), s.getCourse().getId(), s.getNumber(), s.getName());
    }
}
