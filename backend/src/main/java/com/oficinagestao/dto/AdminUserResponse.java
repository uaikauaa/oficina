package com.oficinagestao.dto;

import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import java.util.Set;
import java.util.stream.Collectors;

public record AdminUserResponse(Long id, String nome, String email, boolean ativo, Set<String> roles,
                                Set<String> permissoes) {
    public static AdminUserResponse from(Usuario user) {
        return new AdminUserResponse(user.getId(), user.getNome(), user.getEmail(),
                Boolean.TRUE.equals(user.getAtivo()),
                user.getRoles().stream().map(Role::getNome).collect(Collectors.toSet()),
                user.getRoles().stream().flatMap(r -> r.getPermissoes().stream())
                        .map(p -> p.getCodigo()).collect(Collectors.toSet()));
    }
}
