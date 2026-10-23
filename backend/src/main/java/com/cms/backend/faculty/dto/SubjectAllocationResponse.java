package com.cms.backend.faculty.dto;

import com.cms.backend.faculty.FacultySubjectAllocation;

import java.util.UUID;

public record SubjectAllocationResponse(
        Long id, UUID facultyId, Long subjectId, String subjectName, Long batchId, String batchName, String academicYear
) {
    public static SubjectAllocationResponse from(FacultySubjectAllocation a) {
        return new SubjectAllocationResponse(a.getId(), a.getFaculty().getId(),
                a.getSubject().getId(), a.getSubject().getName(),
                a.getBatch().getId(), a.getBatch().getName(), a.getAcademicYear());
    }
}
