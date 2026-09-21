package com.oficinagestao.service;

import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.security.JwtService;
import com.oficinagestao.security.LoginAttemptService;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditoriaService auditoriaService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final LoginAttemptService loginAttemptService;
    private final long refreshExpirationMs;
    private final com.oficinagestao.security.IpAddressResolver ipAddressResolver;

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            LoginAttemptService loginAttemptService,
            @Value("${security.jwt.refresh-expiration-ms:604800000}") long refreshExpirationMs,
            com.oficinagestao.security.IpAddressResolver ipAddressResolver
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditoriaService = auditoriaService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.loginAttemptService = loginAttemptService;
        this.refreshExpirationMs = refreshExpirationMs;
        this.ipAddressResolver = ipAddressResolver != null ? ipAddressResolver : new com.oficinagestao.security.IpAddressResolver();
    }

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            LoginAttemptService loginAttemptService,
            long refreshExpirationMs
    ) {
        this(usuarioRepository, passwordEncoder, jwtService, auditoriaService, refreshTokenRepository, loginAttemptService, refreshExpirationMs, new com.oficinagestao.security.IpAddressResolver());
    }

    @Transactional
    public LoginResult login(LoginRequest request, HttpServletRequest httpRequest) {
        String ip = extrairIp(httpRequest);
        String email = request.email() != null ? request.email().trim().toLowerCase() : "";

        // ISSUE-003: Proteção contra força bruta (Rate limiting e lockout temporário)
        if (loginAttemptService.isBlocked(ip, email)) {
            long remainingMinutes = loginAttemptService.getRemainingLockMinutes(ip, email);
            log.warn("Tentativa de login rejeitada por bloqueio temporário (lockout). IP: {}, Email: {}", ip, email);
            throw new BadCredentialsException("Muitas tentativas incorretas. Conta bloqueada temporariamente. Tente novamente em " + remainingMinutes + " minuto(s).");
        }

        Usuario usuario = usuarioRepository.findByEmail(email).orElse(null);

        // Prevenção contra enumeração de usuários: tempo e mensagem uniformes
        if (usuario == null || !passwordEncoder.matches(request.senha(), usuario.getSenha())) {
            loginAttemptService.loginFailed(ip, email);
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        // ISSUE-005: Resposta externa uniforme para usuário inativo (HTTP 401 BadCredentialsException)
        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            log.warn("Tentativa de login rejeitada para conta inativa: {}", email);
            loginAttemptService.loginFailed(ip, email);
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        // Autenticação bem-sucedida: reseta tentativas de falha para IP e Email
        loginAttemptService.loginSucceeded(ip, email);

        // Registrar auditoria reutilizável
        auditoriaService.registrarComRequest(usuario.getId(), "Usuario", usuario.getId().toString(), "LOGIN", httpRequest);

        String accessToken = jwtService.generateToken(usuario);

        // Gerar e persistir refresh token opaco
        String refreshTokenValue = UUID.randomUUID().toString();
        OffsetDateTime refreshExpiry = OffsetDateTime.now().plus(refreshExpirationMs, ChronoUnit.MILLIS);
        RefreshToken refreshToken = new RefreshToken(usuario, refreshTokenValue, refreshExpiry);
        refreshTokenRepository.save(refreshToken);

        Set<String> roles = usuario.getRoles().stream()
                .map(Role::getNome)
                .collect(Collectors.toSet());

        CurrentUserResponse userResponse = new CurrentUserResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                roles
        );

        return new LoginResult(
                accessToken,
                refreshTokenValue,
                jwtService.getExpirationMs() / 1000,
                refreshExpirationMs / 1000,
                userResponse
        );
    }

    @Transactional
    public LoginResult refresh(String refreshTokenValue, HttpServletRequest httpRequest) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            throw new BadCredentialsException("Refresh token ausente ou inválido.");
        }

        RefreshToken oldToken = refreshTokenRepository.findByToken(refreshTokenValue)
                .orElseThrow(() -> new BadCredentialsException("Refresh token não encontrado."));

        if (Boolean.TRUE.equals(oldToken.getRevogado())) {
            if (oldToken.getUsuario() != null) {
                refreshTokenRepository.revokeAllByUsuarioId(oldToken.getUsuario().getId());
            }
            throw new BadCredentialsException("Refresh token revogado.");
        }

        if (oldToken.isExpired()) {
            throw new BadCredentialsException("Refresh token expirado.");
        }

        Usuario usuario = oldToken.getUsuario();
        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            throw new DisabledException("Conta de usuário inativa.");
        }

        // Rotação de refresh token: revoga o antigo e cria um novo
        oldToken.revoke();
        refreshTokenRepository.save(oldToken);

        String newRefreshTokenValue = UUID.randomUUID().toString();
        OffsetDateTime refreshExpiry = OffsetDateTime.now().plus(refreshExpirationMs, ChronoUnit.MILLIS);
        RefreshToken newToken = new RefreshToken(usuario, newRefreshTokenValue, refreshExpiry);
        refreshTokenRepository.save(newToken);

        String newAccessToken = jwtService.generateToken(usuario);

        Set<String> roles = usuario.getRoles().stream()
                .map(Role::getNome)
                .collect(Collectors.toSet());

        CurrentUserResponse userResponse = new CurrentUserResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                roles
        );

        return new LoginResult(
                newAccessToken,
                newRefreshTokenValue,
                jwtService.getExpirationMs() / 1000,
                refreshExpirationMs / 1000,
                userResponse
        );
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse getCurrentUser(String email) {
        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Usuário não encontrado."));

        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            throw new DisabledException("Conta de usuário inativa.");
        }

        Set<String> roles = usuario.getRoles().stream()
                .map(Role::getNome)
                .collect(Collectors.toSet());

        return new CurrentUserResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                roles
        );
    }

    @Transactional
    public void logout(String email, String refreshTokenValue, HttpServletRequest httpRequest) {
        // Revogar refresh token caso informado
        if (refreshTokenValue != null && !refreshTokenValue.isBlank()) {
            refreshTokenRepository.findByToken(refreshTokenValue).ifPresent(token -> {
                token.revoke();
                refreshTokenRepository.save(token);
            });
        }

        if (email != null && !email.isBlank()) {
            usuarioRepository.findByEmail(email).ifPresent(usuario -> {
                auditoriaService.registrarComRequest(usuario.getId(), "Usuario", usuario.getId().toString(), "LOGOUT", httpRequest);
            });
        }
    }

    @Transactional
    public int purgarTokensExpiradosOuRevogados() {
        OffsetDateTime limite = OffsetDateTime.now().minusDays(7);
        int deletados = refreshTokenRepository.deleteExpiredOrRevoked(limite);
        log.info("Purga de refresh tokens concluída: {} tokens removidos.", deletados);
        return deletados;
    }

    private String extrairIp(HttpServletRequest request) {
        return ipAddressResolver.extrairIp(request);
    }
}
