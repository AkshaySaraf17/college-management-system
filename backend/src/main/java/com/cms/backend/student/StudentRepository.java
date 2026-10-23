package com.cms.backend.student;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface StudentRepository extends JpaRepository<Student, UUID> {
    boolean existsByRollNumber(String rollNumber);
    boolean existsByIdCardNumber(String idCardNumber);
    Optional<Student> findByUserId(UUID userId);
    List<Student> findByCourseId(Long courseId);
    List<Student> findByBatchId(Long batchId);
    long countByCourseId(Long courseId);
}
