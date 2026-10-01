package com.oficinagestao.dto;

public record LoginChallengeResponse(
        boolean twoFactorRequired,
        String challengeToken,
        String mensagem
) {}
