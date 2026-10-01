package com.oficinagestao.controller;
import com.oficinagestao.dto.AlterarSenhaRequest;
import com.oficinagestao.dto.CurrentUserResponse;
import com.oficinagestao.dto.LoginChallengeResponse;
import com.oficinagestao.dto.LoginRequest;
import com.oficinagestao.dto.LoginResponse;
import com.oficinagestao.dto.LoginResult;
import com.oficinagestao.dto.MensagemResponse;
import com.oficinagestao.dto.TwoFactorResendRequest;
import com.oficinagestao.dto.TwoFactorVerifyRequest;
import com.oficinagestao.service.AuthService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticação", description = "Endpoints de login, renovação e encerramento de sessão")
public class AuthController {

    private final AuthService authService;
    private final boolean cookieSecure;

    public AuthController(
            AuthService authService,
            @Value("${security.cookie.secure:false}") boolean cookieSecure
    ) {
        this.authService = authService;
        this.cookieSecure = cookieSecure;
    }

    @PostMapping("/login")
    @Operation(summary = "Login administrativo com desafio 2FA", description = "Valida e-mail e senha. Se corretos, cria o desafio de 2FA e envia o código para o e-mail. Não emite cookies de sessão antes da validação do 2FA.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Desafio 2FA criado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Validação inválida nos campos informados"),
            @ApiResponse(responseCode = "401", description = "Credenciais inválidas")
    })
    public ResponseEntity<LoginChallengeResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginChallengeResponse response = authService.login(request, httpRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/2fa/verify")
    @Operation(summary = "Verificação de 2FA", description = "Valida o código de 6 dígitos numéricos. Emite os cookies HttpOnly de sessão e retorna os dados do usuário.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autenticado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Código inválido"),
            @ApiResponse(responseCode = "401", description = "Código incorreto, expirado ou desafio inválido")
    })
    public ResponseEntity<LoginResponse> verifyTwoFactor(
            @Valid @RequestBody TwoFactorVerifyRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginResult result = authService.verificarTwoFactor(request, httpRequest);

        ResponseCookie accessCookie = buildAccessCookie(result.accessToken(), result.accessExpiresIn(), result.rememberMe());
        ResponseCookie refreshCookie = buildRefreshCookie(result.refreshToken(), result.refreshExpiresIn(), result.rememberMe());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new LoginResponse(result.user()));
    }

    @PostMapping("/2fa/resend")
    @Operation(summary = "Reenvio de código 2FA", description = "Invalida o código anterior e gera um novo código com 5 minutos de validade.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Novo código enviado"),
            @ApiResponse(responseCode = "400", description = "Aguarde cooldown ou dados inválidos"),
            @ApiResponse(responseCode = "401", description = "Desafio não encontrado ou inválido")
    })
    public ResponseEntity<LoginChallengeResponse> resendTwoFactor(
            @Valid @RequestBody TwoFactorResendRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginChallengeResponse response = authService.reenviarTwoFactor(request, httpRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/refresh")
    @Operation(summary = "Renovação silenciosa de sessão", description = "Rotaciona refresh token e access token utilizando o cookie HttpOnly refresh_token.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Sessão renovada com novos cookies"),
            @ApiResponse(responseCode = "401", description = "Refresh token ausente, expirado ou revogado")
    })
    public ResponseEntity<LoginResponse> refresh(
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest httpRequest
    ) {
        LoginResult result = authService.refresh(refreshToken, httpRequest);

        ResponseCookie accessCookie = buildAccessCookie(result.accessToken(), result.accessExpiresIn(), result.rememberMe());
        ResponseCookie refreshCookie = buildRefreshCookie(result.refreshToken(), result.refreshExpiresIn(), result.rememberMe());

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new LoginResponse(result.user()));
    }

    @GetMapping("/me")
    @Operation(
            summary = "Dados da usuária autenticada",
            description = "Retorna os dados cadastrais e permissões da usuária na sessão ativa.",
            security = { @SecurityRequirement(name = "cookieAuth"), @SecurityRequirement(name = "bearerAuth") }
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Usuária autenticada localizada"),
            @ApiResponse(responseCode = "401", description = "Sessão inválida ou expirada")
    })
    public ResponseEntity<CurrentUserResponse> me(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        CurrentUserResponse currentUser = authService.getCurrentUser(authentication.getName());
        return ResponseEntity.ok(currentUser);
    }

    @PostMapping("/logout")
    @Operation(summary = "Encerramento de sessão", description = "Revoga o refresh token no banco de dados e expira ambos os cookies.")
    @ApiResponse(responseCode = "200", description = "Sessão encerrada com sucesso")
    public ResponseEntity<Void> logout(
            Authentication authentication,
            @CookieValue(name = "refresh_token", required = false) String refreshToken,
            HttpServletRequest httpRequest
    ) {
        String email = authentication != null ? authentication.getName() : null;
        authService.logout(email, refreshToken, httpRequest);

        ResponseCookie clearAccessCookie = ResponseCookie.from("access_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();

        ResponseCookie clearRefreshCookie = ResponseCookie.from("refresh_token", "")
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/api/auth")
                .maxAge(0)
                .sameSite("Strict")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, clearAccessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, clearRefreshCookie.toString())
                .build();
    }

    @PutMapping("/alterar-senha")
    @Operation(
            summary = "Alteração de senha da usuária autenticada",
            description = "Valida a senha atual via BCrypt, aplica a política de complexidade para a nova senha, atualiza o hash e revoga os refresh tokens ativos.",
            security = { @SecurityRequirement(name = "cookieAuth"), @SecurityRequirement(name = "bearerAuth") }
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Senha alterada com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos, confirmação divergente ou senha atual incorreta"),
            @ApiResponse(responseCode = "401", description = "Sessão inválida ou expirada")
    })
    public ResponseEntity<MensagemResponse> alterarSenha(
            @Valid @RequestBody AlterarSenhaRequest request,
            Authentication authentication,
            HttpServletRequest httpRequest
    ) {
        if (authentication == null || authentication.getName() == null) {
            return ResponseEntity.status(401).build();
        }
        authService.alterarSenha(authentication.getName(), request, httpRequest);
        return ResponseEntity.ok(new MensagemResponse("Senha alterada com sucesso."));
    }

    private ResponseCookie buildAccessCookie(String token, long accessExpiresIn, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("access_token", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .sameSite("Lax");
        if (rememberMe) {
            builder.maxAge(accessExpiresIn);
        } else {
            builder.maxAge(-1);
        }
        return builder.build();
    }

    private ResponseCookie buildRefreshCookie(String token, long refreshExpiresIn, boolean rememberMe) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("refresh_token", token)
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/api/auth")
                .sameSite("Strict");
        if (rememberMe) {
            builder.maxAge(refreshExpiresIn);
        } else {
            builder.maxAge(-1);
        }
        return builder.build();
    }
}
