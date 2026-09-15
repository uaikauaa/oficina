package com.oficinagestao.auth;

public record LoginResult(
        String accessToken,
        String refreshToken,
        long accessExpiresIn,
        long refreshExpiresIn,
        CurrentUserResponse user
) {
}
