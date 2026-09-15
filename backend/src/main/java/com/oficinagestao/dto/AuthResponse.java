package com.oficinagestao.dto;

public record AuthResponse(
        String accessToken,
        String tokenType,
        long expiresIn,
        CurrentUserResponse user
) {
}
