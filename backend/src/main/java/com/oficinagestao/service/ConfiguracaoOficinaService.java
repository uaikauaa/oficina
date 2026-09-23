package com.oficinagestao.service;

import com.oficinagestao.dto.ConfiguracaoOficinaResponseDTO;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.entity.ConfiguracaoOficina;
import com.oficinagestao.repository.ConfiguracaoOficinaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Serviço de gerenciamento da configuração central da oficina.
 *
 * A configuração da oficina é um SINGLETON: existe exatamente um registro.
 * Ela contém os dados comerciais e fiscais de referência da oficina.
 *
 * USO NOS DOCUMENTOS:
 * - PDFs da OS e Documento de Serviço utilizam nomeFantasia, telefone, email, etc.
 * - Mensagens de WhatsApp utilizam nomeFantasia como fallback.
 *
 * PREPARAÇÃO PARA NFS-e:
 * - Os campos fiscais (cnpj, inscricaoMunicipal, regime, codigoTributacao, codigoIbge)
 *   ficam disponíveis para futura integração com emissor oficial de NFS-e.
 * - NÃO são calculados nem validados tributariamente pelo sistema.
 */
@Service
@Transactional(readOnly = true)
public class ConfiguracaoOficinaService {

    private final ConfiguracaoOficinaRepository repository;

    public ConfiguracaoOficinaService(ConfiguracaoOficinaRepository repository) {
        this.repository = repository;
    }

    /**
     * Retorna a configuração atual da oficina.
     * Garante que os dados da Bruno Soldas estejam presentes.
     */
    @Transactional
    public ConfiguracaoOficinaResponseDTO obter() {
        ConfiguracaoOficina config = obterEntidade();
        return toResponseDTO(config);
    }

    /**
     * Retorna a entidade de configuração para uso interno (ex: PdfService).
     * Se ainda não existir no banco, cria e persiste a configuração padrão
     * oficial da Bruno Soldas (auto-seeding / auto-healing), eliminando qualquer risco de 404.
     */
    @Transactional
    public ConfiguracaoOficina obterEntidade() {
        return repository.findFirstByOrderByIdAsc()
                .orElseGet(() -> repository.save(criarConfiguracaoPadrao()));
    }

    public static ConfiguracaoOficina criarConfiguracaoPadrao() {
        return new ConfiguracaoOficina(
                "Oficina Gestão",
                "Bruno Soldas",
                "45.076.507 BRUNO SOARES RODRIGUES",
                "45.076.507/0001-67",
                null,
                "Simples Nacional / MEI",
                "14.01.01",
                "Geisa",
                "(14) 9886-7223",
                "INDUTECSERVICE@HOTMAIL.COM",
                "Avenida Jacinto Ferreira de Sá - de 1272/1273 ao fim",
                "1538",
                "Vila Sandano",
                "19.914-080",
                "Ourinhos",
                "SP",
                "35.34708"
        );
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
        if (dto.inscricaoMunicipal() != null) {
            config.setInscricaoMunicipal(dto.inscricaoMunicipal().isBlank() ? null : dto.inscricaoMunicipal().trim());
        }
        if (dto.regimeTributario() != null) {
            config.setRegimeTributario(dto.regimeTributario().isBlank() ? null : dto.regimeTributario().trim());
        }
        if (dto.codigoTributacaoServico() != null) {
            config.setCodigoTributacaoServico(dto.codigoTributacaoServico().isBlank() ? null : dto.codigoTributacaoServico().trim());
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
        if (dto.codigoIbge() != null) {
            config.setCodigoIbge(dto.codigoIbge().isBlank() ? null : dto.codigoIbge().trim());
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
                c.getInscricaoMunicipal(),
                c.getRegimeTributario(),
                c.getCodigoTributacaoServico(),
                c.getResponsavel(),
                c.getTelefone(),
                c.getEmail(),
                c.getLogradouro(),
                c.getNumero(),
                c.getBairro(),
                c.getCep(),
                c.getMunicipio(),
                c.getUf(),
                c.getCodigoIbge(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
