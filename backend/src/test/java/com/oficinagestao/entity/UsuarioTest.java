package com.oficinagestao.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class UsuarioTest {

    @Test
    @DisplayName("BUG-007: Duas instâncias transientes com id nulo não devem ser consideradas iguais")
    void instanciasComIdNuloNaoDevemSerIguais() {
        Usuario u1 = new Usuario("Usuario 1", "u1@email.com", "senha123", true);
        Usuario u2 = new Usuario("Usuario 2", "u2@email.com", "senha123", true);

        assertNull(u1.getId());
        assertNull(u2.getId());
        assertNotEquals(u1, u2);
    }

    @Test
    @DisplayName("BUG-007: Uma instância deve ser igual a si mesma (reflexividade)")
    void instanciaDeveSerIgualASiMesma() {
        Usuario u = new Usuario("Usuario", "u@email.com", "senha123", true);
        assertEquals(u, u);
        assertEquals(u.hashCode(), u.hashCode());
    }

    @Test
    @DisplayName("BUG-007: Duas instâncias com o mesmo id persistido devem ser iguais")
    void instanciasComMesmoIdDevemSerIguais() {
        Usuario u1 = new Usuario();
        u1.setId(10L);
        Usuario u2 = new Usuario();
        u2.setId(10L);

        assertEquals(u1, u2);
        assertEquals(u1.hashCode(), u2.hashCode());
    }

    @Test
    @DisplayName("BUG-007: Instâncias com ids diferentes não devem ser iguais")
    void instanciasComIdsDiferentesNaoDevemSerIguais() {
        Usuario u1 = new Usuario();
        u1.setId(10L);
        Usuario u2 = new Usuario();
        u2.setId(20L);

        assertNotEquals(u1, u2);
    }
}
