package com.oficinagestao.dto;

import jakarta.validation.constraints.NotBlank;

public record CompletePasswordRecoveryRequest(@NotBlank String token,
                                              @NotBlank String senha,
                                              @NotBlank String confirmacao) {
    @Override public String toString() { return "CompletePasswordRecoveryRequest[redacted]"; }
}
