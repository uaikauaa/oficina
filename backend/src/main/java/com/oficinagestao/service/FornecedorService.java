package com.oficinagestao.service;

import com.oficinagestao.dto.FornecedorCreateDTO;
import com.oficinagestao.dto.FornecedorResponseDTO;
import com.oficinagestao.dto.FornecedorUpdateDTO;
import com.oficinagestao.entity.Fornecedor;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.FornecedorRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FornecedorService {

    private final FornecedorRepository fornecedorRepository;
    private final AuditoriaService auditoriaService;

    public FornecedorService(
            FornecedorRepository fornecedorRepository,
            AuditoriaService auditoriaService
    ) {
        this.fornecedorRepository = fornecedorRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public FornecedorResponseDTO cadastrar(FornecedorCreateDTO dto, Long usuarioId, HttpServletRequest request) {
        String cnpjLimpo = dto.cnpj() != null ? dto.cnpj().replaceAll("\\D", "") : null;
        if (cnpjLimpo != null && !cnpjLimpo.isBlank() && fornecedorRepository.existsByCnpj(cnpjLimpo)) {
            throw new BusinessException("Já existe um fornecedor cadastrado com este CNPJ.");
        }

        Fornecedor fornecedor = toEntity(dto);
        Fornecedor salvo = fornecedorRepository.save(fornecedor);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Fornecedor",
                salvo.getId().toString(),
                "INSERT",
                request
        );

        return toResponseDTO(salvo);
    }

    @Transactional
    public FornecedorResponseDTO atualizar(Long id, FornecedorUpdateDTO dto, Long usuarioId, HttpServletRequest request) {
        Fornecedor fornecedor = fornecedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + id));

        String cnpjLimpo = dto.cnpj() != null ? dto.cnpj().replaceAll("\\D", "") : null;
        if (cnpjLimpo != null && !cnpjLimpo.isBlank() && fornecedorRepository.existsByCnpjAndIdNot(cnpjLimpo, id)) {
            throw new BusinessException("Já existe outro fornecedor cadastrado com este CNPJ.");
        }

        updateEntity(fornecedor, dto);
        Fornecedor salvo = fornecedorRepository.save(fornecedor);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Fornecedor",
                salvo.getId().toString(),
                "UPDATE",
                request
        );

        return toResponseDTO(salvo);
    }

    @Transactional(readOnly = true)
    public FornecedorResponseDTO buscarPorId(Long id) {
        Fornecedor fornecedor = fornecedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + id));
        return toResponseDTO(fornecedor);
    }

    @Transactional(readOnly = true)
    public Page<FornecedorResponseDTO> listar(String termo, Boolean ativo, Pageable pageable) {
        String termoBusca = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        return fornecedorRepository.pesquisarGlobal(termoBusca, ativo, pageable)
                .map(this::toResponseDTO);
    }

    @Transactional(readOnly = true)
    public Page<FornecedorResponseDTO> listarAtivos(Pageable pageable) {
        return fornecedorRepository.findByAtivoTrue(pageable)
                .map(this::toResponseDTO);
    }

    @Transactional
    public FornecedorResponseDTO alterarStatus(Long id, boolean ativo, Long usuarioId, HttpServletRequest request) {
        Fornecedor fornecedor = fornecedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + id));

        fornecedor.setAtivo(ativo);
        Fornecedor salvo = fornecedorRepository.save(fornecedor);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Fornecedor",
                salvo.getId().toString(),
                "UPDATE",
                request
        );

        return toResponseDTO(salvo);
    }

    // --- Métodos de Mapeamento Diretos ---

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
