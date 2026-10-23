package com.cms.backend.faculty;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacultySubjectAllocationRepository extends JpaRepository<FacultySubjectAllocation, Long> {
    List<FacultySubjectAllocation> findByFacultyId(UUID facultyId);
    boolean existsBySubjectIdAndBatchIdAndAcademicYear(Long subjectId, Long batchId, String academicYear);
}
