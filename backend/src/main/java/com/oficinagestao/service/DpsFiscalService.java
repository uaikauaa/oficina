package com.oficinagestao.service;

import com.oficinagestao.dto.DpsFiscalCreateDTO;
import com.oficinagestao.dto.DpsFiscalResponseDTO;
import com.oficinagestao.entity.*;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.DpsFiscalRepository;
import com.oficinagestao.repository.DpsNumeracaoRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

@Service
@Transactional(readOnly = true)
public class DpsFiscalService {

    public static final String SERIE_PADRAO = "1";

    private final DpsFiscalRepository dpsFiscalRepository;
    private final DpsNumeracaoRepository dpsNumeracaoRepository;
    private final OrdemServicoRepository ordemServicoRepository;
    private final ClienteRepository clienteRepository;
    private final ConfiguracaoOficinaService configuracaoOficinaService;
    private final AuditoriaService auditoriaService;

    public DpsFiscalService(
            DpsFiscalRepository dpsFiscalRepository,
            DpsNumeracaoRepository dpsNumeracaoRepository,
            OrdemServicoRepository ordemServicoRepository,
            ClienteRepository clienteRepository,
            ConfiguracaoOficinaService configuracaoOficinaService,
            AuditoriaService auditoriaService
    ) {
        this.dpsFiscalRepository = dpsFiscalRepository;
        this.dpsNumeracaoRepository = dpsNumeracaoRepository;
        this.ordemServicoRepository = ordemServicoRepository;
        this.clienteRepository = clienteRepository;
        this.configuracaoOficinaService = configuracaoOficinaService;
        this.auditoriaService = auditoriaService;
    }

    /**
     * Prepara a Declaração de Prestação de Serviços (DPS) para futura emissão da NFS-e.
     *
     * Regras:
     * 1. A OS deve existir e pertencer a um cliente cadastrado.
     * 2. A numeração é alocada de maneira sequencial com lock pessimista na série.
     * 3. É registrado um snapshot imutável dos dados cadastrais do prestador e tomador.
     * 4. A DPS é gravada com status PREPARADA.
     * 5. NENHUMA transmissão fiscal real é realizada nesta fase.
     */
    @Transactional
    public DpsFiscalResponseDTO prepararDps(DpsFiscalCreateDTO dto, Long usuarioId, String ipOrigem) {
        if (dto.ordemServicoId() == null) {
            throw new BusinessException("ID da Ordem de Serviço é obrigatório.");
        }

        OrdemServico os = ordemServicoRepository.findById(dto.ordemServicoId())
                .orElseThrow(() -> new ResourceNotFoundException("Ordem de Serviço não encontrada com ID: " + dto.ordemServicoId()));

        Cliente cliente = clienteRepository.findByIdWithEnderecos(os.getCliente().getId())
                .orElse(os.getCliente());

        ConfiguracaoOficina prestador = configuracaoOficinaService.obterEntidade();

        // Determinação do valor dos serviços (mão de obra técnica da OS)
        BigDecimal valorServico = os.getValorMaoObra();
        if (valorServico == null || valorServico.compareTo(BigDecimal.ZERO) <= 0) {
            // Se valor de mão de obra não estiver preenchido, usa o valor total caso positivo
            if (os.getValorTotal() != null && os.getValorTotal().compareTo(BigDecimal.ZERO) > 0) {
                valorServico = os.getValorTotal();
            } else {
                throw new BusinessException("A Ordem de Serviço deve possuir valor de serviço superior a zero para preparação da DPS.");
            }
        }

        // Definição da série
        String serie = (dto.serie() != null && !dto.serie().isBlank()) ? dto.serie().trim() : SERIE_PADRAO;

        // Alocação atômica e segura do próximo número sequencial via lock pessimista
        DpsNumeracao numeracao = dpsNumeracaoRepository.findBySerieWithLock(serie)
                .orElseGet(() -> dpsNumeracaoRepository.save(new DpsNumeracao(serie, 0L)));

        long novoNumero = numeracao.getUltimoNumero() + 1;
        numeracao.setUltimoNumero(novoNumero);
        dpsNumeracaoRepository.save(numeracao);

        // Montagem do documento DPS
        DpsFiscal dps = new DpsFiscal();
        dps.setOrdemServico(os);
        dps.setCliente(cliente);
        dps.setSerie(serie);
        dps.setNumero(novoNumero);
        dps.setStatus(StatusDpsFiscal.PREPARADA);
        dps.setDataEmissao(OffsetDateTime.now());
        dps.setValorServico(valorServico);

        String codTrib = prestador.getCodigoTributacaoServico();
        dps.setCodigoTributacaoServico((codTrib != null && !codTrib.isBlank()) ? codTrib.trim() : "14.01.01");

        String descricao = (dto.descricaoServico() != null && !dto.descricaoServico().isBlank())
                ? dto.descricaoServico().trim()
                : extrairDescricaoServico(os);
        dps.setDescricaoServico(descricao);

        dps.setMunicipioPrestacao(prestador.getMunicipio());
        dps.setCodigoIbgePrestacao(prestador.getCodigoIbge());

        // Snapshot Prestador
        dps.setPrestadorCnpj(prestador.getCnpj());
        dps.setPrestadorRazaoSocial(prestador.getNomeEmpresarial());
        dps.setPrestadorNomeFantasia(prestador.getNomeFantasia());
        dps.setPrestadorInscricaoMunicipal(prestador.getInscricaoMunicipal());
        dps.setPrestadorRegimeTributario(prestador.getRegimeTributario());
        dps.setPrestadorLogradouro(prestador.getLogradouro());
        dps.setPrestadorNumero(prestador.getNumero());
        dps.setPrestadorBairro(prestador.getBairro());
        dps.setPrestadorCep(prestador.getCep());
        dps.setPrestadorMunicipio(prestador.getMunicipio());
        dps.setPrestadorUf(prestador.getUf());
        dps.setPrestadorCodigoIbge(prestador.getCodigoIbge());

        // Snapshot Tomador
        dps.setTomadorTipoPessoa(cliente.getTipoPessoa() != null ? cliente.getTipoPessoa().name() : null);
        dps.setTomadorCpfCnpj(cliente.getCpfCnpj());
        dps.setTomadorRazaoSocial(cliente.getNomeRazaoSocial());
        dps.setTomadorNomeFantasia(cliente.getNomeFantasia());
        dps.setTomadorRgIe(cliente.getRgIe());
        dps.setTomadorEmail(cliente.getEmail());
        dps.setTomadorTelefone(cliente.getCelular() != null ? cliente.getCelular() : cliente.getTelefone());
        dps.setTomadorCodigoIbge(cliente.getCodigoIbge());

        if (cliente.getEnderecos() != null && !cliente.getEnderecos().isEmpty()) {
            Endereco end = cliente.getEnderecos().stream()
                    .filter(e -> e.getTipoEndereco() == TipoEndereco.PRINCIPAL)
                    .findFirst()
                    .orElse(cliente.getEnderecos().get(0));

            dps.setTomadorLogradouro(end.getLogradouro());
            dps.setTomadorNumero(end.getNumero());
            dps.setTomadorComplemento(end.getComplemento());
            dps.setTomadorBairro(end.getBairro());
            dps.setTomadorCidade(end.getCidade());
            dps.setTomadorUf(end.getEstado());
            dps.setTomadorCep(end.getCep());
        }

        dps.setUsuarioPreparacaoId(usuarioId);

        DpsFiscal salva = dpsFiscalRepository.save(dps);

        if (usuarioId != null) {
            auditoriaService.registrar(
                    usuarioId,
                    "DpsFiscal",
                    String.valueOf(salva.getId()),
                    "INSERT",
                    ipOrigem != null ? ipOrigem : "127.0.0.1"
            );
        }

        return toResponseDTO(salva);
    }

    public DpsFiscalResponseDTO obterPorId(Long id) {
        DpsFiscal dps = dpsFiscalRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("DPS não encontrada com ID: " + id));
        return toResponseDTO(dps);
    }

    public DpsFiscalResponseDTO obterPorOrdemServicoId(Long ordemServicoId) {
        DpsFiscal dps = dpsFiscalRepository.findTopByOrdemServicoIdOrderByDataEmissaoDesc(ordemServicoId)
                .orElseThrow(() -> new ResourceNotFoundException("Nenhuma DPS encontrada para a Ordem de Serviço ID: " + ordemServicoId));
        return toResponseDTO(dps);
    }

    public List<DpsFiscalResponseDTO> listarPorOrdemServico(Long ordemServicoId) {
        return dpsFiscalRepository.findByOrdemServicoIdOrderByDataEmissaoDesc(ordemServicoId)
                .stream()
                .map(this::toResponseDTO)
                .toList();
    }

    public Page<DpsFiscalResponseDTO> listar(Pageable pageable) {
        return dpsFiscalRepository.findAllByOrderByDataEmissaoDesc(pageable)
                .map(this::toResponseDTO);
    }

    private String extrairDescricaoServico(OrdemServico os) {
        StringBuilder sb = new StringBuilder();
        sb.append("Serviços técnicos de manutenção e reparo prestados na Ordem de Serviço ").append(os.getNumeroOs());
        if (os.getMaquina() != null) {
            sb.append(" no equipamento ").append(os.getMaquina().getTipoEquipamento() != null ? os.getMaquina().getTipoEquipamento().name() : "EQUIPAMENTO");
            if (os.getMaquina().getModelo() != null && !os.getMaquina().getModelo().isBlank()) {
                sb.append(" ").append(os.getMaquina().getModelo().trim());
            }
            if (os.getMaquina().getMarca() != null && !os.getMaquina().getMarca().isBlank()) {
                sb.append(" (").append(os.getMaquina().getMarca().trim()).append(")");
            }
        }
        if (os.getSolucaoAplicada() != null && !os.getSolucaoAplicada().isBlank()) {
            sb.append(". Solução técnica: ").append(os.getSolucaoAplicada().trim());
        } else if (os.getDiagnostico() != null && !os.getDiagnostico().isBlank()) {
            sb.append(". Diagnóstico: ").append(os.getDiagnostico().trim());
        } else if (os.getProblemaRelatado() != null && !os.getProblemaRelatado().isBlank()) {
            sb.append(". Defeito relatado: ").append(os.getProblemaRelatado().trim());
        }
        return sb.toString();
    }

    public DpsFiscalResponseDTO toResponseDTO(DpsFiscal dps) {
        if (dps == null) {
            return null;
        }
        return new DpsFiscalResponseDTO(
                dps.getId(),
                dps.getOrdemServico() != null ? dps.getOrdemServico().getId() : null,
                dps.getOrdemServico() != null ? dps.getOrdemServico().getNumeroOs() : null,
                dps.getCliente() != null ? dps.getCliente().getId() : null,
                dps.getSerie(),
                dps.getNumero(),
                dps.getStatus(),
                dps.getDataEmissao(),
                dps.getValorServico(),
                dps.getCodigoTributacaoServico(),
                dps.getDescricaoServico(),
                dps.getMunicipioPrestacao(),
                dps.getCodigoIbgePrestacao(),

                // Prestador
                dps.getPrestadorCnpj(),
                dps.getPrestadorRazaoSocial(),
                dps.getPrestadorNomeFantasia(),
                dps.getPrestadorInscricaoMunicipal(),
                dps.getPrestadorRegimeTributario(),
                dps.getPrestadorLogradouro(),
                dps.getPrestadorNumero(),
                dps.getPrestadorBairro(),
                dps.getPrestadorCep(),
                dps.getPrestadorMunicipio(),
                dps.getPrestadorUf(),
                dps.getPrestadorCodigoIbge(),

                // Tomador
                dps.getTomadorTipoPessoa(),
                dps.getTomadorCpfCnpj(),
                dps.getTomadorRazaoSocial(),
                dps.getTomadorNomeFantasia(),
                dps.getTomadorRgIe(),
                dps.getTomadorEmail(),
                dps.getTomadorTelefone(),
                dps.getTomadorLogradouro(),
                dps.getTomadorNumero(),
                dps.getTomadorComplemento(),
                dps.getTomadorBairro(),
                dps.getTomadorCidade(),
                dps.getTomadorUf(),
                dps.getTomadorCep(),
                dps.getTomadorCodigoIbge(),

                // NFS-e retorno
                dps.getNumeroNfse(),
                dps.getChaveAcessoNfse(),
                dps.getXmlAutorizado(),
                dps.getMensagensRetorno(),

                // IBS / CBS
                dps.getAliquotaIbs(),
                dps.getValorIbs(),
                dps.getAliquotaCbs(),
                dps.getValorCbs(),
                dps.getCodigoTributacaoIbsCbs(),

                dps.getUsuarioPreparacaoId(),
                dps.getCreatedAt(),
                dps.getUpdatedAt()
        );
    }
}
