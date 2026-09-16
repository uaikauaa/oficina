package com.oficinagestao.service;

import com.oficinagestao.dto.CategoriaCreateDTO;
import com.oficinagestao.dto.CategoriaResponseDTO;
import com.oficinagestao.dto.CategoriaUpdateDTO;
import com.oficinagestao.entity.Categoria;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.CategoriaRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class CategoriaService {

    private final CategoriaRepository categoriaRepository;
    private final AuditoriaService auditoriaService;

    public CategoriaService(CategoriaRepository categoriaRepository, AuditoriaService auditoriaService) {
        this.categoriaRepository = categoriaRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public CategoriaResponseDTO cadastrar(CategoriaCreateDTO dto, Long usuarioId, HttpServletRequest request) {
        String nomeLimpo = dto.nome().trim();
        if (categoriaRepository.existsByNomeIgnoreCase(nomeLimpo)) {
            throw new ConflictException("Já existe uma categoria cadastrada com o nome: " + nomeLimpo);
        }

        Categoria categoria = new Categoria(
                nomeLimpo,
                dto.descricao() != null ? dto.descricao().trim() : null
        );
        Categoria salva = categoriaRepository.save(categoria);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Categoria",
                salva.getId().toString(),
                "INSERT",
                request
        );

        return toResponseDTO(salva);
    }

    @Transactional
    public CategoriaResponseDTO atualizar(Long id, CategoriaUpdateDTO dto, Long usuarioId, HttpServletRequest request) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + id));

        String nomeLimpo = dto.nome().trim();
        if (categoriaRepository.existsByNomeIgnoreCaseAndIdNot(nomeLimpo, id)) {
            throw new ConflictException("Já existe outra categoria cadastrada com o nome: " + nomeLimpo);
        }

        categoria.setNome(nomeLimpo);
        categoria.setDescricao(dto.descricao() != null ? dto.descricao().trim() : null);

        Categoria salva = categoriaRepository.save(categoria);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Categoria",
                salva.getId().toString(),
                "UPDATE",
                request
        );

        return toResponseDTO(salva);
    }

    @Transactional(readOnly = true)
    public CategoriaResponseDTO buscarPorId(Long id) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + id));
        return toResponseDTO(categoria);
    }

    @Transactional(readOnly = true)
    public Page<CategoriaResponseDTO> listar(String termo, Boolean ativo, Pageable pageable) {
        String termoBusca = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        return categoriaRepository.pesquisar(termoBusca, ativo, pageable)
                .map(this::toResponseDTO);
    }

    @Transactional(readOnly = true)
    public List<CategoriaResponseDTO> listarAtivas() {
        return categoriaRepository.findByAtivoTrueOrderByNomeAsc().stream()
                .map(this::toResponseDTO)
                .toList();
    }

    @Transactional
    public CategoriaResponseDTO alterarStatus(Long id, boolean ativo, Long usuarioId, HttpServletRequest request) {
        Categoria categoria = categoriaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + id));

        categoria.setAtivo(ativo);
        Categoria salva = categoriaRepository.save(categoria);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Categoria",
                salva.getId().toString(),
                ativo ? "ATIVAR" : "INATIVAR",
                request
        );

        return toResponseDTO(salva);
    }

    public CategoriaResponseDTO toResponseDTO(Categoria c) {
        if (c == null) return null;
        return new CategoriaResponseDTO(
                c.getId(),
                c.getNome(),
                c.getDescricao(),
                c.isAtivo(),
                c.getCreatedAt(),
                c.getUpdatedAt()
        );
    }
}
