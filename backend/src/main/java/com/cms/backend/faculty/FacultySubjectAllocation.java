package com.cms.backend.faculty;

import com.cms.backend.course.Batch;
import com.cms.backend.course.Subject;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "faculty_subject_allocations")
@Getter
@Setter
@NoArgsConstructor
public class FacultySubjectAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "faculty_id")
    private Faculty faculty;

    @ManyToOne(optional = false)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @ManyToOne(optional = false)
    @JoinColumn(name = "batch_id")
    private Batch batch;

    @Column(name = "academic_year", nullable = false, length = 9)
    private String academicYear;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
