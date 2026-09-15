package com.oficinagestao.service;

import com.oficinagestao.dto.AuthResponse;
import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.model.Auditoria;
import com.oficinagestao.model.Role;
import com.oficinagestao.model.Usuario;
import com.oficinagestao.repository.AuditoriaRepository;
import com.oficinagestao.repository.UsuarioRepository;
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
    private HttpServletRequest httpRequest;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(usuarioRepository, passwordEncoder, jwtService, auditoriaRepository);
    }

    @Test
    @DisplayName("Deve autenticar com sucesso quando as credenciais forem válidas")
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
        AuthResponse response = authService.login(request, httpRequest);

        assertNotNull(response);
        assertEquals("mock.jwt.token", response.accessToken());
        assertEquals("Bearer", response.tokenType());
        assertEquals("admin@oficina.com", response.user().email());
        assertTrue(response.user().roles().contains("ROLE_ADMIN"));

        verify(auditoriaRepository, times(1)).save(any(Auditoria.class));
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
    }

    @Test
    @DisplayName("Deve lançar BadCredentialsException quando o usuário não existir")
    void shouldThrowBadCredentialsWhenUserDoesNotExist() {
        when(usuarioRepository.findByEmail("inexistente@oficina.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("inexistente@oficina.com", "QualquerSenha");

        assertThrows(BadCredentialsException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaRepository, never()).save(any(Auditoria.class));
    }

    @Test
    @DisplayName("Deve lançar DisabledException quando o usuário estiver inativo")
    void shouldThrowDisabledExceptionWhenUserIsInactive() {
        Usuario usuario = new Usuario("Proprietária", "inativa@oficina.com", "hash_senha", false);

        when(usuarioRepository.findByEmail("inativa@oficina.com")).thenReturn(Optional.of(usuario));
        when(passwordEncoder.matches("SenhaValida", "hash_senha")).thenReturn(true);

        LoginRequest request = new LoginRequest("inativa@oficina.com", "SenhaValida");

        assertThrows(DisabledException.class, () -> authService.login(request, httpRequest));
        verify(auditoriaRepository, never()).save(any(Auditoria.class));
    }

    @Test
    @DisplayName("Deve registrar auditoria no logout quando email for fornecido")
    void shouldAuditLogoutSuccessfully() {
        Usuario usuario = new Usuario("Proprietária", "admin@oficina.com", "hash_senha", true);
        usuario.setId(1L);

        when(usuarioRepository.findByEmail("admin@oficina.com")).thenReturn(Optional.of(usuario));
        when(httpRequest.getRemoteAddr()).thenReturn("127.0.0.1");

        authService.logout("admin@oficina.com", httpRequest);

        verify(auditoriaRepository, times(1)).save(any(Auditoria.class));
    }

    @Test
    @DisplayName("Deve retornar os dados do usuário autenticado no getCurrentUser")
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
