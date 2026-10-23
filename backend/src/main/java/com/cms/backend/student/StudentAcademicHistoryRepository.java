package com.cms.backend.student;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StudentAcademicHistoryRepository extends JpaRepository<StudentAcademicHistory, Long> {
    List<StudentAcademicHistory> findByStudentIdOrderBySemesterIdAsc(UUID studentId);
}
