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
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.stream.Collectors;

@Service
public class AuthService {

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final AuditoriaRepository auditoriaRepository;

    public AuthService(
            UsuarioRepository usuarioRepository,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            AuditoriaRepository auditoriaRepository
    ) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.auditoriaRepository = auditoriaRepository;
    }

    @Transactional
    public AuthResponse login(LoginRequest request, HttpServletRequest httpRequest) {
        String email = request.email() != null ? request.email().trim().toLowerCase() : "";
        Usuario usuario = usuarioRepository.findByEmail(email).orElse(null);

        // Prevenção contra enumeração de usuários: tempo e mensagem uniformes
        if (usuario == null || !passwordEncoder.matches(request.senha(), usuario.getSenha())) {
            throw new BadCredentialsException("Credenciais inválidas.");
        }

        if (!Boolean.TRUE.equals(usuario.getAtivo())) {
            throw new DisabledException("Conta de usuário inativa.");
        }

        // Registrar auditoria de LOGIN
        String ipOrigem = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
        auditoriaRepository.save(new Auditoria(
                usuario.getId(),
                "Usuario",
                usuario.getId().toString(),
                "LOGIN",
                ipOrigem
        ));

        String token = jwtService.generateToken(usuario);
        Set<String> roles = usuario.getRoles().stream()
                .map(Role::getNome)
                .collect(Collectors.toSet());

        CurrentUserResponse userResponse = new CurrentUserResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                roles
        );

        return new AuthResponse(
                token,
                "Bearer",
                jwtService.getExpirationMs() / 1000,
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
    public void logout(String email, HttpServletRequest httpRequest) {
        if (email != null && !email.isBlank()) {
            usuarioRepository.findByEmail(email).ifPresent(usuario -> {
                String ipOrigem = httpRequest != null ? httpRequest.getRemoteAddr() : "127.0.0.1";
                auditoriaRepository.save(new Auditoria(
                        usuario.getId(),
                        "Usuario",
                        usuario.getId().toString(),
                        "LOGOUT",
                        ipOrigem
                ));
            });
        }
    }
}
