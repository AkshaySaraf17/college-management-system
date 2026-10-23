package com.cms.backend.admission.dto;

import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

public record FeePaymentRequest(@NotNull BigDecimal amount) {
}
