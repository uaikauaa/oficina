package com.oficinagestao.security;

import com.oficinagestao.dto.ClienteResponseDTO;
import com.oficinagestao.dto.FornecedorResponseDTO;
import com.oficinagestao.dto.MaquinaResponseDTO;
import com.oficinagestao.dto.PageResponse;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

/** Minimize personal data in the nine catalog reads retained for ROLE_CONSULTA. */
@ControllerAdvice
public class ConsultaResponseRedaction implements ResponseBodyAdvice<Object> {
    @Override public boolean supports(MethodParameter returnType,
                                      Class<? extends HttpMessageConverter<?>> converterType) { return true; }

    @Override public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
                                            Class<? extends HttpMessageConverter<?>> selectedConverterType,
                                            ServerHttpRequest request, ServerHttpResponse response) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities().stream()
                .noneMatch(a -> "ROLE_CONSULTA".equals(a.getAuthority()))
                || auth.getAuthorities().stream().anyMatch(a ->
                    "ROLE_OPERADOR_GERAL".equals(a.getAuthority())
                    || "ROLE_SUPER_ADMIN".equals(a.getAuthority())
                    || "ROLE_ADMIN".equals(a.getAuthority()))) return body;
        if (body instanceof PageResponse<?> page) {
            var content = page.content().stream().map(this::redact).toList();
            return new PageResponse<>(content, page.page(), page.size(), page.totalElements(),
                    page.totalPages(), page.first(), page.last());
        }
        return redact(body);
    }

    private Object redact(Object body) {
        if (body instanceof ClienteResponseDTO c) return new ClienteResponseDTO(c.id(), c.tipoPessoa(),
                c.nomeRazaoSocial(), c.nomeFantasia(), null, null, null, null, null,
                c.ativo(), null, java.util.List.of(), c.totalEquipamentos(), c.createdAt(), c.updatedAt());
        if (body instanceof FornecedorResponseDTO f) return new FornecedorResponseDTO(f.id(), f.razaoSocial(),
                f.nomeFantasia(), null, null, null, null, null, null, f.ativo(), null,
                f.createdAt(), f.updatedAt());
        if (body instanceof MaquinaResponseDTO m) return new MaquinaResponseDTO(m.id(), m.clienteId(),
                null, m.tipoEquipamento(), m.tipoEquipamentoDescricao(), m.marca(), m.modelo(),
                m.anoFabricacao(), null, null, null, null, null, null, m.ativo(),
                m.createdAt(), m.updatedAt());
        return body;
    }
}
