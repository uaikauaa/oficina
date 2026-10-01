package com.oficinagestao.dto;

public record LoginResult(
        String accessToken,
        String refreshToken,
        long accessExpiresIn,
        long refreshExpiresIn,
        CurrentUserResponse user,
        boolean rememberMe
) {
    public LoginResult(
            String accessToken,
            String refreshToken,
            long accessExpiresIn,
            long refreshExpiresIn,
            CurrentUserResponse user
    ) {
        this(accessToken, refreshToken, accessExpiresIn, refreshExpiresIn, user, false);
    }
}
