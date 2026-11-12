package com.oficinagestao.security;

import com.oficinagestao.controller.SessionController;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.service.AuthService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
class AccessTokenSessionBindingIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired JwtService jwt;
    @Autowired UsuarioRepository users;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired PasswordEncoder passwords;
    @Autowired SessionController sessions;
    @Autowired AuthService authService;

    private Usuario user;

    @AfterEach
    void cleanup() {
        if (user != null && user.getId() != null) {
            users.deleteById(user.getId());
        }
    }

    @Test
    void individualRevokeInvalidatesAccessImmediatelyAndKeepsOtherSessionAlive() throws Exception {
        user = users.saveAndFlush(new Usuario("Synthetic session binding",
                "session-binding-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode("SyntheticPassword1!"), true));

        String rawA = "session-binding-a-" + UUID.randomUUID();
        String rawB = "session-binding-b-" + UUID.randomUUID();
        UUID sessionA = UUID.randomUUID();
        UUID sessionB = UUID.randomUUID();
        persistToken(rawA, sessionA);
        persistToken(rawB, sessionB);

        String accessA = jwt.generateToken(user, sessionA);
        String accessB = jwt.generateToken(user, sessionB);
        assertEquals(sessionA, jwt.extractSessionId(accessA));
        assertEquals(sessionB, jwt.extractSessionId(accessB));

        requestMe(accessA, 200);
        requestMe(accessB, 200);

        sessions.revoke(sessionA, authentication(), rawB, new MockHttpServletResponse());

        requestMe(accessA, 401);
        requestMe(accessB, 200);
        assertThrows(Exception.class, () -> authService.refresh(rawA, new MockHttpServletRequest()));

        LoginResult rotatedB = authService.refresh(rawB, new MockHttpServletRequest());
        assertEquals(sessionB, jwt.extractSessionId(rotatedB.accessToken()));
        requestMe(rotatedB.accessToken(), 200);

        sessions.revokeAll(authentication(), new MockHttpServletResponse());
        requestMe(accessB, 401);
        requestMe(rotatedB.accessToken(), 401);
    }

    @Test
    void invalidSessionClaimCannotAuthenticateEvenWhenTokenVersionMatches() throws Exception {
        user = users.saveAndFlush(new Usuario("Synthetic invalid session",
                "session-invalid-" + UUID.randomUUID() + "@example.invalid",
                passwords.encode("SyntheticPassword1!"), true));
        String access = jwt.generateToken(user, UUID.randomUUID());
        requestMe(access, 401);
    }

    private void persistToken(String raw, UUID sessionId) {
        RefreshToken token = new RefreshToken(user, TokenHashUtil.hashStatic(raw),
                OffsetDateTime.now().plusDays(1), true);
        token.setSessionId(sessionId);
        refreshTokens.saveAndFlush(token);
    }

    private Authentication authentication() {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }

    private void requestMe(String token, int expected) throws Exception {
        mvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer " + token)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().is(expected));
    }
}
