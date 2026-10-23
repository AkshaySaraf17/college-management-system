package com.cms.backend.admission;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AdmissionApplicationRepository extends JpaRepository<AdmissionApplication, UUID> {
    boolean existsByApplicationNumber(String applicationNumber);
    Optional<AdmissionApplication> findByApplicationNumber(String applicationNumber);
    List<AdmissionApplication> findByCourseIdAndStatusIn(Long courseId, List<AdmissionStatus> statuses);
    List<AdmissionApplication> findByStatus(AdmissionStatus status);
    List<AdmissionApplication> findByCourseId(Long courseId);
}
