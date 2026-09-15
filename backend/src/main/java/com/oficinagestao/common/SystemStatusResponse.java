package com.oficinagestao.common;

import java.time.OffsetDateTime;

public record SystemStatusResponse(
        String status,
        String environment,
        String authenticatedUser,
        OffsetDateTime timestamp
) {
}
