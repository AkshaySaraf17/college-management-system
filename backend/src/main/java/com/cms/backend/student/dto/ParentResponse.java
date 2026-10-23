package com.cms.backend.student.dto;

import com.cms.backend.student.Parent;

import java.util.UUID;

public record ParentResponse(
        UUID id, String fullName, String relation, String phone, String email, String occupation, boolean primaryContact
) {
    public static ParentResponse from(Parent p, boolean primaryContact) {
        return new ParentResponse(p.getId(), p.getFirstName() + " " + p.getLastName(), p.getRelation().name(),
                p.getPhone(), p.getEmail(), p.getOccupation(), primaryContact);
    }
}
