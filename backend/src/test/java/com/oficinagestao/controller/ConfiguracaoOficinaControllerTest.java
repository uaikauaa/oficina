package com.oficinagestao.controller;

import com.oficinagestao.dto.ConfiguracaoOficinaResponseDTO;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.service.ConfiguracaoOficinaService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.time.OffsetDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ConfiguracaoOficinaControllerTest {

    @Mock
    private ConfiguracaoOficinaService configuracaoOficinaService;

    @InjectMocks
    private ConfiguracaoOficinaController controller;

    private ConfiguracaoOficinaResponseDTO criarDtoExemplo() {
        return new ConfiguracaoOficinaResponseDTO(
                1L,
                "Oficina Gestão",
                "OFICINA LAB SINTETICA 02GA",
                "ENTIDADE FICTICIA DE TESTE 02GA",
                "CNPJ-SINTETICO",
                "RESPONSAVEL SINTETICO",
                "SEM-TELEFONE",
                "oficina@example.invalid",
                "VIA SINTETICA",
                "1538",
                "BAIRRO SINTETICO",
                "CEP-TESTE",
                "MUNICIPIO SINTETICO",
                "ZZ",
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }

    @Test
    @DisplayName("Deve retornar 200 OK com os dados da OFICINA LAB SINTETICA 02GA")
    void deveRetornarDadosDaOficinaComSucesso() {
        ConfiguracaoOficinaResponseDTO dto = criarDtoExemplo();
        when(configuracaoOficinaService.obter()).thenReturn(dto);

        ResponseEntity<ConfiguracaoOficinaResponseDTO> response = controller.obter();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("OFICINA LAB SINTETICA 02GA", response.getBody().nomeFantasia());
        assertEquals("RESPONSAVEL SINTETICO", response.getBody().responsavel());
        assertEquals("CNPJ-SINTETICO", response.getBody().cnpj());
        assertEquals("MUNICIPIO SINTETICO", response.getBody().municipio());
        assertEquals("ZZ", response.getBody().uf());
    }

    @Test
    @DisplayName("Deve atualizar os dados da oficina com sucesso")
    void deveAtualizarDadosDaOficina() {
        ConfiguracaoOficinaUpdateDTO updateDto = new ConfiguracaoOficinaUpdateDTO(
                "OFICINA LAB SINTETICA 02GA",
                "ENTIDADE FICTICIA DE TESTE 02GA",
                "CNPJ-SINTETICO",
                "RESPONSAVEL SINTETICO",
                "SEM-TELEFONE",
                "oficina@example.invalid",
                "VIA SINTETICA",
                "1538",
                "BAIRRO SINTETICO",
                "CEP-TESTE",
                "MUNICIPIO SINTETICO",
                "ZZ"
        );

        ConfiguracaoOficinaResponseDTO responseDto = criarDtoExemplo();
        when(configuracaoOficinaService.atualizar(updateDto)).thenReturn(responseDto);

        ResponseEntity<ConfiguracaoOficinaResponseDTO> response = controller.atualizar(updateDto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("OFICINA LAB SINTETICA 02GA", response.getBody().nomeFantasia());
        verify(configuracaoOficinaService, times(1)).atualizar(updateDto);
    }
}
