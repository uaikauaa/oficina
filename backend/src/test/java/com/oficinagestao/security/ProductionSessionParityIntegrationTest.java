package com.oficinagestao.security;

import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuthService;
import com.oficinagestao.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.ArgumentCaptor;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Production security properties with the mandatory isolated PostgreSQL guard. */
@SpringBootTest(properties = {
    "security.jwt.legacy-sessionless-allowed=false", "security.cookie.secure=true",
    "CORS_ALLOWED_ORIGINS=https://synthetic.example.invalid",
    "JWT_SECRET=stage4a-production-parity-synthetic-secret-2026",
    "MAIL_HOST=localhost", "MAIL_USERNAME=synthetic@example.invalid", "MAIL_PASSWORD=synthetic",
    "MAIL_SMTP_AUTH=true", "MAIL_SMTP_STARTTLS=true",
    "spring.mail.properties.mail.smtp.auth=true", "spring.mail.properties.mail.smtp.starttls.enable=true",
    "APP_PUBLIC_URL=https://synthetic.example.invalid"
})
@ActiveProfiles({"test", "prod"})
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
class ProductionSessionParityIntegrationTest {
    @Autowired AuthService auth;
    @Autowired JwtService jwt;
    @Autowired UsuarioRepository users;
    @Autowired PasswordEncoder passwords;
    @Autowired MockMvc mvc;
    @MockitoBean EmailService mail;

    @Test void loginRequiresTwoFactorThenRefreshKeepsPersistedSession() throws Exception {
        String password = "SyntheticStage4a#2026!";
        Usuario user = users.saveAndFlush(new Usuario("Synthetic parity", UUID.randomUUID()
                + "@example.invalid", passwords.encode(password), true));
        try {
            var http = new MockHttpServletRequest(); http.setRemoteAddr("192.0.2.221");
            var challenge = auth.login(new LoginRequest(user.getEmail(), password, true), http);
            assertTrue(challenge.twoFactorRequired());
            mvc.perform(get("/api/auth/me")).andExpect(status().isUnauthorized());
            var code = ArgumentCaptor.forClass(String.class);
            verify(mail).sendTwoFactorCode(eq(user.getEmail()), code.capture());
            var login = auth.verificarTwoFactor(new TwoFactorVerifyRequest(challenge.challengeToken(), code.getValue()), http);
            UUID session = jwt.extractSessionId(login.accessToken());
            assertNotNull(session);
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + login.accessToken()))
                    .andExpect(status().isOk());
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + jwt.generateToken(user)))
                    .andExpect(status().isUnauthorized());
            assertThrows(Exception.class, () -> auth.verificarTwoFactor(
                    new TwoFactorVerifyRequest(challenge.challengeToken(), code.getValue()), http));
            var rotated = auth.refresh(login.refreshToken(), http);
            assertEquals(session, jwt.extractSessionId(rotated.accessToken()));
            mvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + rotated.accessToken()))
                    .andExpect(status().isOk());
        } finally { users.deleteById(user.getId()); }
    }
}
