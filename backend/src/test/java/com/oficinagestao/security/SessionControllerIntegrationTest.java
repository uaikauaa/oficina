package com.oficinagestao.security;

import com.oficinagestao.controller.SessionController;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.mock.web.MockHttpServletResponse;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
@ActiveProfiles("test")
class SessionControllerIntegrationTest {
    @Autowired SessionController sessions;
    @Autowired UsuarioRepository users;
    @Autowired RefreshTokenRepository tokens;
    @Autowired PasswordEncoder passwords;
    Usuario a;
    Usuario b;

    private Usuario user() {
        return users.saveAndFlush(new Usuario("Synthetic session", "session-" + UUID.randomUUID()
                + "@example.invalid", passwords.encode("SyntheticPassword1!"), true));
    }
    private Authentication auth(Usuario user) {
        return new UsernamePasswordAuthenticationToken(user.getEmail(), null);
    }
    private RefreshToken token(Usuario user, String raw) {
        return tokens.saveAndFlush(new RefreshToken(user, TokenHashUtil.hashStatic(raw),
                OffsetDateTime.now().plusDays(1)));
    }
    @AfterEach void cleanup() {
        if (a != null) users.deleteById(a.getId());
        if (b != null) users.deleteById(b.getId());
    }

    @Test void realInventoryRotationAndOwnerIsolation() {
        a = user(); b = user();
        RefreshToken first = token(a, "session-first");
        RefreshToken other = token(a, "session-other");
        RefreshToken foreign = token(b, "session-foreign");
        first.revoke(); tokens.saveAndFlush(first);
        RefreshToken rotated = new RefreshToken(a, TokenHashUtil.hashStatic("session-rotated"),
                OffsetDateTime.now().plusDays(1));
        rotated.setSessionId(first.getSessionId()); tokens.saveAndFlush(rotated);
        var list = sessions.list(auth(a), "session-rotated");
        assertEquals(2, list.size());
        assertEquals(1, list.stream().filter(SessionController.Session::atual).count());
        assertTrue(list.stream().anyMatch(s -> s.id().equals(first.getSessionId()) && s.atual()));
        assertThrows(ResponseStatusException.class, () -> sessions.revoke(foreign.getSessionId(), auth(a),
                "session-rotated", new MockHttpServletResponse()));
        sessions.revoke(other.getSessionId(), auth(a), "session-rotated", new MockHttpServletResponse());
        assertEquals(1, sessions.list(auth(a), "session-rotated").size());
        sessions.revokeOthers(auth(a), "session-rotated");
        assertEquals(1, sessions.list(auth(a), "session-rotated").size());
        assertEquals(1, sessions.list(auth(b), "session-foreign").size());
    }

    @Test void revokeAllInvalidatesRenewalAndAccessVersion() {
        a = user();
        token(a, "session-to-close");
        int before = users.findById(a.getId()).orElseThrow().getTokenVersion();
        sessions.revokeAll(auth(a), new MockHttpServletResponse());
        assertTrue(sessions.list(auth(a), "session-to-close").isEmpty());
        assertEquals(before + 1, users.findById(a.getId()).orElseThrow().getTokenVersion());
    }
}
