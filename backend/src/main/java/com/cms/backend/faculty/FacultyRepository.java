package com.cms.backend.faculty;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface FacultyRepository extends JpaRepository<Faculty, UUID> {
    boolean existsByEmployeeCode(String employeeCode);
    Optional<Faculty> findByUserId(UUID userId);
    List<Faculty> findByDepartmentId(Long departmentId);
    long countByDepartmentId(Long departmentId);
}
