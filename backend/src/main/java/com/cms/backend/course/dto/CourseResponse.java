package com.cms.backend.course.dto;

import com.cms.backend.course.Course;

import java.math.BigDecimal;

public record CourseResponse(
        Long id,
        Long departmentId,
        String departmentName,
        String name,
        String code,
        String level,
        BigDecimal durationYears,
        Integer totalSemesters,
        Integer totalSeats
) {
    public static CourseResponse from(Course c) {
        return new CourseResponse(c.getId(), c.getDepartment().getId(), c.getDepartment().getName(),
                c.getName(), c.getCode(), c.getLevel().name(), c.getDurationYears(),
                c.getTotalSemesters(), c.getTotalSeats());
    }
}
