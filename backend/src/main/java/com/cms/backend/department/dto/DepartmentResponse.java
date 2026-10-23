package com.cms.backend.department.dto;

import com.cms.backend.department.Department;

import java.util.UUID;

public record DepartmentResponse(
        Long id,
        String name,
        String code,
        UUID hodUserId,
        Integer establishedYear
) {
    public static DepartmentResponse from(Department d) {
        return new DepartmentResponse(d.getId(), d.getName(), d.getCode(), d.getHodUserId(), d.getEstablishedYear());
    }
}
