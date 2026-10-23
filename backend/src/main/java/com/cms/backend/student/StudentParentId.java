package com.cms.backend.student;

import jakarta.persistence.Embeddable;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.util.UUID;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@EqualsAndHashCode
public class StudentParentId implements Serializable {
    private UUID studentId;
    private UUID parentId;

    public StudentParentId(UUID studentId, UUID parentId) {
        this.studentId = studentId;
        this.parentId = parentId;
    }
}
