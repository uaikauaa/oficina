package com.oficinagestao.service;

import com.oficinagestao.dto.AcceptInviteRequest;
import com.oficinagestao.dto.AdminChangeRequest;
import com.oficinagestao.dto.CreateInviteRequest;
import com.oficinagestao.dto.BootstrapSuperAdminRequest;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.RateLimitException;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.IpAddressResolver;
import com.oficinagestao.security.PasswordPolicyValidator;
import com.oficinagestao.security.SharedRateLimitService;
import com.oficinagestao.security.TokenHashUtil;
import com.oficinagestao.security.SecurityUtils;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Locale;

@Service
public class InviteService {
    private record Invite(Long id, String email, Long roleId, Long creatorId,
                          OffsetDateTime expiresAt, OffsetDateTime usedAt, OffsetDateTime revokedAt) {}
    private final JdbcTemplate jdbc;
    private final UsuarioRepository users;
    private final RoleRepository roles;
    private final AdminUserService admin;
    private final PasswordEncoder passwords;
    private final InviteOutbox outbox;
    private final SharedRateLimitService limits;
    private final IpAddressResolver addresses;
    private final String bootstrapEmail;
    private final SecureRandom random = new SecureRandom();

    public InviteService(JdbcTemplate jdbc, UsuarioRepository users, RoleRepository roles,
                         AdminUserService admin, PasswordEncoder passwords, InviteOutbox outbox,
                         SharedRateLimitService limits, IpAddressResolver addresses,
                         @Value("${app.public-url}") String publicUrl,
                         @Value("${security.super-admin-bootstrap.email:}") String bootstrapEmail,
                         Environment environment) {
        this.jdbc = jdbc;
        this.users = users;
        this.roles = roles;
        this.admin = admin;
        this.passwords = passwords;
        this.outbox = outbox;
        this.limits = limits;
        this.addresses = addresses;
        String validatedPublicUrl = validatePublicUrl(publicUrl);
        this.bootstrapEmail = bootstrapEmail == null ? "" : bootstrapEmail.trim().toLowerCase(Locale.ROOT);
        if (environment.acceptsProfiles(Profiles.of("prod", "production"))
                && (validatedPublicUrl.startsWith("http://") || validatedPublicUrl.contains("localhost")
                    || validatedPublicUrl.contains("127.0.0.1"))) {
            throw new IllegalStateException("APP_PUBLIC_URL pública HTTPS obrigatória em produção");
        }
    }

    @Transactional
    public void create(CreateInviteRequest request) {
        Usuario actor = admin.requireActor(new AdminChangeRequest(request.motivo(), request.senhaAtual(),
                request.confirmacao(), null, null), "CRIAR_CONVITE");
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        Role role = roles.findByNome(request.role()).orElseThrow(() -> new BusinessException("Papel inexistente."));
        // The role is selected by an authenticated SUPER_ADMIN, never by a public request.
        issue(actor, email, role, request.motivo());
    }

    /** One-time handoff from the existing operational ADMIN, enabled only for a fixed operator-approved email. */
    @Transactional
    public void bootstrapSuperAdmin(BootstrapSuperAdminRequest request) {
        if (!bootstrapEmail.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")
                || !"PROVISIONAR_SUPER_ADMIN".equals(request.confirmacao()))
            throw new AccessDeniedException("Provisionamento indisponível");
        Long actorId = SecurityUtils.getCurrentUserId();
        if (actorId == null) throw new AccessDeniedException("Sessão inválida");
        Usuario actor = users.findByIdForUpdate(actorId)
                .orElseThrow(() -> new AccessDeniedException("Sessão inválida"));
        if (!Boolean.TRUE.equals(actor.getAtivo()) || actor.getRoles().stream()
                .noneMatch(role -> "ROLE_ADMIN".equals(role.getNome()))
                || !passwords.matches(request.senhaAtual(), actor.getSenha()))
            throw new AccessDeniedException("Reautenticação inválida");
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(90221025)", Object.class);
        Long active = jdbc.queryForObject("SELECT COUNT(DISTINCT u.id) FROM usuarios u "
                + "JOIN usuario_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.role_id "
                + "WHERE u.ativo=true AND r.nome='ROLE_SUPER_ADMIN'", Long.class);
        if (active != null && active > 0) throw new ConflictException("SUPER_ADMIN já provisionado");
        Long pending = jdbc.queryForObject("SELECT count(*) FROM convites_usuarios c JOIN roles r ON r.id=c.role_id "
                + "WHERE r.nome='ROLE_SUPER_ADMIN' AND c.usado_em IS NULL AND c.revogado_em IS NULL "
                + "AND c.expira_em > now()", Long.class);
        if (pending != null && pending > 0) throw new ConflictException("Provisionamento pendente");
        Role role = roles.findByNome("ROLE_SUPER_ADMIN").orElseThrow();
        issue(actor, bootstrapEmail, role, request.motivo());
    }

    private void issue(Usuario actor, String email, Role role, String reason) {
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(hashtext(?))", Object.class, "invite:" + email);
        if (users.existsByEmail(email)) throw new ConflictException("Já existe uma conta para esse e-mail.");
        jdbc.update("UPDATE convites_usuarios SET revogado_em=now() WHERE lower(email)=? "
                + "AND usado_em IS NULL AND revogado_em IS NULL", email);
        jdbc.update("UPDATE invite_delivery_outbox o SET status='CANCELLED',nonce=NULL,ciphertext=NULL,"
                + "last_failure='REISSUED' FROM convites_usuarios c WHERE c.id=o.invite_id "
                + "AND lower(c.email)=? AND o.status='PENDING'", email);
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        String hash = TokenHashUtil.hashStatic(token);
        Long inviteId = jdbc.queryForObject("INSERT INTO convites_usuarios(email,token_hash,role_id,criado_por,expira_em) "
                + "VALUES (?,?,?,?,now()+interval '24 hours') RETURNING id", Long.class,
                email, hash, role.getId(), actor.getId());
        outbox.enqueue(inviteId, token);
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,motivo,detalhes) VALUES (?,?,?,?)",
                actor.getId(), "CONVITE_CRIADO", reason.trim(), "Convite para " + email + ", papel " + role.getNome());
    }

    @Transactional
    public void accept(AcceptInviteRequest request, HttpServletRequest httpRequest) {
        var decision = limits.consume("invite-accept", addresses.extrairIp(httpRequest), 10, Duration.ofMinutes(15));
        if (!decision.allowed()) throw new RateLimitException(decision.retryAfterSeconds());
        if (!request.token().matches("[A-Za-z0-9_-]{43}")) throw new BusinessException("Convite inválido ou expirado.");
        PasswordPolicyValidator.validar(request.senha());
        String hash = TokenHashUtil.hashStatic(request.token());
        List<Invite> matches = jdbc.query("SELECT id,email,role_id,criado_por,expira_em,usado_em,revogado_em "
                + "FROM convites_usuarios WHERE token_hash=? FOR UPDATE", (rs, row) ->
                new Invite(rs.getLong("id"), rs.getString("email"), rs.getLong("role_id"),
                        rs.getObject("criado_por", Long.class),
                        rs.getObject("expira_em", OffsetDateTime.class),
                        rs.getObject("usado_em", OffsetDateTime.class),
                        rs.getObject("revogado_em", OffsetDateTime.class)), hash);
        if (matches.size() != 1) throw new BusinessException("Convite inválido ou expirado.");
        Invite invite = matches.getFirst();
        if (invite.usedAt() != null || invite.revokedAt() != null
                || !invite.expiresAt().isAfter(OffsetDateTime.now()))
            throw new BusinessException("Convite inválido ou expirado.");
        String email = invite.email();
        if (users.existsByEmail(email)) throw new ConflictException("Convite indisponível.");
        Role role = roles.findById(invite.roleId()).orElseThrow(() -> new BusinessException("Convite indisponível."));
        Usuario user = new Usuario(request.nome().trim(), email, passwords.encode(request.senha()), true);
        user.addRole(role);
        users.saveAndFlush(user);
        jdbc.update("UPDATE convites_usuarios SET usado_em=now() WHERE id=?", invite.id());
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,alvo_usuario_id,acao,detalhes) "
                + "VALUES (?,?,?,?)", invite.creatorId(), user.getId(), "CONVITE_ACEITO", "Conta criada após confirmação de e-mail");
    }

    private static String validatePublicUrl(String value) {
        try {
            URI uri = URI.create(value);
            boolean local = "localhost".equals(uri.getHost()) || "127.0.0.1".equals(uri.getHost());
            if (!("https".equals(uri.getScheme()) || local && "http".equals(uri.getScheme()))
                    || uri.getUserInfo() != null || uri.getQuery() != null || uri.getFragment() != null
                    || uri.getHost() == null) throw new IllegalArgumentException();
            return value.replaceAll("/+$", "");
        } catch (RuntimeException e) {
            throw new IllegalStateException("APP_PUBLIC_URL inválida para envio de convites");
        }
    }
}
