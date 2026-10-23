package com.cms.backend.course.dto;

import com.cms.backend.course.Batch;

public record BatchResponse(Long id, Long courseId, String name, Integer startYear, Integer endYear) {
    public static BatchResponse from(Batch b) {
        return new BatchResponse(b.getId(), b.getCourse().getId(), b.getName(), b.getStartYear(), b.getEndYear());
    }
}
