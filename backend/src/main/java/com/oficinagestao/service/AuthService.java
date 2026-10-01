package com.oficinagestao.service;

import com.oficinagestao.dto.AlterarSenhaRequest;
import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginChallengeResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.dto.TwoFactorResendRequest;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.entity.Role;
import com.oficinagestao.entity.TwoFactorChallenge;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.repository.RefreshTokenRepository;
import com.oficinagestao.repository.TwoFactorChallengeRepository;
import com.oficinagestao.repository.UsuarioRepository;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.security.JwtService;
import com.oficinagestao.security.LoginAttemptService;
import com.oficinagestao.security.PasswordPolicyValidator;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.oficinagestao.security.TokenHashUtil;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);

    // VULN-03: Hash BCrypt dummy fixo e seguro para mitigar enumeração de e-mail por análise temporal
    private static final String DUMMY_PASSWORD_HASH = "$2a$10$xggQ8fiER5RPorzR59NqnuJxnVPLwZQinxJ7xyhus9kgso9WyktTm";

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditoriaService auditoriaService;
    private final RefreshTokenRepository refreshTokenRepository;
    private final TwoFactorChallengeRepository twoFactorChallengeRepository;
    private final EmailService emailService;
    private final LoginAttemptService loginAttemptService;
    private final long refreshExpirationMs;
    private final long refreshExpirationTempMs;
    private final com.oficinagestao.security.IpAddressResolver ipAddressResolver;
    private final TokenHashUtil tokenHashUtil;
    private final SecureRandom secureRandom = new SecureRandom();

    @org.springframework.beans.factory.annotation.Autowired
    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            TwoFactorChallengeRepository twoFactorChallengeRepository,
            EmailService emailService,
            LoginAttemptService loginAttemptService,
            @Value("${security.jwt.refresh-expiration-ms:604800000}") long refreshExpirationMs,
            @Value("${security.jwt.refresh-expiration-temp-ms:86400000}") long refreshExpirationTempMs,
            com.oficinagestao.security.IpAddressResolver ipAddressResolver,
            TokenHashUtil tokenHashUtil
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditoriaService = auditoriaService;
        this.refreshTokenRepository = refreshTokenRepository;
        this.twoFactorChallengeRepository = twoFactorChallengeRepository;
        this.emailService = emailService;
        this.loginAttemptService = loginAttemptService;
        this.refreshExpirationMs = refreshExpirationMs;
        this.refreshExpirationTempMs = refreshExpirationTempMs;
        this.ipAddressResolver = ipAddressResolver != null ? ipAddressResolver : new com.oficinagestao.security.IpAddressResolver();
        this.tokenHashUtil = tokenHashUtil != null ? tokenHashUtil : new TokenHashUtil();
    }

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            TwoFactorChallengeRepository twoFactorChallengeRepository,
            EmailService emailService,
            LoginAttemptService loginAttemptService,
            long refreshExpirationMs,
            long refreshExpirationTempMs,
            com.oficinagestao.security.IpAddressResolver ipAddressResolver
    ) {
        this(usuarioRepository, passwordEncoder, jwtService, auditoriaService, refreshTokenRepository, twoFactorChallengeRepository, emailService, loginAttemptService, refreshExpirationMs, refreshExpirationTempMs, ipAddressResolver, new TokenHashUtil());
    }

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            TwoFactorChallengeRepository twoFactorChallengeRepository,
            EmailService emailService,
            LoginAttemptService loginAttemptService,
            long refreshExpirationMs,
            long refreshExpirationTempMs
    ) {
        this(usuarioRepository, passwordEncoder, jwtService, auditoriaService, refreshTokenRepository, twoFactorChallengeRepository, emailService, loginAttemptService, refreshExpirationMs, refreshExpirationTempMs, new com.oficinagestao.security.IpAddressResolver(), new TokenHashUtil());
    }

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaService auditoriaService,
            RefreshTokenRepository refreshTokenRepository,
            TwoFactorChallengeRepository twoFactorChallengeRepository,
            EmailService emailService,
            LoginAttemptService loginAttemptService,
            long refreshExpirationMs
    ) {
        this(usuarioRepository, passwordEncoder, jwtService, auditoriaService, refreshTokenRepository, twoFactorChallengeRepository, emailService, loginAttemptService, refreshExpirationMs, 86400000L, new com.oficinagestao.security.IpAddressResolver(), new TokenHashUtil());
    }

    @Transactional
    public LoginChallengeResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        String ip = extrairIp(httpRequest);
        String email = request.email() != null ? request.email().trim().toLowerCase() : "";

        // ISSUE-003 / SEC-02: Proteção contra força bruta (Rate limiting e lockout temporário por IP e IP+Email)
        if (loginAttemptService.isBlocked(ip, email)) {
            log.warn("Tentativa de login rejeitada por bloqueio temporário (lockout). IP: {}, Email: {}", ip, email);
            throw new BadCredentialsException("Muitas tentativas incorretas. Conta bloqueada temporariamente. Tente novamente mais tarde.");
        }

        Usuario usuario = usuarioRepository.findByEmail(email).orElse(null);

        // Prevenção contra enumeração de usuários: tempo e mensagem uniformes (VULN-03)
        if (usuario == null) {
            passwordEncoder.matches(request.senha() != null ? request.senha() : "", DUMMY_PASSWORD_HASH);
            loginAttemptService.loginFailed(ip, email);
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        if (!passwordEncoder.matches(request.senha() != null ? request.senha() : "", usuario.getSenha())) {
            loginAttemptService.loginFailed(ip, email);
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        // ISSUE-005: Resposta externa uniforme para usuário inativo (HTTP 401 BadCredentialsException)
        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            log.warn("Tentativa de login rejeitada para conta inativa: {}", email);
            loginAttemptService.loginFailed(ip, email);
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        // Autenticação prévia bem-sucedida: reseta tentativas de login para IP e email
        loginAttemptService.loginSucceeded(ip, email);

        // Invalida desafios 2FA anteriores do usuário
        twoFactorChallengeRepository.revokeAllActiveByUsuarioId(usuario.getId());

        // Gera código de 6 dígitos numéricos usando SecureRandom
        int codeNum = 100_000 + secureRandom.nextInt(900_000);
        String code = String.valueOf(codeNum);
        String codeHash = passwordEncoder.encode(code);

        String challengeToken = UUID.randomUUID().toString();
        OffsetDateTime expiry = OffsetDateTime.now().plusMinutes(5);
        boolean rememberMe = request != null && request.isRememberMe();

        TwoFactorChallenge challenge = new TwoFactorChallenge(
                usuario,
                challengeToken,
                codeHash,
                expiry,
                rememberMe
        );
        twoFactorChallengeRepository.save(challenge);

        try {
            emailService.sendTwoFactorCode(usuario.getEmail(), code);
        } catch (Exception e) {
            auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_EMAIL_FAILED", httpRequest);
            log.error("Falha ao enviar e-mail 2FA para o usuário ID [{}]: {}", usuario.getId(), e.getMessage());
            throw new BusinessException("Falha ao enviar e-mail com código de verificação. Tente novamente.");
        }

        auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_REQUESTED", httpRequest);

        return new LoginChallengeResponse(true, challengeToken, "Se as credenciais forem válidas, um código de verificação foi enviado.");
    }

    @Transactional(noRollbackFor = { BadCredentialsException.class })
    public LoginResult verificarTwoFactor(TwoFactorVerifyRequest request, HttpServletRequest httpRequest) {
        TwoFactorChallenge challenge = twoFactorChallengeRepository.findByChallengeToken(request.challengeToken())
                .orElseThrow(() -> new BadCredentialsException("Desafio inválido ou expirado."));

        Usuario usuario = challenge.getUsuario();

        if (Boolean.TRUE.equals(challenge.getRevogado()) || Boolean.TRUE.equals(challenge.getUtilizado())) {
            throw new BadCredentialsException("Desafio inválido ou expirado.");
        }

        // 5. Expiração: 5 minutos
        if (challenge.isExpired()) {
            challenge.revoke();
            twoFactorChallengeRepository.save(challenge);
            auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_EXPIRED", httpRequest);
            throw new BadCredentialsException("Código de verificação expirado. Solicite um novo código.");
        }

        // 6. Limite de tentativas: 5 tentativas no máximo
        if (challenge.getTentativas() >= 5) {
            challenge.revoke();
            twoFactorChallengeRepository.save(challenge);
            auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_MAX_ATTEMPTS", httpRequest);
            throw new BadCredentialsException("Limite de tentativas excedido. Solicite um novo código.");
        }

        // Incrementa tentativa de forma atômica
        challenge.incrementTentativas();

        // Valida o código
        if (!passwordEncoder.matches(request.code(), challenge.getCodigoHash())) {
            if (challenge.getTentativas() >= 5) {
                challenge.revoke();
                twoFactorChallengeRepository.save(challenge);
                auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_MAX_ATTEMPTS", httpRequest);
                throw new BadCredentialsException("Limite de tentativas excedido. Solicite um novo código.");
            } else {
                twoFactorChallengeRepository.save(challenge);
                auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_INVALID_CODE", httpRequest);
                int remaining = 5 - challenge.getTentativas();
                throw new BadCredentialsException("Código de verificação incorreto. Você tem mais " + remaining + " tentativa(s).");
            }
        }

        // Código correto! Invalida imediatamente após uso correto
        challenge.setUtilizado(true);
        twoFactorChallengeRepository.save(challenge);

        auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(challenge), "2FA_VALIDATED", httpRequest);
        auditoriaService.registrarComRequest(usuario.getId(), "Usuario", usuario.getId().toString(), "LOGIN", httpRequest);

        // Emitir tokens e criar sessão
        String accessToken = jwtService.generateToken(usuario);

        boolean rememberMe = Boolean.TRUE.equals(challenge.getRememberMe());
        long tokenRefreshExpiryMs = rememberMe ? refreshExpirationMs : refreshExpirationTempMs;

        String refreshTokenValue = UUID.randomUUID().toString();
        String tokenHash = tokenHashUtil.hash(refreshTokenValue);
        OffsetDateTime refreshExpiry = OffsetDateTime.now().plus(tokenRefreshExpiryMs, ChronoUnit.MILLIS);
        RefreshToken refreshToken = new RefreshToken(usuario, tokenHash, refreshExpiry, rememberMe);
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
                tokenRefreshExpiryMs / 1000,
                userResponse,
                rememberMe
        );
    }

    @Transactional
    public LoginChallengeResponse reenviarTwoFactor(TwoFactorResendRequest request, HttpServletRequest httpRequest) {
        TwoFactorChallenge oldChallenge = twoFactorChallengeRepository.findByChallengeToken(request.challengeToken())
                .orElseThrow(() -> new BadCredentialsException("Desafio inválido ou expirado."));

        if (!oldChallenge.isValid()) {
            throw new BadCredentialsException("Desafio inválido ou expirado.");
        }

        // Cooldown simples de reenvio contra spam: 30 segundos
        if (oldChallenge.getDataCriacao().plusSeconds(30).isAfter(OffsetDateTime.now())) {
            throw new BusinessException("Aguarde alguns instantes antes de solicitar um novo código.");
        }

        Usuario usuario = oldChallenge.getUsuario();
        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            throw new DisabledException("Conta de usuário inativa.");
        }

        // Invalida o desafio anterior
        oldChallenge.revoke();
        twoFactorChallengeRepository.save(oldChallenge);

        // Gera novo código de 6 dígitos numéricos usando SecureRandom
        int codeNum = 100_000 + secureRandom.nextInt(900_000);
        String newCode = String.valueOf(codeNum);
        String codeHash = passwordEncoder.encode(newCode);

        String newChallengeToken = UUID.randomUUID().toString();
        OffsetDateTime expiry = OffsetDateTime.now().plusMinutes(5);

        TwoFactorChallenge newChallenge = new TwoFactorChallenge(
                usuario,
                newChallengeToken,
                codeHash,
                expiry,
                oldChallenge.getRememberMe()
        );
        twoFactorChallengeRepository.save(newChallenge);

        try {
            emailService.sendTwoFactorCode(usuario.getEmail(), newCode);
        } catch (Exception e) {
            auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(newChallenge), "2FA_EMAIL_FAILED", httpRequest);
            log.error("Falha ao reenviar e-mail 2FA para o usuário ID [{}]: {}", usuario.getId(), e.getMessage());
            throw new BusinessException("Falha ao reenviar e-mail com código de verificação. Tente novamente.");
        }

        auditoriaService.registrarComRequest(usuario.getId(), "TwoFactorChallenge", resolveChallengeId(newChallenge), "2FA_RESENT", httpRequest);

        return new LoginChallengeResponse(true, newChallengeToken, "Novo código de verificação enviado para o seu e-mail.");
    }

    @Transactional
    public LoginResult refresh(String refreshTokenValue, HttpServletRequest httpRequest) {
        if (refreshTokenValue == null || refreshTokenValue.isBlank()) {
            throw new BadCredentialsException("Refresh token ausente ou inválido.");
        }

        String tokenHash = tokenHashUtil.hash(refreshTokenValue);
        RefreshToken oldToken = refreshTokenRepository.findByTokenHash(tokenHash)
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

        // Rotação de refresh token: revoga o antigo e cria um novo mantendo a persistência da sessão original
        oldToken.revoke();
        refreshTokenRepository.save(oldToken);

        boolean rememberMe = Boolean.TRUE.equals(oldToken.getRememberMe());
        long tokenRefreshExpiryMs = rememberMe ? refreshExpirationMs : refreshExpirationTempMs;

        String newRefreshTokenValue = UUID.randomUUID().toString();
        String newTokenHash = tokenHashUtil.hash(newRefreshTokenValue);
        OffsetDateTime refreshExpiry = OffsetDateTime.now().plus(tokenRefreshExpiryMs, ChronoUnit.MILLIS);
        RefreshToken newToken = new RefreshToken(usuario, newTokenHash, refreshExpiry, rememberMe);
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
                tokenRefreshExpiryMs / 1000,
                userResponse,
                rememberMe
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
        Usuario usuarioParaLogout = null;

        // 1. Se informou email (via Authentication), localiza o usuário
        if (email != null && !email.isBlank()) {
            usuarioParaLogout = usuarioRepository.findByEmail(email).orElse(null);
        }

        // 2. Revogar refresh token caso informado
        if (refreshTokenValue != null && !refreshTokenValue.isBlank()) {
            String tokenHash = tokenHashUtil.hash(refreshTokenValue);
            Optional<RefreshToken> tokenOpt = refreshTokenRepository.findByTokenHash(tokenHash);
            if (tokenOpt.isPresent()) {
                RefreshToken token = tokenOpt.get();
                token.revoke();
                refreshTokenRepository.save(token);
                if (usuarioParaLogout == null) {
                    usuarioParaLogout = token.getUsuario();
                }
            }
        }

        // 3. SEC-07: Invalida os access tokens da usuária incrementando sua tokenVersion
        if (usuarioParaLogout != null) {
            usuarioParaLogout.incrementTokenVersion();
            usuarioRepository.save(usuarioParaLogout);
            auditoriaService.registrarComRequest(usuarioParaLogout.getId(), "Usuario", usuarioParaLogout.getId().toString(), "LOGOUT", httpRequest);
        }
    }

    @Transactional
    public void alterarSenha(String email, AlterarSenhaRequest request, HttpServletRequest httpRequest) {
        if (email == null || email.isBlank()) {
            throw new BadCredentialsException("Usuário não autenticado.");
        }

        Usuario usuario = usuarioRepository.findByEmail(email)
                .orElseThrow(() -> new BadCredentialsException("Usuário não encontrado."));

        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            throw new DisabledException("Conta de usuário inativa.");
        }

        // 1. Validar senha atual usando BCrypt
        if (!passwordEncoder.matches(request.senhaAtual(), usuario.getSenha())) {
            throw new BusinessException("Senha atual incorreta.");
        }

        // 2. Confirmar novaSenha == confirmacaoNovaSenha
        if (!request.novaSenha().equals(request.confirmacaoNovaSenha())) {
            throw new BusinessException("A confirmação da nova senha não confere.");
        }

        // 3. Impedir que a nova senha seja igual à senha atual
        if (passwordEncoder.matches(request.novaSenha(), usuario.getSenha())) {
            throw new BusinessException("A nova senha não pode ser igual à senha atual.");
        }

        // 4. Validar nova senha com a política centralizada de segurança
        PasswordPolicyValidator.validar(request.novaSenha());

        // 5. Gerar novo hash BCrypt, incrementar token_version (SEC-07) e salvar no banco
        usuario.setSenha(passwordEncoder.encode(request.novaSenha()));
        usuario.incrementTokenVersion();
        usuarioRepository.save(usuario);

        // 6. Invalidar/revogar todos os refresh tokens existentes do usuário
        refreshTokenRepository.revokeAllByUsuarioId(usuario.getId());

        // 7. Log de auditoria da alteração de credencial
        auditoriaService.registrarComRequest(usuario.getId(), "Usuario", usuario.getId().toString(), "PASSWORD_CHANGE", httpRequest);
        log.info("Senha alterada com sucesso para o usuário ID: [{}]", usuario.getId());
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

    private String resolveChallengeId(TwoFactorChallenge challenge) {
        if (challenge == null) {
            return "N/A";
        }
        return challenge.getId() != null ? challenge.getId().toString() : challenge.getChallengeToken();
    }
}
