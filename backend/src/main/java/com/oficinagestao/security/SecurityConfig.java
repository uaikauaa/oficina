package com.oficinagestao.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.exception.ApiErrorResponse;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final ObjectMapper objectMapper;
    private final String allowedOrigins;
    private final boolean swaggerEnabled;

    public SecurityConfig(
            JwtAuthenticationFilter jwtAuthenticationFilter,
            ObjectMapper objectMapper,
            @Value("${cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}") String allowedOrigins,
            @Value("${springdoc.swagger-ui.enabled:true}") boolean swaggerEnabled
    ) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.objectMapper = objectMapper;
        this.allowedOrigins = allowedOrigins;
        this.swaggerEnabled = swaggerEnabled;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Justificativa CSRF:
                // 1. Arquitetura SPA/WebApp stateless com Spring Boot REST API
                // 2. Access token transportado via cookie HttpOnly com SameSite=Lax (bloqueia requisições cross-site mutantes)
                // 3. Refresh token (7 dias) transportado via cookie HttpOnly com SameSite=Strict e path restrito (/api/auth)
                // 4. CORS configurado com lista explícita de origens e allowCredentials(true)
                // 5. A ausência de tokens válidos resulta em 401 Unauthorized
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> {
                    // Endpoint de health check público (avaliando conectividade com PostgreSQL)
                    auth.requestMatchers("/api/health").permitAll();

                    // Documentação Swagger / OpenAPI permitida publicamente apenas se habilitada na configuração (PROD001-09)
                    if (swaggerEnabled) {
                        auth.requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll();
                    }

                    // Endpoints de autenticação abertos
                    auth.requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                            .requestMatchers(HttpMethod.POST, "/api/auth/refresh").permitAll()
                            .requestMatchers(HttpMethod.POST, "/api/auth/logout").permitAll()
                            // Qualquer outro endpoint da API exige autenticação com ROLE_ADMIN
                            .requestMatchers("/api/**").hasAuthority("ROLE_ADMIN")
                            .anyRequest().authenticated();
                })
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint((request, response, authException) -> {
                            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            ApiErrorResponse error = ApiErrorResponse.of(
                                    HttpServletResponse.SC_UNAUTHORIZED,
                                    "UNAUTHORIZED",
                                    "Acesso não autorizado. Autenticação necessária.",
                                    request.getRequestURI()
                            );
                            response.getOutputStream().write(objectMapper.writeValueAsBytes(error));
                        })
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            ApiErrorResponse error = ApiErrorResponse.of(
                                    HttpServletResponse.SC_FORBIDDEN,
                                    "FORBIDDEN",
                                    "Acesso negado. Permissão insuficiente.",
                                    request.getRequestURI()
                            );
                            response.getOutputStream().write(objectMapper.writeValueAsBytes(error));
                        })
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.stream(allowedOrigins.split(","))
                .map(String::trim)
                .toList();
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
