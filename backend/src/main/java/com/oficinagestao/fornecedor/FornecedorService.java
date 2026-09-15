package com.oficinagestao.fornecedor;

import com.oficinagestao.auditoria.AuditoriaService;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.fornecedor.dto.FornecedorCreateDTO;
import com.oficinagestao.fornecedor.dto.FornecedorResponseDTO;
import com.oficinagestao.fornecedor.dto.FornecedorUpdateDTO;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FornecedorService {

    private final FornecedorRepository fornecedorRepository;
    private final FornecedorMapper fornecedorMapper;
    private final AuditoriaService auditoriaService;

    public FornecedorService(
            FornecedorRepository fornecedorRepository,
            FornecedorMapper fornecedorMapper,
            AuditoriaService auditoriaService
    ) {
        this.fornecedorRepository = fornecedorRepository;
        this.fornecedorMapper = fornecedorMapper;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public FornecedorResponseDTO cadastrar(FornecedorCreateDTO dto, Long usuarioId, HttpServletRequest request) {
        String cnpjLimpo = dto.cnpj() != null ? dto.cnpj().replaceAll("\\D", "") : null;
        if (cnpjLimpo != null && !cnpjLimpo.isBlank() && fornecedorRepository.existsByCnpj(cnpjLimpo)) {
            throw new BusinessException("Já existe um fornecedor cadastrado com este CNPJ.");
        }

        Fornecedor fornecedor = fornecedorMapper.toEntity(dto);
        Fornecedor salvo = fornecedorRepository.save(fornecedor);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Fornecedor",
                salvo.getId().toString(),
                "INSERT",
                request
        );

        return fornecedorMapper.toResponseDTO(salvo);
    }

    @Transactional
    public FornecedorResponseDTO atualizar(Long id, FornecedorUpdateDTO dto, Long usuarioId, HttpServletRequest request) {
        Fornecedor fornecedor = fornecedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + id));

        String cnpjLimpo = dto.cnpj() != null ? dto.cnpj().replaceAll("\\D", "") : null;
        if (cnpjLimpo != null && !cnpjLimpo.isBlank() && fornecedorRepository.existsByCnpjAndIdNot(cnpjLimpo, id)) {
            throw new BusinessException("Já existe outro fornecedor cadastrado com este CNPJ.");
        }

        fornecedorMapper.updateEntity(fornecedor, dto);
        Fornecedor salvo = fornecedorRepository.save(fornecedor);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Fornecedor",
                salvo.getId().toString(),
                "UPDATE",
                request
        );

        return fornecedorMapper.toResponseDTO(salvo);
    }

    @Transactional(readOnly = true)
    public FornecedorResponseDTO buscarPorId(Long id) {
        Fornecedor fornecedor = fornecedorRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + id));
        return fornecedorMapper.toResponseDTO(fornecedor);
    }

    @Transactional(readOnly = true)
    public Page<FornecedorResponseDTO> listar(String termo, Boolean ativo, Pageable pageable) {
        String termoBusca = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        return fornecedorRepository.pesquisarGlobal(termoBusca, ativo, pageable)
                .map(fornecedorMapper::toResponseDTO);
    }

    @Transactional(readOnly = true)
    public Page<FornecedorResponseDTO> listarAtivos(Pageable pageable) {
        return fornecedorRepository.findByAtivoTrue(pageable)
                .map(fornecedorMapper::toResponseDTO);
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
                ativo ? "ATIVAR" : "INATIVAR",
                request
        );

        return fornecedorMapper.toResponseDTO(salvo);
    }
}
