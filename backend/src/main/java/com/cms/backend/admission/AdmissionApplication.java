package com.cms.backend.admission;

import com.cms.backend.course.Course;
import com.cms.backend.user.User;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "admission_applications")
@Getter
@Setter
@NoArgsConstructor
public class AdmissionApplication {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "application_number", nullable = false, unique = true, length = 30)
    private String applicationNumber;

    @ManyToOne(optional = false)
    @JoinColumn(name = "course_id")
    private Course course;

    @Column(name = "first_name", nullable = false)
    private String firstName;

    @Column(name = "last_name", nullable = false)
    private String lastName;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false, length = 20)
    private String phone;

    @Column(name = "date_of_birth", nullable = false)
    private LocalDate dateOfBirth;

    @Column(length = 20)
    private String gender;

    @Column(columnDefinition = "TEXT")
    private String address;

    @Column(name = "guardian_name", length = 150)
    private String guardianName;

    @Column(name = "guardian_phone", length = 20)
    private String guardianPhone;

    @Column(name = "guardian_email")
    private String guardianEmail;

    @Column(name = "prior_education", columnDefinition = "TEXT")
    private String priorEducationJson;

    @Column(name = "entrance_exam_score", precision = 6, scale = 2)
    private BigDecimal entranceExamScore;

    @Column(name = "merit_score", precision = 6, scale = 2)
    private BigDecimal meritScore;

    @Column(name = "merit_rank")
    private Integer meritRank;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private AdmissionStatus status = AdmissionStatus.SUBMITTED;

    @Column(name = "review_notes", columnDefinition = "TEXT")
    private String reviewNotes;

    @ManyToOne
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private Instant reviewedAt;

    @Column(name = "admission_fee_paid", nullable = false)
    private boolean admissionFeePaid = false;

    @Column(name = "admission_fee_amount", precision = 10, scale = 2)
    private BigDecimal admissionFeeAmount;

    @Column(name = "enrolled_student_id")
    private UUID enrolledStudentId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PreUpdate
    public void preUpdate() {
        this.updatedAt = Instant.now();
    }

    public String getFullName() {
        return firstName + " " + lastName;
    }
}
