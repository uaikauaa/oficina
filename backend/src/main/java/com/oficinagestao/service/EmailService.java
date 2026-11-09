package com.oficinagestao.service;

public interface EmailService {

    void sendTwoFactorCode(String to, String code);

    void sendInvitation(String to, String acceptanceUrl);
}
