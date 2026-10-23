package com.cms.backend.faculty;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "faculty_documents")
@Getter
@Setter
@NoArgsConstructor
public class FacultyDocument {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;

    @Column(name = "doc_type", nullable = false, length = 50)
    private String docType;

    @Column(name = "file_url", nullable = false, length = 500)
    private String fileUrl;

    @Column(nullable = false)
    private boolean verified = false;

    @Column(name = "uploaded_at", nullable = false, updatable = false)
    private Instant uploadedAt = Instant.now();
}
