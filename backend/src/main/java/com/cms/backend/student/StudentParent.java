package com.cms.backend.student;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "student_parents")
@Getter
@Setter
@NoArgsConstructor
public class StudentParent {

    @EmbeddedId
    private StudentParentId id;

    @ManyToOne(optional = false)
    @MapsId("studentId")
    @JoinColumn(name = "student_id")
    private Student student;

    @ManyToOne(optional = false)
    @MapsId("parentId")
    @JoinColumn(name = "parent_id")
    private Parent parent;

    @Column(name = "is_primary_contact", nullable = false)
    private boolean primaryContact = false;

    public StudentParent(Student student, Parent parent, boolean primaryContact) {
        this.student = student;
        this.parent = parent;
        this.id = new StudentParentId(student.getId(), parent.getId());
        this.primaryContact = primaryContact;
    }
}
