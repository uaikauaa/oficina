package com.oficinagestao.fornecedor;

import com.oficinagestao.fornecedor.dto.FornecedorCreateDTO;
import com.oficinagestao.fornecedor.dto.FornecedorResponseDTO;
import com.oficinagestao.fornecedor.dto.FornecedorUpdateDTO;
import org.springframework.stereotype.Component;

@Component
public class FornecedorMapper {

    public Fornecedor toEntity(FornecedorCreateDTO dto) {
        if (dto == null) return null;
        Fornecedor f = new Fornecedor();
        f.setRazaoSocial(dto.razaoSocial().trim());
        f.setNomeFantasia(dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null);
        f.setCnpj(limparDocumento(dto.cnpj()));
        f.setInscricaoEstadual(dto.inscricaoEstadual() != null ? dto.inscricaoEstadual().trim() : null);
        f.setTelefone(dto.telefone() != null ? dto.telefone().trim() : null);
        f.setCelular(dto.celular() != null ? dto.celular().trim() : null);
        f.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        f.setContatoPrincipal(dto.contatoPrincipal() != null ? dto.contatoPrincipal().trim() : null);
        f.setObservacoes(dto.observacoes() != null ? dto.observacoes().trim() : null);
        f.setAtivo(true);
        return f;
    }

    public void updateEntity(Fornecedor f, FornecedorUpdateDTO dto) {
        if (f == null || dto == null) return;
        f.setRazaoSocial(dto.razaoSocial().trim());
        f.setNomeFantasia(dto.nomeFantasia() != null ? dto.nomeFantasia().trim() : null);
        f.setCnpj(limparDocumento(dto.cnpj()));
        f.setInscricaoEstadual(dto.inscricaoEstadual() != null ? dto.inscricaoEstadual().trim() : null);
        f.setTelefone(dto.telefone() != null ? dto.telefone().trim() : null);
        f.setCelular(dto.celular() != null ? dto.celular().trim() : null);
        f.setEmail(dto.email() != null ? dto.email().trim().toLowerCase() : null);
        f.setContatoPrincipal(dto.contatoPrincipal() != null ? dto.contatoPrincipal().trim() : null);
        f.setObservacoes(dto.observacoes() != null ? dto.observacoes().trim() : null);
    }

    public FornecedorResponseDTO toResponseDTO(Fornecedor f) {
        if (f == null) return null;
        return new FornecedorResponseDTO(
                f.getId(),
                f.getRazaoSocial(),
                f.getNomeFantasia(),
                f.getCnpj(),
                f.getInscricaoEstadual(),
                f.getTelefone(),
                f.getCelular(),
                f.getEmail(),
                f.getContatoPrincipal(),
                f.isAtivo(),
                f.getObservacoes(),
                f.getCreatedAt(),
                f.getUpdatedAt()
        );
    }

    private String limparDocumento(String doc) {
        if (doc == null || doc.isBlank()) return null;
        String limpo = doc.replaceAll("\\D", "");
        return limpo.isBlank() ? null : limpo;
    }
}
