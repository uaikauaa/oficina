package com.oficinagestao.config;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.mail.MailSenderAutoConfiguration;
import org.springframework.boot.test.context.ConfigDataApplicationContextInitializer;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.core.env.Environment;
import org.springframework.util.PlaceholderResolutionException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Testes forenses obrigatórios para MED-02:
 * Remoção de defaults permissivos de autenticação SMTP e STARTTLS em produção.
 */
class ProductionSmtpConfigurationTest {

    private ApplicationContextRunner createRunner(String profile) {
        return new ApplicationContextRunner()
                .withInitializer(new ConfigDataApplicationContextInitializer())
                .withPropertyValues("spring.profiles.active=" + profile);
    }

    private ApplicationContextRunner createRunnerWithMailSender(String profile) {
        return createRunner(profile)
                .withConfiguration(AutoConfigurations.of(MailSenderAutoConfiguration.class));
    }

    @Test
    @DisplayName("1. Produção com MAIL_SMTP_AUTH=true e MAIL_SMTP_STARTTLS=true -> aceita e reflete true")
    void shouldAcceptProductionWithExplicitTrue() {
        createRunnerWithMailSender("prod")
                .withPropertyValues(
                        "MAIL_HOST=smtp.gmail.com",
                        "MAIL_USERNAME=teste@gmail.com",
                        "MAIL_PASSWORD=senha-app",
                        "MAIL_SMTP_AUTH=true",
                        "MAIL_SMTP_STARTTLS=true"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    Environment env = context.getEnvironment();
                    assertEquals("true", env.getProperty("spring.mail.properties.mail.smtp.auth"));
                    assertEquals("true", env.getProperty("spring.mail.properties.mail.smtp.starttls.enable"));
                });
    }

    @Test
    @DisplayName("2. Produção sem MAIL_SMTP_AUTH -> falha na resolução da propriedade e NÃO assume true")
    void shouldFailInProductionWhenMailSmtpAuthMissing() {
        createRunner("prod")
                .withPropertyValues(
                        "MAIL_HOST=smtp.gmail.com",
                        "MAIL_USERNAME=teste@gmail.com",
                        "MAIL_PASSWORD=senha-app",
                        "MAIL_SMTP_STARTTLS=true"
                )
                .run(context -> {
                    // Em produção, a ausência de MAIL_SMTP_AUTH NÃO assume true silenciosamente;
                    // Deve disparar falha explícita de resolução de placeholder.
                    assertThrows(PlaceholderResolutionException.class, () ->
                            context.getEnvironment().getProperty("spring.mail.properties.mail.smtp.auth")
                    );
                });
    }

    @Test
    @DisplayName("3. Produção sem MAIL_SMTP_STARTTLS -> falha na resolução da propriedade e NÃO assume true")
    void shouldFailInProductionWhenMailSmtpStarttlsMissing() {
        createRunner("prod")
                .withPropertyValues(
                        "MAIL_HOST=smtp.gmail.com",
                        "MAIL_USERNAME=teste@gmail.com",
                        "MAIL_PASSWORD=senha-app",
                        "MAIL_SMTP_AUTH=true"
                )
                .run(context -> {
                    // Em produção, a ausência de MAIL_SMTP_STARTTLS NÃO assume true silenciosamente;
                    // Deve disparar falha explícita de resolução de placeholder.
                    assertThrows(PlaceholderResolutionException.class, () ->
                            context.getEnvironment().getProperty("spring.mail.properties.mail.smtp.starttls.enable")
                    );
                });
    }

    @Test
    @DisplayName("4. Produção com MAIL_SMTP_AUTH=false e MAIL_SMTP_STARTTLS=false -> reflete explicitamente false")
    void shouldHonorExplicitFalseInProduction() {
        createRunnerWithMailSender("prod")
                .withPropertyValues(
                        "MAIL_HOST=smtp.custom.com",
                        "MAIL_USERNAME=custom@oficina.com",
                        "MAIL_PASSWORD=senha",
                        "MAIL_SMTP_AUTH=false",
                        "MAIL_SMTP_STARTTLS=false"
                )
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    Environment env = context.getEnvironment();
                    assertEquals("false", env.getProperty("spring.mail.properties.mail.smtp.auth"));
                    assertEquals("false", env.getProperty("spring.mail.properties.mail.smtp.starttls.enable"));
                });
    }

    @Test
    @DisplayName("5. Ambiente dev continua funcionando com defaults convenientes quando variáveis não fornecidas")
    void shouldMaintainConvenientDefaultsInDevelopment() {
        createRunner("dev")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    Environment env = context.getEnvironment();
                    assertEquals("true", env.getProperty("spring.mail.properties.mail.smtp.auth"));
                    assertEquals("true", env.getProperty("spring.mail.properties.mail.smtp.starttls.enable"));
                });
    }


}
