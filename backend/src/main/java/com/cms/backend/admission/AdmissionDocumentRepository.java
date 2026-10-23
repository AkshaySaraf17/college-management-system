package com.cms.backend.admission;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface AdmissionDocumentRepository extends JpaRepository<AdmissionDocument, Long> {
    List<AdmissionDocument> findByApplicationId(UUID applicationId);
}
