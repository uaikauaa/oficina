package com.oficinagestao.security;

import com.oficinagestao.exception.BusinessException;

import java.util.Set;

/**
 * Validador centralizado de política de senhas (PSQ-SaaS-001 / FASE 4.2).
 * Reutilizado no bootstrap administrativo e no endpoint de alteração de senha.
 */
public final class PasswordPolicyValidator {

    public static final int MIN_LENGTH = 12;

    private static final Set<String> SENHAS_OBVIAS = Set.of(
            "admin",
            "admin123",
            "administrador",
            "password",
            "password123",
            "123456",
            "12345678",
            "123456789",
            "1234567890",
            "senha",
            "senha123",
            "qwerty",
            "oficina",
            "oficina123",
            "mudar123",
            "trocar123",
            "root",
            "master",
            "teste",
            "teste123"
    );

    private PasswordPolicyValidator() {
    }

    /**
     * Valida a senha contra as diretrizes de segurança do PSQ-SaaS-001:
     * 1. Não nula e não em branco;
     * 2. Mínimo de 12 caracteres;
     * 3. Pelo menos uma letra;
     * 4. Pelo menos um número;
     * 5. Pelo menos um caractere especial;
     * 6. Não pertencer à lista de senhas fracas/óbvias.
     *
     * @param senha Senha em texto plano a ser validada
     * @throws BusinessException Se a senha violar qualquer regra da política
     */
    public static void validar(String senha) {
        if (senha == null || senha.isBlank()) {
            throw new BusinessException("A senha é obrigatória.");
        }

        if (senha.length() < MIN_LENGTH) {
            throw new BusinessException("A senha deve conter no mínimo " + MIN_LENGTH + " caracteres.");
        }

        if (!senha.matches(".*[a-zA-Z].*")) {
            throw new BusinessException("A senha deve conter pelo menos uma letra.");
        }

        if (!senha.matches(".*[0-9].*")) {
            throw new BusinessException("A senha deve conter pelo menos um número.");
        }

        if (!senha.matches(".*[!@#$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>\\/?~`].*")) {
            throw new BusinessException("A senha deve conter pelo menos um caractere especial.");
        }

        String senhaNormalizada = senha.trim().toLowerCase();
        if (SENHAS_OBVIAS.contains(senhaNormalizada)) {
            throw new BusinessException("A senha informada é muito comum ou óbvia. Escolha uma senha mais segura.");
        }
    }
}
