package com.oficinagestao.service;

import com.oficinagestao.dto.CompletePasswordRecoveryRequest;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.RateLimitException;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.IpAddressResolver;
import com.oficinagestao.security.PasswordPolicyValidator;
import com.oficinagestao.security.SharedRateLimitService;
import com.oficinagestao.security.TokenHashUtil;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.annotation.PostConstruct;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class PasswordRecoveryService {
    private record Reset(long id, long userId, OffsetDateTime expiresAt,
                         OffsetDateTime usedAt, OffsetDateTime revokedAt) { }
    private final JdbcTemplate jdbc;
    private final UsuarioRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final TwoFactorChallengeRepository challenges;
    private final PasswordEncoder passwords;
    private final SharedRateLimitService limits;
    private final IpAddressResolver addresses;
    private final InviteOutbox outbox;
    private final SecureRandom random = new SecureRandom();
    @Value("${security.password-recovery.expiration-minutes:30}")
    private int expiryMinutes;

    public PasswordRecoveryService(JdbcTemplate jdbc, UsuarioRepository users,
                                   RefreshTokenRepository refreshTokens,
                                   TwoFactorChallengeRepository challenges,
                                   PasswordEncoder passwords, SharedRateLimitService limits,
                                   IpAddressResolver addresses, InviteOutbox outbox) {
        this.jdbc = jdbc;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.challenges = challenges;
        this.passwords = passwords;
        this.limits = limits;
        this.addresses = addresses;
        this.outbox = outbox;
    }

    @PostConstruct
    void validateConfiguration() {
        if (expiryMinutes < 5 || expiryMinutes > 60) throw new IllegalStateException(
                "PASSWORD_RECOVERY_EXPIRATION_MINUTES deve estar entre 5 e 60.");
    }

    /** Always returns the same HTTP response, including for unknown or inactive addresses. */
    @Transactional
    public void request(String suppliedEmail, HttpServletRequest http) {
        String email = suppliedEmail.trim().toLowerCase(Locale.ROOT);
        String ip = addresses.extrairIp(http);
        if (!limits.consume("password-recovery-ip", ip, 10, Duration.ofMinutes(15)).allowed()
                || !limits.consume("password-recovery-email", email, 3, Duration.ofHours(1)).allowed()) return;
        Usuario user = users.findByEmailForUpdate(email).orElse(null);
        if (user == null || !Boolean.TRUE.equals(user.getAtivo())) return;
        jdbc.update("UPDATE password_reset_requests SET revogado_em=now() WHERE usuario_id=? "
                + "AND usado_em IS NULL AND revogado_em IS NULL", user.getId());
        jdbc.update("UPDATE password_reset_outbox o SET status='CANCELLED',nonce=NULL,ciphertext=NULL,"
                + "last_failure='REISSUED' FROM password_reset_requests r WHERE r.id=o.reset_id "
                + "AND r.usuario_id=? AND o.status='PENDING'", user.getId());
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Long resetId = jdbc.queryForObject("INSERT INTO password_reset_requests(usuario_id,token_hash,expira_em) "
                + "VALUES (?,?,now()+(? * interval '1 minute')) RETURNING id", Long.class,
                user.getId(), TokenHashUtil.hashStatic(token), expiryMinutes);
        outbox.enqueueRecovery(resetId, token);
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,detalhes) VALUES (?,?,?)",
                user.getId(), "RECUPERACAO_SOLICITADA", "Solicitação id=" + resetId);
    }

    @Transactional
    public void complete(CompletePasswordRecoveryRequest request, HttpServletRequest http) {
        if (!limits.consume("password-recovery-complete", addresses.extrairIp(http), 10,
                Duration.ofMinutes(15)).allowed()) throw new RateLimitException(900);
        if (!request.token().matches("[A-Za-z0-9_-]{43}")) throw invalid();
        PasswordPolicyValidator.validar(request.senha());
        if (!request.senha().equals(request.confirmacao()))
            throw new BusinessException("A confirmação da senha não corresponde.");
        String hash = TokenHashUtil.hashStatic(request.token());
        List<Long> ids = jdbc.queryForList("SELECT usuario_id FROM password_reset_requests WHERE token_hash=?",
                Long.class, hash);
        if (ids.size() != 1) throw invalid();
        Usuario user = users.findByIdForUpdate(ids.getFirst()).orElseThrow(PasswordRecoveryService::invalid);
        List<Reset> matches = jdbc.query("SELECT id,usuario_id,expira_em,usado_em,revogado_em "
                + "FROM password_reset_requests WHERE token_hash=? FOR UPDATE", (rs, row) -> new Reset(
                rs.getLong("id"), rs.getLong("usuario_id"), rs.getObject("expira_em", OffsetDateTime.class),
                rs.getObject("usado_em", OffsetDateTime.class), rs.getObject("revogado_em", OffsetDateTime.class)), hash);
        if (matches.size() != 1) throw invalid();
        Reset reset = matches.getFirst();
        if (!user.getId().equals(reset.userId()) || !Boolean.TRUE.equals(user.getAtivo())
                || reset.usedAt() != null || reset.revokedAt() != null
                || !reset.expiresAt().isAfter(OffsetDateTime.now())) throw invalid();
        user.setSenha(passwords.encode(request.senha()));
        user.incrementTokenVersion();
        users.saveAndFlush(user);
        refreshTokens.revokeAllByUsuarioId(user.getId());
        challenges.revokeAllActiveByUsuarioId(user.getId());
        jdbc.update("UPDATE password_reset_requests SET usado_em=now() WHERE id=?", reset.id());
        jdbc.update("UPDATE password_reset_requests SET revogado_em=now() WHERE usuario_id=? "
                + "AND id<>? AND usado_em IS NULL AND revogado_em IS NULL", user.getId(), reset.id());
        jdbc.update("UPDATE password_reset_outbox o SET status='CANCELLED',nonce=NULL,ciphertext=NULL,"
                + "last_failure='USED' FROM password_reset_requests r WHERE r.id=o.reset_id "
                + "AND r.usuario_id=? AND o.status='PENDING'", user.getId());
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,detalhes) VALUES (?,?,?)",
                user.getId(), "SENHA_RECUPERADA", "Recuperação id=" + reset.id());
    }

    private static BusinessException invalid() {
        return new BusinessException("Link de recuperação inválido ou expirado.");
    }
}
