package com.cms.backend.faculty;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface FacultyLeaveRepository extends JpaRepository<FacultyLeave, Long> {
    List<FacultyLeave> findByFacultyId(UUID facultyId);
}
