package com.oficinagestao.config;

import com.oficinagestao.service.AuthService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class RefreshTokenCleanupSchedulerTest {

    @Mock
    private AuthService authService;

    @InjectMocks
    private RefreshTokenCleanupScheduler scheduler;

    @Test
    @DisplayName("ISSUE-08: Deve invocar a purga de refresh tokens com sucesso")
    void shouldInvokePurgeSuccessfully() {
        when(authService.purgarTokensExpiradosOuRevogados()).thenReturn(15);

        scheduler.limparRefreshTokensExpirados();

        verify(authService, times(1)).purgarTokensExpiradosOuRevogados();
    }

    @Test
    @DisplayName("ISSUE-08: Deve tratar exceções de forma resiliente sem quebrar a execução")
    void shouldHandleExceptionGracefully() {
        when(authService.purgarTokensExpiradosOuRevogados()).thenThrow(new RuntimeException("Database error"));

        // Não deve propagar a exceção
        scheduler.limparRefreshTokensExpirados();

        verify(authService, times(1)).purgarTokensExpiradosOuRevogados();
    }
}
