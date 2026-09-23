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
                "Bruno Soldas",
                "45.076.507 BRUNO SOARES RODRIGUES",
                "45.076.507/0001-67",
                null,
                "Simples Nacional / MEI",
                "14.01.01",
                "Geisa",
                "(14) 9886-7223",
                "INDUTECSERVICE@HOTMAIL.COM",
                "Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim",
                "1538",
                "Vila Sandano",
                "19.914-080",
                "Ourinhos",
                "SP",
                "35.34708",
                OffsetDateTime.now(),
                OffsetDateTime.now()
        );
    }

    @Test
    @DisplayName("Deve retornar 200 OK com os dados da Bruno Soldas")
    void deveRetornarDadosDaOficinaComSucesso() {
        ConfiguracaoOficinaResponseDTO dto = criarDtoExemplo();
        when(configuracaoOficinaService.obter()).thenReturn(dto);

        ResponseEntity<ConfiguracaoOficinaResponseDTO> response = controller.obter();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Bruno Soldas", response.getBody().nomeFantasia());
        assertEquals("Geisa", response.getBody().responsavel());
        assertEquals("45.076.507/0001-67", response.getBody().cnpj());
        assertEquals("Ourinhos", response.getBody().municipio());
        assertEquals("SP", response.getBody().uf());
    }

    @Test
    @DisplayName("Deve atualizar os dados da oficina com sucesso")
    void deveAtualizarDadosDaOficina() {
        ConfiguracaoOficinaUpdateDTO updateDto = new ConfiguracaoOficinaUpdateDTO(
                "Bruno Soldas",
                "45.076.507 BRUNO SOARES RODRIGUES",
                "45.076.507/0001-67",
                null,
                "Simples Nacional / MEI",
                "14.01.01",
                "Geisa",
                "(14) 9886-7223",
                "INDUTECSERVICE@HOTMAIL.COM",
                "Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim",
                "1538",
                "Vila Sandano",
                "19.914-080",
                "Ourinhos",
                "SP",
                "35.34708"
        );

        ConfiguracaoOficinaResponseDTO responseDto = criarDtoExemplo();
        when(configuracaoOficinaService.atualizar(updateDto)).thenReturn(responseDto);

        ResponseEntity<ConfiguracaoOficinaResponseDTO> response = controller.atualizar(updateDto);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("Bruno Soldas", response.getBody().nomeFantasia());
        verify(configuracaoOficinaService, times(1)).atualizar(updateDto);
    }
}
