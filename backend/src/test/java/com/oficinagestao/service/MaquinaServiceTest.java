package com.oficinagestao.service;

import com.oficinagestao.dto.MaquinaCreateDTO;
import com.oficinagestao.dto.MaquinaResponseDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MaquinaServiceTest {

    @Mock
    private MaquinaRepository maquinaRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private AuditoriaService auditoriaService;

    @InjectMocks
    private MaquinaService maquinaService;

    private Cliente cliente;

    @BeforeEach
    void setUp() {
        cliente = new Cliente();
        cliente.setId(1L);
        cliente.setNomeRazaoSocial("Cliente Teste");
    }

    @Test
    @DisplayName("BUG-006: Deve rejeitar criação de máquina com horímetro negativo")
    void deveRejeitarCriacaoComHorimetroNegativo() {
        MaquinaCreateDTO dto = new MaquinaCreateDTO(
                1L,
                TipoEquipamento.MAQUINA_SOLDA,
                "ESAB",
                "Smashweld 450",
                2022,
                "SN-12345",
                "-50.0",
                "450A",
                "380V",
                "Observação"
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(cliente));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                maquinaService.criar(dto, 1L, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("não pode ser negativo"));
    }

    @Test
    @DisplayName("BUG-006: Deve rejeitar criação de máquina com horímetro não numérico")
    void deveRejeitarCriacaoComHorimetroNaoNumerico() {
        MaquinaCreateDTO dto = new MaquinaCreateDTO(
                1L,
                TipoEquipamento.MAQUINA_SOLDA,
                "ESAB",
                "Smashweld 450",
                2022,
                "SN-12345",
                "abc-horas",
                "450A",
                "380V",
                "Observação"
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(cliente));

        BusinessException ex = assertThrows(BusinessException.class, () ->
                maquinaService.criar(dto, 1L, "127.0.0.1")
        );

        assertTrue(ex.getMessage().contains("inválido"));
    }

    @Test
    @DisplayName("BUG-006: Deve aceitar criação com horímetro positivo formatado com vírgula ou ponto")
    void deveAceitarCriacaoComHorimetroValido() {
        MaquinaCreateDTO dto = new MaquinaCreateDTO(
                1L,
                TipoEquipamento.MAQUINA_SOLDA,
                "ESAB",
                "Smashweld 450",
                2022,
                "SN-12345",
                "125,5",
                "450A",
                "380V",
                "Observação"
        );

        when(clienteRepository.findById(1L)).thenReturn(Optional.of(cliente));
        when(maquinaRepository.save(any(Maquina.class))).thenAnswer(inv -> {
            Maquina m = inv.getArgument(0);
            m.setId(10L);
            return m;
        });

        MaquinaResponseDTO response = maquinaService.criar(dto, 1L, "127.0.0.1");

        assertNotNull(response);
        assertEquals(0, BigDecimal.valueOf(125.5).compareTo(response.horimetro()));
    }

    @ParameterizedTest
    @ValueSource(strings = {"120,5", "120.5", "120 , 5", " 120.5 ", " 120 , 50 "})
    @DisplayName("BUG-002: Deve aceitar formatos válidos de horímetro com vírgula e espaços intercalados em Máquinas")
    void deveAceitarHorimetroValidoComEspacosEVirgulaEmMaquinas(String entrada) {
        BigDecimal resultado = MaquinaService.parseBigDecimal(entrada);
        assertNotNull(resultado);
        assertTrue(resultado.compareTo(BigDecimal.ZERO) >= 0);
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "-10", "12,3,4", "..", "1.2.3"})
    @DisplayName("BUG-002: Deve rejeitar estritamente formatos inválidos de horímetro em Máquinas")
    void deveRejeitarHorimetroInvalidoEmMaquinas(String entrada) {
        BusinessException ex = assertThrows(BusinessException.class, () ->
                MaquinaService.parseBigDecimal(entrada)
        );
        assertNotNull(ex.getMessage());
    }
}
