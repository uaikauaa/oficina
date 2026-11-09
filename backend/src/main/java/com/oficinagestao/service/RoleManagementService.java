package com.oficinagestao.service;

import com.oficinagestao.dto.AdminChangeRequest;
import com.oficinagestao.dto.RoleChangeRequest;
import com.oficinagestao.dto.RoleResponse;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.RoleRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class RoleManagementService {
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final AdminUserService admin;
    private final JdbcTemplate jdbc;

    public RoleManagementService(RoleRepository roles, RefreshTokenRepository refreshTokens,
                                 AdminUserService admin, JdbcTemplate jdbc) {
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.admin = admin;
        this.jdbc = jdbc;
    }

    @Transactional(readOnly = true)
    public List<RoleResponse> list() {
        return roles.findAll().stream().map(RoleResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<String> permissions() {
        return jdbc.queryForList("SELECT codigo FROM permissoes ORDER BY codigo", String.class);
    }

    @Transactional
    public RoleResponse create(RoleChangeRequest request) {
        Usuario actor = verify(request);
        String name = normalize(request.nome());
        if (roles.existsByNome(name)) throw new ConflictException("Papel já existe.");
        Long id = jdbc.queryForObject("INSERT INTO roles(nome,descricao) VALUES (?,?) RETURNING id", Long.class,
                name, request.descricao().trim());
        grant(id, request.permissoes());
        event(actor, id, "PAPEL_CRIADO", request.motivo());
        return new RoleResponse(id, name, request.descricao().trim(), request.permissoes(), true);
    }

    @Transactional
    public RoleResponse update(Long id, RoleChangeRequest request) {
        Usuario actor = verify(request);
        String name = normalize(request.nome());
        List<String> existing = jdbc.queryForList("SELECT nome FROM roles WHERE id=? FOR UPDATE", String.class, id);
        if (existing.size() != 1 || !existing.getFirst().startsWith("ROLE_CUSTOM_"))
            throw new BusinessException("Apenas papéis personalizados podem ser editados aqui.");
        if (!existing.getFirst().equals(name)) throw new BusinessException("O identificador do papel não pode mudar.");
        jdbc.update("UPDATE roles SET descricao=? WHERE id=?", request.descricao().trim(), id);
        jdbc.update("DELETE FROM role_permissoes WHERE role_id=?", id);
        grant(id, request.permissoes());
        List<Long> affected = jdbc.queryForList("SELECT usuario_id FROM usuario_roles WHERE role_id=?", Long.class, id);
        jdbc.update("UPDATE usuarios SET token_version=token_version+1 WHERE id IN "
                + "(SELECT usuario_id FROM usuario_roles WHERE role_id=?)", id);
        affected.forEach(refreshTokens::revokeAllByUsuarioId);
        event(actor, id, "PAPEL_EDITADO", request.motivo());
        return new RoleResponse(id, name, request.descricao().trim(), request.permissoes(), true);
    }

    private Usuario verify(RoleChangeRequest request) {
        return admin.requireActor(new AdminChangeRequest(request.motivo(), request.senhaAtual(),
                request.confirmacao(), null, null), "GERENCIAR_PAPEL");
    }

    private String normalize(String name) {
        String normalized = name.trim().toUpperCase(Locale.ROOT);
        if (!normalized.matches("ROLE_CUSTOM_[A-Z0-9_]{3,30}"))
            throw new BusinessException("O nome deve começar com ROLE_CUSTOM_ e conter de 3 a 30 letras, números ou _.");
        return normalized;
    }

    private void grant(Long roleId, Set<String> requested) {
        for (String code : requested) {
            int count = jdbc.update("INSERT INTO role_permissoes(role_id,permissao_id) "
                    + "SELECT ?,id FROM permissoes WHERE codigo=?", roleId, code);
            if (count != 1) throw new BusinessException("Permissão desconhecida.");
        }
    }

    private void event(Usuario actor, Long roleId, String action, String reason) {
        jdbc.update("INSERT INTO eventos_administrativos(ator_id,acao,motivo,detalhes) VALUES (?,?,?,?)",
                actor.getId(), action, reason.trim(), "Papel id=" + roleId);
    }
}
