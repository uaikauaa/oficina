package com.oficinagestao.service;

import com.oficinagestao.dto.CategoriaCreateDTO;
import com.oficinagestao.dto.CategoriaResponseDTO;
import com.oficinagestao.dto.CategoriaUpdateDTO;
import com.oficinagestao.entity.Categoria;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.CategoriaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CategoriaServiceTest {

    @Mock
    private CategoriaRepository categoriaRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private CategoriaService categoriaService;

    private Categoria categoria;

    @BeforeEach
    void setUp() {
        categoria = new Categoria("Eletrônica", "Componentes eletrônicos e módulos inversores");
        categoria.setId(1L);
        categoria.setAtivo(true);
    }

    @Test
    @DisplayName("Deve cadastrar categoria técnica com sucesso")
    void deveCadastrarCategoriaComSucesso() {
        CategoriaCreateDTO dto = new CategoriaCreateDTO("Máquina de Solda", "Peças e tochas para solda MIG/TIG");

        when(categoriaRepository.existsByNomeIgnoreCase("Máquina de Solda")).thenReturn(false);
        when(categoriaRepository.save(any(Categoria.class))).thenAnswer(i -> {
            Categoria c = i.getArgument(0);
            c.setId(2L);
            return c;
        });

        CategoriaResponseDTO response = categoriaService.cadastrar(dto, 1L, null);

        assertNotNull(response);
        assertEquals(2L, response.id());
        assertEquals("Máquina de Solda", response.nome());
        assertTrue(response.ativo());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Categoria"), eq("2"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve lançar ConflictException ao cadastrar categoria com nome duplicado")
    void deveLancarConflitoAoCadastrarNomeDuplicado() {
        CategoriaCreateDTO dto = new CategoriaCreateDTO("Eletrônica", "Descrição");

        when(categoriaRepository.existsByNomeIgnoreCase("Eletrônica")).thenReturn(true);

        assertThrows(ConflictException.class, () -> categoriaService.cadastrar(dto, 1L, null));
        verify(categoriaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve atualizar categoria com sucesso")
    void deveAtualizarCategoriaComSucesso() {
        CategoriaUpdateDTO dto = new CategoriaUpdateDTO("Eletrônica Industrial", "Nova descrição");

        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(categoriaRepository.existsByNomeIgnoreCaseAndIdNot("Eletrônica Industrial", 1L)).thenReturn(false);
        when(categoriaRepository.save(any(Categoria.class))).thenReturn(categoria);

        CategoriaResponseDTO response = categoriaService.atualizar(1L, dto, 1L, null);

        assertNotNull(response);
        assertEquals("Eletrônica Industrial", response.nome());
        assertEquals("Nova descrição", response.descricao());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Categoria"), eq("1"), eq("UPDATE"), any());
    }

    @Test
    @DisplayName("Deve lançar ConflictException ao atualizar para nome já utilizado por outra categoria")
    void deveLancarConflitoAoAtualizarNomeDuplicado() {
        CategoriaUpdateDTO dto = new CategoriaUpdateDTO("Gerador", "Descrição");

        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(categoriaRepository.existsByNomeIgnoreCaseAndIdNot("Gerador", 1L)).thenReturn(true);

        assertThrows(ConflictException.class, () -> categoriaService.atualizar(1L, dto, 1L, null));
        verify(categoriaRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve alterar status (inativar e ativar) da categoria")
    void deveAlterarStatusCategoria() {
        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));
        when(categoriaRepository.save(any(Categoria.class))).thenReturn(categoria);

        CategoriaResponseDTO response = categoriaService.alterarStatus(1L, false, 1L, null);

        assertNotNull(response);
        assertFalse(response.ativo());
        verify(auditoriaService).registrarComRequest(eq(1L), eq("Categoria"), eq("1"), eq("UPDATE"), any());
    }

    @Test
    @DisplayName("Deve listar categorias ativas")
    void deveListarCategoriasAtivas() {
        when(categoriaRepository.findByAtivoTrueOrderByNomeAsc()).thenReturn(List.of(categoria));

        List<CategoriaResponseDTO> ativas = categoriaService.listarAtivas();

        assertFalse(ativas.isEmpty());
        assertEquals(1, ativas.size());
        assertEquals("Eletrônica", ativas.get(0).nome());
    }

    @Test
    @DisplayName("Deve buscar categoria por ID com sucesso")
    void deveBuscarPorIdComSucesso() {
        when(categoriaRepository.findById(1L)).thenReturn(Optional.of(categoria));

        CategoriaResponseDTO response = categoriaService.buscarPorId(1L);

        assertNotNull(response);
        assertEquals(1L, response.id());
        assertEquals("Eletrônica", response.nome());
    }

    @Test
    @DisplayName("Deve lançar ResourceNotFoundException ao buscar categoria inexistente")
    void deveLancarExcecaoAoBuscarInexistente() {
        when(categoriaRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> categoriaService.buscarPorId(999L));
    }
}
