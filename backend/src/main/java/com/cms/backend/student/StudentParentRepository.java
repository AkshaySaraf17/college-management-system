package com.cms.backend.student;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface StudentParentRepository extends JpaRepository<StudentParent, StudentParentId> {
    List<StudentParent> findByStudentId(UUID studentId);
}
