package com.oficinagestao.dto;

import com.oficinagestao.entity.Role;
import java.util.Set;
import java.util.stream.Collectors;

public record RoleResponse(Long id, String nome, String descricao, Set<String> permissoes, boolean customizado) {
    public static RoleResponse from(Role role) {
        return new RoleResponse(role.getId(), role.getNome(), role.getDescricao(),
                role.getPermissoes().stream().map(p -> p.getCodigo()).collect(Collectors.toSet()),
                role.getNome().startsWith("ROLE_CUSTOM_"));
    }
}
