package com.oficinagestao.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        final String cookieAuth = "cookieAuth";
        final String bearerAuth = "bearerAuth";

        return new OpenAPI()
                .info(new Info()
                        .title("Oficina Gestão API")
                        .description("API REST para o sistema de gestão e operação de oficinas mecânicas.")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Suporte Oficina Gestão")
                                .email("contato@oficinagestao.com.br"))
                        .license(new License()
                                .name("Proprietária - Uso Exclusivo")
                                .url("https://github.com/uaikauaa/oficina")))
                .addSecurityItem(new SecurityRequirement().addList(cookieAuth).addList(bearerAuth))
                .components(new Components()
                        .addSecuritySchemes(cookieAuth, new SecurityScheme()
                                .name("access_token")
                                .type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE)
                                .description("Cookie HttpOnly seguro contendo o JWT de acesso da sessão (`access_token`)."))
                        .addSecuritySchemes(bearerAuth, new SecurityScheme()
                                .name("Authorization")
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")
                                .description("Cabeçalho HTTP `Authorization: Bearer <token>` para clientes de API.")));
    }
}
