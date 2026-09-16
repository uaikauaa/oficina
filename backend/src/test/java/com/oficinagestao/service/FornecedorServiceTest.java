package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FornecedorServiceTest {

    @Mock
    private FornecedorRepository fornecedorRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private FornecedorService fornecedorService;

    private Fornecedor fornecedor;

    @BeforeEach
    void setUp() {
        fornecedor = new Fornecedor("Eletrônica Industrial LTDA", "Eletrônica ABC", "12345678000199", "3133334444", "contato@eletronica.com");
        fornecedor.setId(1L);
    }

    @Test
    @DisplayName("Deve cadastrar fornecedor com sucesso")
    void deveCadastrarFornecedorComSucesso() {
        FornecedorCreateDTO dto = new FornecedorCreateDTO(
                "Eletrônica Industrial LTDA",
                "Eletrônica ABC",
                "12.345.678/0001-99",
                "123456",
                "3133334444",
                "3199998888",
                "contato@eletronica.com",
                "Carlos",
                "Distribuidor autorizado de IGBTs"
        );

        when(fornecedorRepository.existsByCnpj("12345678000199")).thenReturn(false);
        when(fornecedorRepository.save(any(Fornecedor.class))).thenAnswer(i -> {
            Fornecedor f = i.getArgument(0);
            f.setId(1L);
            return f;
        });

        FornecedorResponseDTO response = fornecedorService.cadastrar(dto, 10L, null);

        assertNotNull(response);
        assertEquals("Eletrônica Industrial LTDA", response.razaoSocial());
        assertEquals("12345678000199", response.cnpj());
        assertTrue(response.ativo());
        verify(auditoriaService).registrarComRequest(eq(10L), eq("Fornecedor"), eq("1"), eq("INSERT"), any());
    }

    @Test
    @DisplayName("Deve rejeitar cadastro com CNPJ duplicado")
    void deveRejeitarCadastroComCnpjDuplicado() {
        FornecedorCreateDTO dto = new FornecedorCreateDTO(
                "Outra Eletrônica",
                null,
                "12.345.678/0001-99",
                null, null, null, null, null, null
        );

        when(fornecedorRepository.existsByCnpj("12345678000199")).thenReturn(true);

        BusinessException ex = assertThrows(BusinessException.class, () ->
                fornecedorService.cadastrar(dto, 10L, null)
        );

        assertTrue(ex.getMessage().contains("Já existe um fornecedor cadastrado com este CNPJ"));
        verify(fornecedorRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve atualizar fornecedor com sucesso")
    void deveAtualizarFornecedorComSucesso() {
        FornecedorUpdateDTO dto = new FornecedorUpdateDTO(
                "Eletrônica Industrial Nova Razão",
                "Nova ABC",
                "12.345.678/0001-99",
                "654321",
                "3133330000",
                "3199990000",
                "novo@eletronica.com",
                "Roberto",
                "Observação atualizada"
        );

        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(fornecedorRepository.existsByCnpjAndIdNot("12345678000199", 1L)).thenReturn(false);
        when(fornecedorRepository.save(any(Fornecedor.class))).thenReturn(fornecedor);

        FornecedorResponseDTO response = fornecedorService.atualizar(1L, dto, 10L, null);

        assertNotNull(response);
        assertEquals("Eletrônica Industrial Nova Razão", response.razaoSocial());
        verify(auditoriaService).registrarComRequest(eq(10L), eq("Fornecedor"), eq("1"), eq("UPDATE"), any());
    }

    @Test
    @DisplayName("Deve inativar fornecedor")
    void deveInativarFornecedor() {
        when(fornecedorRepository.findById(1L)).thenReturn(Optional.of(fornecedor));
        when(fornecedorRepository.save(any(Fornecedor.class))).thenReturn(fornecedor);

        FornecedorResponseDTO response = fornecedorService.alterarStatus(1L, false, 10L, null);

        assertNotNull(response);
        assertFalse(response.ativo());
        verify(auditoriaService).registrarComRequest(eq(10L), eq("Fornecedor"), eq("1"), eq("INATIVAR"), any());
    }

    @Test
    @DisplayName("Deve lançar 404 ao buscar fornecedor inexistente")
    void deveLancar404AoBuscarInexistente() {
        when(fornecedorRepository.findById(999L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> fornecedorService.buscarPorId(999L));
    }
}
