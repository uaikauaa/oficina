package com.oficinagestao.config;

import com.oficinagestao.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.Set;

/** Bounds attacker-controlled property paths before Spring Data argument resolution. */
@Configuration
public class BoundedSortConfiguration implements WebMvcConfigurer {
    private static final Set<String> FIELDS = Set.of("id", "nome", "razaoSocial", "nomeFantasia",
            "nomeRazaoSocial", "marca", "modelo", "numeroSerie", "status", "ativo", "dataEntrada",
            "previsaoConclusao", "dataConclusao", "numeroOs", "dataMovimentacao", "tipoMovimentacao",
            "quantidade", "valorTotal", "precoVenda", "precoCusto", "estoqueAtual", "estoqueMinimo",
            "codigoInterno", "codigoBarras", "dataCadastro", "criadoEm", "atualizadoEm");

    @Override public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
                String[] sorts = request.getParameterValues("sort");
                if (sorts == null) return true;
                if (sorts.length > 3) throw invalid();
                for (String sort : sorts) {
                    if (sort.length() > 64) throw invalid();
                    String[] parts = sort.split(",", -1);
                    if (parts.length > 2 || !FIELDS.contains(parts[0]) || (parts.length == 2
                            && !"asc".equalsIgnoreCase(parts[1]) && !"desc".equalsIgnoreCase(parts[1]))) throw invalid();
                }
                return true;
            }
        }).addPathPatterns("/api/**");
    }

    private static BusinessException invalid() {
        return new BusinessException("Ordenacao invalida: use ate tres campos simples permitidos, com asc ou desc.");
    }
}
