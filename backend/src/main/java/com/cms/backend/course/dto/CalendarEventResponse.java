package com.cms.backend.course.dto;

import com.cms.backend.course.AcademicCalendarEvent;

import java.time.LocalDate;

public record CalendarEventResponse(
        Long id, String title, String description, String eventType,
        LocalDate startDate, LocalDate endDate, Long departmentId
) {
    public static CalendarEventResponse from(AcademicCalendarEvent e) {
        return new CalendarEventResponse(e.getId(), e.getTitle(), e.getDescription(), e.getEventType().name(),
                e.getStartDate(), e.getEndDate(), e.getDepartment() != null ? e.getDepartment().getId() : null);
    }
}
