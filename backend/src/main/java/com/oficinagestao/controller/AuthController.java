package com.oficinagestao.controller;
import com.oficinagestao.dto.*;
import com.oficinagestao.service.*;

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
import org.springframework.web.bind.annotation.*;

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
    @Operation(summary = "Login administrativo", description = "Autentica a usuária via e-mail e senha. Define cookies HttpOnly e retorna dados do usuário sem expor JWT no corpo.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Autenticado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Validação inválida nos campos informados"),
            @ApiResponse(responseCode = "401", description = "Credenciais inválidas")
    })
    public ResponseEntity<LoginResponse> login(
            @Valid @RequestBody LoginRequest request,
            HttpServletRequest httpRequest
    ) {
        LoginResult result = authService.login(request, httpRequest);

        ResponseCookie accessCookie = ResponseCookie.from("access_token", result.accessToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(result.accessExpiresIn())
                .sameSite("Lax")
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", result.refreshToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/api/auth")
                .maxAge(result.refreshExpiresIn())
                .sameSite("Strict")
                .build();

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, accessCookie.toString())
                .header(HttpHeaders.SET_COOKIE, refreshCookie.toString())
                .body(new LoginResponse(result.user()));
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

        ResponseCookie accessCookie = ResponseCookie.from("access_token", result.accessToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/")
                .maxAge(result.accessExpiresIn())
                .sameSite("Lax")
                .build();

        ResponseCookie refreshCookie = ResponseCookie.from("refresh_token", result.refreshToken())
                .httpOnly(true)
                .secure(cookieSecure)
                .path("/api/auth")
                .maxAge(result.refreshExpiresIn())
                .sameSite("Strict")
                .build();

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
}
