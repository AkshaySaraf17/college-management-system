package com.cms.backend.admission.dto;

import java.math.BigDecimal;

public record ReviewRequest(BigDecimal entranceExamScore, String notes) {
}
