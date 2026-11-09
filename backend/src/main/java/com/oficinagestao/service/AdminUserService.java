package com.oficinagestao.service;

import com.oficinagestao.dto.AdminChangeRequest;
import com.oficinagestao.dto.AdminUserResponse;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.RoleRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.SecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.Set;

@Service
public class AdminUserService {
    private final UsuarioRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwords;
    private final JdbcTemplate jdbc;

    public AdminUserService(UsuarioRepository users, RoleRepository roles,
                            RefreshTokenRepository refreshTokens, PasswordEncoder passwords, JdbcTemplate jdbc) {
        this.users = users;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.passwords = passwords;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public Page<AdminUserResponse> list(String search, Boolean ativo, String role, int page, int size) {
        String normalized = search == null || search.isBlank() ? null : search.trim();
        String roleFilter = role == null || role.isBlank() ? null : role.trim();
        return users.searchAdmin(normalized, ativo, roleFilter,
                        PageRequest.of(Math.max(0, page), Math.max(1, Math.min(size, 100))))
                .map(AdminUserResponse::from);
    }

    @Transactional
    public AdminUserResponse changeStatus(Long id, AdminChangeRequest request) {
        if (request.ativo() == null || request.roles() != null) throw new IllegalArgumentException("Estado inválido");
        Usuario actor = requireActor(request, "ALTERAR_STATUS");
        Usuario target = requireTarget(id, actor);
        if (!request.ativo()) protectLastSuperAdmin(target);
        target.setAtivo(request.ativo());
        invalidate(target);
        event(actor, target, "STATUS", request.motivo(), "ativo=" + request.ativo());
        return AdminUserResponse.from(target);
    }

    @Transactional
    public AdminUserResponse changeRoles(Long id, AdminChangeRequest request) {
        if (request.roles() == null || request.roles().isEmpty() || request.ativo() != null)
            throw new IllegalArgumentException("Papéis inválidos");
        Usuario actor = requireActor(request, "ALTERAR_PAPEIS");
        Usuario target = requireTarget(id, actor);
        Set<Role> next = new HashSet<>();
        for (String name : request.roles()) {
            next.add(roles.findByNome(name).orElseThrow(() -> new IllegalArgumentException("Papel desconhecido")));
        }
        if (!next.stream().anyMatch(r -> "ROLE_SUPER_ADMIN".equals(r.getNome()))) protectLastSuperAdmin(target);
        String before = target.getRoles().stream().map(Role::getNome).sorted().toList().toString();
        target.setRoles(next);
        invalidate(target);
        event(actor, target, "PAPEIS", request.motivo(), before + " -> "
                + next.stream().map(Role::getNome).sorted().toList());
        return AdminUserResponse.from(target);
    }

    @Transactional
    public void revokeSessions(Long id, AdminChangeRequest request) {
        if (request.ativo() != null || request.roles() != null) throw new IllegalArgumentException("Dados inválidos");
        Usuario actor = requireActor(request, "REVOGAR_SESSOES");
        Usuario target = requireTarget(id, actor);
        invalidate(target);
        event(actor, target, "SESSOES", request.motivo(), "refresh revogado e versão incrementada");
    }

    Usuario requireActor(AdminChangeRequest request, String confirmation) {
        Long actorId = SecurityUtils.getCurrentUserId();
        if (actorId == null || !confirmation.equals(request.confirmacao()))
            throw new AccessDeniedException("Confirmação administrativa inválida");
        Usuario actor = users.findByIdForUpdate(actorId)
                .orElseThrow(() -> new AccessDeniedException("Sessão inválida"));
        if (!Boolean.TRUE.equals(actor.getAtivo()) || actor.getRoles().stream()
                .noneMatch(r -> "ROLE_SUPER_ADMIN".equals(r.getNome()))
                || !passwords.matches(request.senhaAtual(), actor.getSenha()))
            throw new AccessDeniedException("Reautenticação administrativa inválida");
        return actor;
    }

    private Usuario requireTarget(Long id, Usuario actor) {
        if (id.equals(actor.getId())) throw new AccessDeniedException("Alteração da própria conta proibida");
        return users.findByIdForUpdate(id).orElseThrow(() -> new IllegalArgumentException("Usuário não encontrado"));
    }

    private void protectLastSuperAdmin(Usuario target) {
        if (target.getRoles().stream().noneMatch(r -> "ROLE_SUPER_ADMIN".equals(r.getNome()))) return;
        // Serialize concurrent privilege changes across different target rows.
        jdbc.queryForObject("SELECT pg_advisory_xact_lock(90221025)", Object.class);
        Long count = jdbc.queryForObject("SELECT COUNT(DISTINCT u.id) FROM usuarios u "
                + "JOIN usuario_roles ur ON ur.usuario_id=u.id JOIN roles r ON r.id=ur.role_id "
                + "WHERE u.ativo=true AND r.nome='ROLE_SUPER_ADMIN'", Long.class);
        if (count == null || count <= 1) throw new AccessDeniedException("Último SUPER_ADMIN protegido");
    }

    private void invalidate(Usuario target) {
        target.incrementTokenVersion();
        users.save(target);
        refreshTokens.revokeAllByUsuarioId(target.getId());
    }

    private void event(Usuario actor, Usuario target, String action, String reason, String detail) {
        jdbc.update("INSERT INTO eventos_administrativos(ator_id, alvo_usuario_id, acao, motivo, detalhes) "
                + "VALUES (?, ?, ?, ?, ?)", actor.getId(), target.getId(), action, reason.trim(), detail);
    }
}
