package com.cms.backend.course;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CourseRepository extends JpaRepository<Course, Long> {
    boolean existsByCode(String code);
    List<Course> findByDepartmentId(Long departmentId);
}
