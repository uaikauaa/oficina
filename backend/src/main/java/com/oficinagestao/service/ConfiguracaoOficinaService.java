package com.oficinagestao.service;

import com.oficinagestao.dto.ConfiguracaoOficinaResponseDTO;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.entity.ConfiguracaoOficina;
import com.oficinagestao.exception.ConfiguracaoOficinaIndisponivelException;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço de gerenciamento da configuração central da oficina.
 *
 * A configuração da oficina é um SINGLETON: existe exatamente um registro.
 * Ela contém os dados comerciais e de contato de referência da oficina.
 *
 * USO NOS DOCUMENTOS:
 * - PDFs da OS, Recibo e Documento de Serviço utilizam nomeFantasia, telefone, email, etc.
 * - Mensagens de WhatsApp utilizam nomeFantasia como fallback.
 */
@Service
@Transactional(readOnly = true)
public class ConfiguracaoOficinaService {

    private final ConfiguracaoOficinaRepository repository;

    public ConfiguracaoOficinaService(ConfiguracaoOficinaRepository repository) {
        this.repository = repository;
    }

    /**
     * Retorna somente a configuração persistida da oficina.
     */
    public ConfiguracaoOficinaResponseDTO obter() {
        ConfiguracaoOficina config = obterEntidade();
        return toResponseDTO(config);
    }

    /**
     * Retorna a entidade de configuração para uso interno (ex: PdfService).
     * O cadastro inicial pertence às migrations. Ausência ou duplicidade exige
     * investigação e recuperação administrativa, sem recriação automática.
     */
    public ConfiguracaoOficina obterEntidade() {
        // Até duas linhas bastam para verificar o singleton sem escolher uma
        // configuração arbitrária caso a restrição de integridade seja violada.
        var configuracoes = repository.findAll(PageRequest.of(0, 2, Sort.by("id"))).getContent();
        if (configuracoes.isEmpty()) {
            throw new ConfiguracaoOficinaIndisponivelException();
        }
        if (configuracoes.size() != 1) {
            throw ConfiguracaoOficinaIndisponivelException.cadastroDuplicado();
        }
        return configuracoes.getFirst();
    }

    /**
     * Atualiza os dados da configuração da oficina.
     * Operação restrita a ROLE_ADMIN.
     */
    @Transactional
    public ConfiguracaoOficinaResponseDTO atualizar(ConfiguracaoOficinaUpdateDTO dto) {
        ConfiguracaoOficina config = obterEntidade();

        config.setNomeFantasia(dto.nomeFantasia().trim());

        if (dto.nomeEmpresarial() != null) {
            config.setNomeEmpresarial(dto.nomeEmpresarial().isBlank() ? null : dto.nomeEmpresarial().trim());
        }
        if (dto.cnpj() != null) {
            config.setCnpj(dto.cnpj().isBlank() ? null : dto.cnpj().trim());
        }
        if (dto.responsavel() != null) {
            config.setResponsavel(dto.responsavel().isBlank() ? null : dto.responsavel().trim());
        }
        if (dto.telefone() != null) {
            config.setTelefone(dto.telefone().isBlank() ? null : dto.telefone().trim());
        }
        if (dto.email() != null) {
            config.setEmail(dto.email().isBlank() ? null : dto.email().trim());
        }
        if (dto.logradouro() != null) {
            config.setLogradouro(dto.logradouro().isBlank() ? null : dto.logradouro().trim());
        }
        if (dto.numero() != null) {
            config.setNumero(dto.numero().isBlank() ? null : dto.numero().trim());
        }
        if (dto.bairro() != null) {
            config.setBairro(dto.bairro().isBlank() ? null : dto.bairro().trim());
        }
        if (dto.cep() != null) {
            config.setCep(dto.cep().isBlank() ? null : dto.cep().trim());
        }
        if (dto.municipio() != null) {
            config.setMunicipio(dto.municipio().isBlank() ? null : dto.municipio().trim());
        }
        if (dto.uf() != null) {
            config.setUf(dto.uf().isBlank() ? null : dto.uf().trim().toUpperCase());
        }

        ConfiguracaoOficina salvo = repository.save(config);
        return toResponseDTO(salvo);
    }

    // --- Mapeamento ---

    private ConfiguracaoOficinaResponseDTO toResponseDTO(ConfiguracaoOficina c) {
        return new ConfiguracaoOficinaResponseDTO(
                c.getId(),
                c.getNomeSistema(),
                c.getNomeFantasia(),
                c.getNomeEmpresarial(),
                c.getCnpj(),
                c.getResponsavel(),
                c.getTelefone(),
                c.getEmail(),
                c.getLogradouro(),
                c.getNumero(),
                c.getBairro(),
                c.getCep(),
                c.getMunicipio(),
                c.getUf(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
