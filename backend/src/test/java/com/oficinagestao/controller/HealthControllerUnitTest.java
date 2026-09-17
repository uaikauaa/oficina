package com.oficinagestao.controller;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class HealthControllerUnitTest {

    @Mock
    private DataSource dataSource;

    @Mock
    private Connection connection;

    @InjectMocks
    private HealthController healthController;

    @Test
    @DisplayName("PROD001-06: Deve retornar 200 OK com status UP e database UP quando banco estiver saudável")
    void shouldReturnUpWhenDatabaseHealthy() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(true);

        ResponseEntity<Map<String, String>> response = healthController.health();

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("UP", response.getBody().get("status"));
        assertEquals("UP", response.getBody().get("database"));
    }

    @Test
    @DisplayName("PROD001-06: Deve retornar 503 SERVICE UNAVAILABLE com status DOWN quando conexão com banco falhar")
    void shouldReturnDownWhenDatabaseFails() throws SQLException {
        when(dataSource.getConnection()).thenThrow(new SQLException("Connection refused"));

        ResponseEntity<Map<String, String>> response = healthController.health();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DOWN", response.getBody().get("status"));
        assertEquals("DOWN", response.getBody().get("database"));
    }

    @Test
    @DisplayName("PROD001-06: Deve retornar 503 SERVICE UNAVAILABLE quando conexão responder isValid=false")
    void shouldReturnDownWhenConnectionInvalid() throws SQLException {
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.isValid(2)).thenReturn(false);

        ResponseEntity<Map<String, String>> response = healthController.health();

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals("DOWN", response.getBody().get("status"));
        assertEquals("DOWN", response.getBody().get("database"));
    }
}
