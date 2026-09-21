package com.oficinagestao.security;

import com.oficinagestao.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import static org.junit.jupiter.api.Assertions.*;

class PasswordPolicyValidatorTest {

    @Test
    @DisplayName("Deve aceitar senha que cumpre todos os requisitos de segurança")
    void shouldAcceptValidPassword() {
        assertDoesNotThrow(() -> PasswordPolicyValidator.validar("MinhaOficina#2026"));
        assertDoesNotThrow(() -> PasswordPolicyValidator.validar("Soldas@Gerador_99"));
        assertDoesNotThrow(() -> PasswordPolicyValidator.validar("Forte!Segura12345"));
    }

    @Test
    @DisplayName("Deve rejeitar senha nula ou em branco")
    void shouldRejectNullOrBlankPassword() {
        BusinessException ex1 = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar(null));
        assertEquals("A senha é obrigatória.", ex1.getMessage());

        BusinessException ex2 = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar("   "));
        assertEquals("A senha é obrigatória.", ex2.getMessage());
    }

    @ParameterizedTest
    @ValueSource(strings = {"Curta@1", "123456789!a", "Abc#1234567"})
    @DisplayName("Deve rejeitar senha com menos de 12 caracteres")
    void shouldRejectPasswordShorterThan12Characters(String senhaCurta) {
        BusinessException ex = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar(senhaCurta));
        assertTrue(ex.getMessage().contains("no mínimo 12 caracteres"));
    }

    @Test
    @DisplayName("Deve rejeitar senha sem nenhuma letra")
    void shouldRejectPasswordWithoutLetter() {
        BusinessException ex = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar("123456789012!@#"));
        assertEquals("A senha deve conter pelo menos uma letra.", ex.getMessage());
    }

    @Test
    @DisplayName("Deve rejeitar senha sem nenhum número")
    void shouldRejectPasswordWithoutNumber() {
        BusinessException ex = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar("SenhaSemNumeroSpecial!"));
        assertEquals("A senha deve conter pelo menos um número.", ex.getMessage());
    }

    @Test
    @DisplayName("Deve rejeitar senha sem nenhum caractere especial")
    void shouldRejectPasswordWithoutSpecialCharacter() {
        BusinessException ex = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar("SenhaSemCaractereEspecial123"));
        assertEquals("A senha deve conter pelo menos um caractere especial.", ex.getMessage());
    }

    @ParameterizedTest
    @ValueSource(strings = {"admin", "admin123", "password", "123456", "12345678", "senha", "qwerty", "oficina123"})
    @DisplayName("Deve rejeitar senhas conhecidas e obviamente fracas")
    void shouldRejectObviousWeakPasswords(String senhaFraca) {
        BusinessException ex = assertThrows(BusinessException.class, () -> PasswordPolicyValidator.validar(senhaFraca));
        assertNotNull(ex.getMessage());
    }
}
