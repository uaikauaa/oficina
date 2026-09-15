package com.oficinagestao.dto;

public record LoginResult(
        String accessToken,
        String refreshToken,
        long accessExpiresIn,
        long refreshExpiresIn,
        CurrentUserResponse user
) {
}
