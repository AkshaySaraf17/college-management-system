package com.cms.backend.student;

import com.cms.backend.course.Semester;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "student_academic_history")
@Getter
@Setter
@NoArgsConstructor
public class StudentAcademicHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false)
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne(optional = false)
    @JoinColumn(name = "semester_id")
    private Semester semester;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AcademicHistoryStatus status = AcademicHistoryStatus.IN_PROGRESS;

    @Column(precision = 4, scale = 2)
    private BigDecimal sgpa;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();
}
