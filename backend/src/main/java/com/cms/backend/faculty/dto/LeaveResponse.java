package com.cms.backend.faculty.dto;

import com.cms.backend.faculty.FacultyLeave;

import java.time.LocalDate;
import java.util.UUID;

public record LeaveResponse(
        Long id, UUID facultyId, String leaveType, LocalDate startDate, LocalDate endDate,
        String reason, String status
) {
    public static LeaveResponse from(FacultyLeave l) {
        return new LeaveResponse(l.getId(), l.getFaculty().getId(), l.getLeaveType().name(),
                l.getStartDate(), l.getEndDate(), l.getReason(), l.getStatus().name());
    }
}
