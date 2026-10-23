package com.cms.backend.course;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SubjectRepository extends JpaRepository<Subject, Long> {
    boolean existsByCode(String code);
    List<Subject> findBySemesterId(Long semesterId);
}
