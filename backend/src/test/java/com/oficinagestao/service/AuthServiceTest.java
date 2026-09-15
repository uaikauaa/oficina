package com.oficinagestao.service;

import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.model.Auditoria;
import com.oficinagestao.model.RefreshToken;
import com.oficinagestao.model.Role;
import com.oficinagestao.model.Usuario;
import com.oficinagestao.repository.AuditoriaRepository;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.JwtService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private JwtService jwtService;

    @Mock
    private AuditoriaRepository auditoriaRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private HttpServletRequest httpRequest;

    private AuthService authService;

    private static final long REFRESH_EXPIRATION_MS = 604800000L; // 7 dias

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                usuarioRepository,
                passwordEncoder,
                jwtService,
                auditoriaRepository,
                refreshTokenRepository,
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
        when(httpRequest.getRemoteAddr()).thenReturn("192.168.1.1");

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

        verify(auditoriaRepository, times(1)).save(any(Auditoria.class));
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
        verify(auditoriaRepository, never()).save(any(Auditoria.class));
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o usuário não existir")
    void shouldThrowBadCredentialsWhenUserDoesNotExist() {
        when(usuarioRepository.findByEmail("inexistente@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("inexistente@oficina.com", "QualquerSenha");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaRepository, never()).save(any(Auditoria.class));
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
    }

    @Test
    @DisplayName("Deve lançar DisabledException quando o usuário estiver inativo no login")
    void shouldThrowDisabledExceptionWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativa@oficina.com", "hash_senha", false);

        when(usuarioRepository.findByEmail("inativa@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaValida", "hash_senha")).thenReturn(true);

        LoginRequest request = new LoginRequest("inativa@oficina.com", "SenhaValida");

        assertThrows(DisabledException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaRepository, never()).save(any(Auditoria.class));
        verify(refreshTokenRepository, never()).save(any(RefreshToken.class));
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
    @DisplayName("Deve lançar BadCredentialsException quando o refresh token já estiver revogado")
    void shouldThrowWhenRefreshTokenIsRevoked() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        RefreshToken revokedToken = new RefreshToken(usuario, "revoked-token", OffsetDateTime.now().plusDays(3));
        revokedToken.setRevogado(true);

        when(refreshTokenRepository.findByToken("revoked-token")).thenReturn(Optional.of(revokedToken));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("revoked-token", httpRequest));
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
        when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        authService.logout("admin@oficina.com", "refresh-to-revoke", httpRequest);

        assertTrue(token.getRevogado());
        verify(refreshTokenRepository, times(1)).save(token);
        verify(auditoriaRepository, times(1)).save(any(Auditoria.class));
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
}
