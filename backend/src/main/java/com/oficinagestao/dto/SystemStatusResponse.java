package com.oficinagestao.dto;

import java.time.OffsetDateTime;

public record SystemStatusResponse(
        String status,
        String environment,
        String authenticatedUser,
        OffsetDateTime timestamp
) {
}
