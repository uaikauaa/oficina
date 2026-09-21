package com.oficinagestao.service;

import com.oficinagestao.dto.*;
import com.oficinagestao.entity.*;
import com.oficinagestao.repository.*;
import com.oficinagestao.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import com.oficinagestao.exception.BusinessException;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

import com.oficinagestao.security.LoginAttemptService;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuditoriaService auditoriaService;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private HttpServletRequest httpRequest;

    private LoginAttemptService loginAttemptService;
    private AuthService authService;

    private static final long REFRESH_EXPIRATION_MS = 604800000L; // 7 dias

    @BeforeEach
    void setUp() {
        loginAttemptService = new LoginAttemptService(5, 15);
        authService = new AuthService(
                usuarioRepository,
                passwordEncoder,
                jwtService,
                auditoriaService,
                refreshTokenRepository,
                loginAttemptService,
                REFRESH_EXPIRATION_MS
        );
    }

    @Test
    @DisplayName("Deve autenticar com sucesso quando as credenciais forem válidas e gerar tokens")
    void shouldLoginSuccessfullyWithValidCredentials() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaCorreta123", "hash_senha")).thenReturn(true);
        when(jwtService.generateToken(usuario)).thenReturn("mock.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaCorreta123");
        LoginResult result = authService.login(request, httpRequest);

        assertNotNull(result);
        assertEquals("mock.jwt.token", result.accessToken());
        assertNotNull(result.refreshToken());
        assertFalse(result.refreshToken().isBlank());
        assertEquals(900L, result.accessExpiresIn());
        assertEquals(REFRESH_EXPIRATION_MS / 1000, result.refreshExpiresIn());
        assertEquals("admin@oficina.com", result.user().email());
        assertTrue(result.user().roles().contains("ROLE_ADMIN"));

        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("LOGIN"), eq(httpRequest));
        verify(refreshTokenRepository, times(1)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando a senha for inválida")
    void shouldThrowBadCredentialsWhenPasswordIsInvalid() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaErrada", "hash_senha")).thenReturn(false);

        LoginRequest request = new LoginRequest("admin@oficina.com", "SenhaErrada");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o usuário não existir")
    void shouldThrowBadCredentialsWhenUserDoesNotExist() {
        when(usuarioRepository.findByEmail("inexistente@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("inexistente@oficina.com", "QualquerSenha");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("ISSUE-005: Deve lançar BadCredentialsException uniforme quando o usuário estiver inativo no login")
    void shouldThrowBadCredentialsWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativa@oficina.com", "hash_senha", false);

        when(usuarioRepository.findByEmail("inativa@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaValida", "hash_senha")).thenReturn(true);

        LoginRequest request = new LoginRequest("inativa@oficina.com", "SenhaValida");

        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertEquals("Credenciais inválidas.", ex.getMessage());
        verify(auditoriaService, never()).registrarComRequest(any(), any(), any(), any(), any());
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("ISSUE-003: Deve bloquear login após atingir o limite de 5 tentativas consecutivas inválidas")
    void shouldBlockLoginAfterMaxAttempts() {
        when(usuarioRepository.findByEmail("admin_brute@oficina.com")).thenReturn(Optional.empty());
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.50");

        LoginRequest request = new LoginRequest("admin_brute@oficina.com", "SenhaErrada");

        // 5 tentativas consecutivas
        for (int i = 0; i < 5; i++) {
            assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        }

        // 6ª tentativa deve ser bloqueada por lockout
        BadCredentialsException ex = assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        assertTrue(ex.getMessage().contains("Muitas tentativas incorretas. Conta bloqueada temporariamente"));
    }

    @Test
    @DisplayName("Deve rotacionar o refresh token e emitir novo access token com sucesso")
    void shouldRotateRefreshTokenSuccessfully() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        RefreshToken oldToken = new RefreshToken(usuario, "old-refresh-uuid", OffsetDateTime.now().plusDays(5));
        oldToken.setId(10L);

        when(refreshTokenRepository.findByToken("old-refresh-uuid")).thenReturn(Optional.of(oldToken));
        when(jwtService.generateToken(usuario)).thenReturn("new.jwt.token");
        when(jwtService.getExpirationMs()).thenReturn(900000L);

        LoginResult result = authService.refresh("old-refresh-uuid", httpRequest);

        assertNotNull(result);
        assertEquals("new.jwt.token", result.accessToken());
        assertNotEquals("old-refresh-uuid", result.refreshToken());
        assertTrue(oldToken.getRevogado());

        // Deve ter salvo o antigo revogado e o novo token
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token não for encontrado")
    void shouldThrowWhenRefreshTokenNotFound() {
        when(refreshTokenRepository.findByToken("token-inexistente")).thenReturn(Optional.empty());

        assertThrows(BadCredentialsException.class, () -> authService.refresh("token-inexistente", httpRequest));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token for nulo ou em branco")
    void shouldThrowWhenRefreshTokenIsBlank() {
        assertThrows(BadCredentialsException.class, () -> authService.refresh("   ", httpRequest));
        assertThrows(BadCredentialsException.class, () -> authService.refresh(null, httpRequest));
    }

    @Test
    @DisplayName("RISK-005: Deve revogar todos os tokens do usuário (família de tokens) e lançar BadCredentialsException ao tentar reutilizar token revogado")
    void shouldThrowAndRevokeAllTokensWhenRefreshTokenIsRevoked() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        RefreshToken revokedToken = new RefreshToken(usuario, "revoked-token", OffsetDateTime.now().plusDays(2));
        revokedToken.revoke();

        when(refreshTokenRepository.findByToken("revoked-token")).thenReturn(Optional.of(revokedToken));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("revoked-token", httpRequest));
        verify(refreshTokenRepository, times(1)).revokeAllByUsuarioId(1L);
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token estiver expirado")
    void shouldThrowWhenRefreshTokenIsExpired() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        RefreshToken expiredToken = new RefreshToken(usuario, "expired-token", OffsetDateTime.now().minusDays(1));

        when(refreshTokenRepository.findByToken("expired-token")).thenReturn(Optional.of(expiredToken));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("expired-token", httpRequest));
    }

    @Test
    @DisplayName("Deve lançar DisabledException quando o usuário do refresh token estiver inativo")
    void shouldThrowWhenUserIsInactiveOnRefresh() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", false);
        RefreshToken token = new RefreshToken(usuario, "valid-token", OffsetDateTime.now().plusDays(2));

        when(refreshTokenRepository.findByToken("valid-token")).thenReturn(Optional.of(token));

        assertThrows(DisabledException.class, () -> authService.refresh("valid-token", httpRequest));
    }

    @Test
    @DisplayName("Deve revogar o refresh token e registrar auditoria no logout")
    void shouldRevokeRefreshTokenAndAuditLogout() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        RefreshToken token = new RefreshToken(usuario, "refresh-to-revoke", OffsetDateTime.now().plusDays(3));

        when(refreshTokenRepository.findByToken("refresh-to-revoke")).thenReturn(Optional.of(token));
        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));

        authService.logout("admin@oficina.com", "refresh-to-revoke", httpRequest);

        assertTrue(token.getRevogado());
        verify(refreshTokenRepository, times(1)).save(token);
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("LOGOUT"), eq(httpRequest));
    }

    @Test
    @DisplayName("Deve retornar os dados da usuária autenticada no getCurrentUser")
    void shouldReturnCurrentUser() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);
        usuario.addRole(new Role("ROLE_ADMIN", "Admin"));

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));

        CurrentUserResponse response = authService.getCurrentUser("admin@oficina.com");

        assertNotNull(response);
        assertEquals("Proprietária", response.nome());
        assertEquals("admin@oficina.com", response.email());
        assertTrue(response.roles().contains("ROLE_ADMIN"));
    }

    @Test
    @DisplayName("ISSUE-08: Deve expurgar refresh tokens expirados ou revogados com sucesso")
    void shouldPurgeExpiredOrRevokedRefreshTokens() {
        when(refreshTokenRepository.deleteExpiredOrRevoked(any(OffsetDateTime.class))).thenReturn(42);

        int deletados = authService.purgarTokensExpiradosOuRevogados();

        assertEquals(42, deletados);
        verify(refreshTokenRepository, times(1)).deleteExpiredOrRevoked(any(OffsetDateTime.class));
    }

    @Test
    @DisplayName("Deve alterar a senha com sucesso, salvar hash BCrypt e revogar refresh tokens ativos")
    void shouldChangePasswordSuccessfully() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);
        when(passwordEncoder.matches("NovaSenhaSegura#2026", "hash_antigo")).thenReturn(false);
        when(passwordEncoder.encode("NovaSenhaSegura#2026")).thenReturn("hash_novo_bcrypt");

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        authService.alterarSenha("admin@oficina.com", request, httpRequest);

        assertEquals("hash_novo_bcrypt", usuario.getSenha());
        verify(usuarioRepository, times(1)).save(usuario);
        verify(refreshTokenRepository, times(1)).revokeAllByUsuarioId(1L);
        verify(auditoriaService, times(1)).registrarComRequest(eq(1L), eq("Usuario"), eq("1"), eq("PASSWORD_CHANGE"), eq(httpRequest));
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a senha atual informada estiver incorreta")
    void shouldRejectPasswordChangeWhenCurrentPasswordIsIncorrect() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaErrada@123", "hash_antigo")).thenReturn(false);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaErrada@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("Senha atual incorreta.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
        verify(refreshTokenRepository, never()).revokeAllByUsuarioId(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a confirmação da nova senha divergir")
    void shouldRejectPasswordChangeWhenConfirmationDoesNotMatch() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "ConfirmacaoDiferente#2026");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("A confirmação da nova senha não confere.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a nova senha for idêntica à senha atual")
    void shouldRejectPasswordChangeWhenNewPasswordIsSameAsCurrent() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "SenhaAtual@123", "SenhaAtual@123");

        BusinessException ex = assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        assertEquals("A nova senha não pode ser igual à senha atual.", ex.getMessage());
        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração quando a nova senha violar a política de complexidade")
    void shouldRejectPasswordChangeWhenNewPasswordViolatesPolicy() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_antigo", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaAtual@123", "hash_antigo")).thenReturn(true);
        when(passwordEncoder.matches("admin123", "hash_antigo")).thenReturn(false);

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "admin123", "admin123");

        assertThrows(BusinessException.class, () ->
                authService.alterarSenha("admin@oficina.com", request, httpRequest)
        );

        verify(usuarioRepository, never()).save(any());
    }

    @Test
    @DisplayName("Deve rejeitar alteração se a conta de usuário estiver inativa")
    void shouldRejectPasswordChangeWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativo@oficina.com", "hash_antigo", false);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("inativo@oficina.com")).thenReturn(Optional.of(usuario));

        AlterarSenhaRequest request = new AlterarSenhaRequest("SenhaAtual@123", "NovaSenhaSegura#2026", "NovaSenhaSegura#2026");

        assertThrows(DisabledException.class, () ->
                authService.alterarSenha("inativo@oficina.com", request, httpRequest)
        );

        verify(usuarioRepository, never()).save(any());
    }
}
