package com.oficinagestao.controller;

import com.oficinagestao.security.TokenHashUtil;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import jakarta.servlet.http.HttpServletResponse;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth/sessoes")
public class SessionController {
    public record Session(UUID id, OffsetDateTime criadaEm, OffsetDateTime expiraEm,
                          boolean lembrar, boolean atual) { }
    private final JdbcTemplate jdbc;
    @Value("${security.cookie.secure:false}") private boolean cookieSecure;
    public SessionController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping
    public List<Session> list(Authentication authentication,
                              @CookieValue(name = "refresh_token", required = false) String cookie) {
        long userId = userId(authentication);
        UUID current = currentSession(userId, cookie);
        return jdbc.query("SELECT session_id,min(criado_em) AS criada_em,max(data_expiracao) AS expira_em,"
                + "bool_or(remember_me) AS lembrar FROM refresh_tokens WHERE usuario_id=? GROUP BY session_id "
                + "HAVING bool_or(revogado=false AND data_expiracao>now()) "
                + "ORDER BY min(criado_em) DESC,session_id", (rs, row) -> {
            UUID id = rs.getObject("session_id", UUID.class);
            return new Session(id, rs.getObject("criada_em", OffsetDateTime.class),
                    rs.getObject("expira_em", OffsetDateTime.class), rs.getBoolean("lembrar"),
                    id.equals(current));
        }, userId);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public void revoke(@PathVariable UUID id, Authentication authentication,
                       @CookieValue(name = "refresh_token", required = false) String cookie,
                       HttpServletResponse response) {
        long userId = userId(authentication);
        lockUser(userId);
        boolean current = id.equals(currentSession(userId, cookie));
        int changed = jdbc.update("UPDATE refresh_tokens SET revogado=true WHERE usuario_id=? AND session_id=? "
                + "AND revogado=false", userId, id);
        if (changed == 0) throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Sessão não encontrada.");
        audit(userId, "SESSAO_REVOGADA", "Sessão " + id);
        if (current) clearCookies(response);
    }

    @DeleteMapping("/outras")
    @Transactional
    public void revokeOthers(Authentication authentication,
                             @CookieValue(name = "refresh_token", required = false) String cookie) {
        long userId = userId(authentication);
        lockUser(userId);
        UUID current = currentSession(userId, cookie);
        if (current == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                "Sessão atual não identificável pelo cookie de renovação.");
        int changed = jdbc.update("UPDATE refresh_tokens SET revogado=true WHERE usuario_id=? "
                + "AND session_id<>? AND revogado=false", userId, current);
        audit(userId, "OUTRAS_SESSOES_REVOGADAS", "Tokens revogados=" + changed);
    }

    @DeleteMapping
    @Transactional
    public void revokeAll(Authentication authentication, HttpServletResponse response) {
        long userId = userId(authentication);
        lockUser(userId);
        int changed = jdbc.update("UPDATE refresh_tokens SET revogado=true WHERE usuario_id=? "
                + "AND revogado=false", userId);
        jdbc.update("UPDATE usuarios SET token_version=token_version+1 WHERE id=?", userId);
        audit(userId, "TODAS_SESSOES_REVOGADAS", "Tokens revogados=" + changed);
        clearCookies(response);
    }

    private long userId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null)
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        List<Long> ids = jdbc.queryForList("SELECT id FROM usuarios WHERE lower(email)=lower(?) AND ativo=true",
                Long.class, authentication.getName());
        if (ids.size() != 1) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        return ids.getFirst();
    }

    private UUID currentSession(long userId, String cookie) {
        if (cookie == null || cookie.isBlank()) return null;
        List<UUID> ids = jdbc.queryForList("SELECT session_id FROM refresh_tokens WHERE usuario_id=? "
                + "AND token_hash=? AND revogado=false AND data_expiracao>now()", UUID.class,
                userId, TokenHashUtil.hashStatic(cookie));
        return ids.size() == 1 ? ids.getFirst() : null;
    }

    private void lockUser(long userId) {
        jdbc.queryForObject("SELECT id FROM usuarios WHERE id=? FOR UPDATE", Long.class, userId);
    }

    private void audit(long userId, String action, String details) {
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,alvo_usuario_id,acao,detalhes) "
                + "VALUES (?,?,?,?)", userId, userId, action, details);
    }

    private void clearCookies(HttpServletResponse response) {
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("access_token", "")
                .httpOnly(true).secure(cookieSecure).path("/").sameSite("Lax").maxAge(0).build().toString());
        response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from("refresh_token", "")
                .httpOnly(true).secure(cookieSecure).path("/api/auth").sameSite("Strict")
                .maxAge(0).build().toString());
    }
}
