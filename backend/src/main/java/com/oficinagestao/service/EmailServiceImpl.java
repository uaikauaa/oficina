package com.oficinagestao.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailServiceImpl implements EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailServiceImpl.class);

    private final JavaMailSender mailSender;
    private final String fromEmail;
    private final String activeProfile;

    @Autowired
    public EmailServiceImpl(
            @Autowired(required = false) JavaMailSender mailSender,
            @Value("${app.mail.from:noreply@oficinagestao.com.br}") String fromEmail,
            @Value("${spring.profiles.active:dev}") String activeProfile
    ) {
        this.mailSender = mailSender;
        this.fromEmail = fromEmail;
        this.activeProfile = activeProfile;
    }

    public EmailServiceImpl(
            JavaMailSender mailSender,
            String fromEmail
    ) {
        this(mailSender, fromEmail, "dev");
    }

    @Override
    public void sendTwoFactorCode(String to, String code) {
        boolean isProd = "prod".equalsIgnoreCase(activeProfile) || "production".equalsIgnoreCase(activeProfile);

        if (mailSender == null || isHostMissing(mailSender)) {
            if (isProd) {
                log.error("Falha no envio do código de verificação 2FA: serviço SMTP não configurado no ambiente de produção.");
                throw new com.oficinagestao.exception.BusinessException("Serviço de envio de e-mails não configurado. Contate o suporte.");
            }
            log.warn("Serviço SMTP não inicializado ou sem host configurado (MAIL_HOST ausente). Envio de e-mail de 2FA ignorado em ambiente local para [{}].", to);
            return;
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(to);
            message.setSubject("Código de verificação — Oficina Gestão");
            message.setText(
                    "Olá,\n\n" +
                    "Foi solicitada uma autenticação no Oficina Gestão.\n\n" +
                    "Seu código de verificação é:\n\n" +
                    code + "\n\n" +
                    "Este código é válido por 5 minutos e pode ser utilizado apenas uma vez.\n\n" +
                    "Se você não realizou esta tentativa de acesso, ignore este e-mail.\n\n" +
                    "Oficina Gestão"
            );
            mailSender.send(message);
            log.info("E-mail com código de verificação 2FA enviado com sucesso para [{}]", to);
        } catch (Exception e) {
            log.error("Falha ao enviar e-mail de verificação 2FA para [{}]: {}", to, e.getMessage());
            throw new RuntimeException("Falha no envio do e-mail de autenticação.", e);
        }
    }

    private boolean isHostMissing(JavaMailSender sender) {
        if (sender instanceof org.springframework.mail.javamail.JavaMailSenderImpl impl) {
            return impl.getHost() == null || impl.getHost().isBlank();
        }
        return false;
    }
}
