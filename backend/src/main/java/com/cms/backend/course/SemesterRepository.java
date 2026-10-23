package com.cms.backend.course;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SemesterRepository extends JpaRepository<Semester, Long> {
    List<Semester> findByCourseIdOrderByNumber(Long courseId);
}
