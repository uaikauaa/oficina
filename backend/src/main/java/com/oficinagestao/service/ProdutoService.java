package com.oficinagestao.service;

import com.oficinagestao.dto.CompatibilidadeResponseDTO;
import com.oficinagestao.dto.ProdutoCompatibilidadeDTO;
import com.oficinagestao.dto.ProdutoCreateDTO;
import com.oficinagestao.dto.ProdutoResponseDTO;
import com.oficinagestao.dto.ProdutoUpdateDTO;
import com.oficinagestao.entity.Categoria;
import com.oficinagestao.entity.EstoqueMovimentacao;
import com.oficinagestao.entity.Fornecedor;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.Produto;
import com.oficinagestao.entity.ProdutoMaquina;
import com.oficinagestao.entity.TipoMovimentacaoEstoque;
import com.oficinagestao.entity.TipoProduto;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.exception.BusinessException;
import com.oficinagestao.exception.ConflictException;
import com.oficinagestao.exception.ResourceNotFoundException;
import com.oficinagestao.repository.CategoriaRepository;
import com.oficinagestao.repository.EstoqueMovimentacaoRepository;
import com.oficinagestao.repository.FornecedorRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.ProdutoMaquinaRepository;
import com.oficinagestao.repository.ProdutoRepository;
import com.oficinagestao.repository.UsuarioRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class ProdutoService {

    private final ProdutoRepository produtoRepository;
    private final CategoriaRepository categoriaRepository;
    private final FornecedorRepository fornecedorRepository;
    private final ProdutoMaquinaRepository produtoMaquinaRepository;
    private final MaquinaRepository maquinaRepository;
    private final EstoqueMovimentacaoRepository estoqueMovimentacaoRepository;
    private final UsuarioRepository usuarioRepository;
    private final AuditoriaService auditoriaService;

    public ProdutoService(
            ProdutoRepository produtoRepository,
            CategoriaRepository categoriaRepository,
            FornecedorRepository fornecedorRepository,
            ProdutoMaquinaRepository produtoMaquinaRepository,
            MaquinaRepository maquinaRepository,
            EstoqueMovimentacaoRepository estoqueMovimentacaoRepository,
            UsuarioRepository usuarioRepository,
            AuditoriaService auditoriaService
    ) {
        this.produtoRepository = produtoRepository;
        this.categoriaRepository = categoriaRepository;
        this.fornecedorRepository = fornecedorRepository;
        this.produtoMaquinaRepository = produtoMaquinaRepository;
        this.maquinaRepository = maquinaRepository;
        this.estoqueMovimentacaoRepository = estoqueMovimentacaoRepository;
        this.usuarioRepository = usuarioRepository;
        this.auditoriaService = auditoriaService;
    }

    @Transactional
    public ProdutoResponseDTO cadastrar(ProdutoCreateDTO dto, Long usuarioId, HttpServletRequest request) {
        String codigoLimpo = dto.codigo().trim();
        if (produtoRepository.existsByCodigo(codigoLimpo)) {
            throw new ConflictException("Já existe um produto/peça cadastrado com o código: " + codigoLimpo);
        }

        Categoria categoria = null;
        if (dto.categoriaId() != null) {
            categoria = categoriaRepository.findById(dto.categoriaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + dto.categoriaId()));
        }

        Fornecedor fornecedor = null;
        if (dto.fornecedorId() != null) {
            fornecedor = fornecedorRepository.findById(dto.fornecedorId())
                    .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + dto.fornecedorId()));
        }

        Produto produto = toEntity(dto, categoria, fornecedor);
        Produto salvo = produtoRepository.save(produto);

        if (dto.estoqueInicial() != null && dto.estoqueInicial().compareTo(BigDecimal.ZERO) > 0) {
            Usuario usuario = usuarioId != null ? usuarioRepository.findById(usuarioId).orElse(null) : null;
            EstoqueMovimentacao movInicial = new EstoqueMovimentacao(
                    salvo,
                    usuario,
                    null,
                    TipoMovimentacaoEstoque.ENTRADA,
                    dto.estoqueInicial(),
                    dto.precoCusto(),
                    BigDecimal.ZERO,
                    dto.estoqueInicial(),
                    "Estoque inicial no cadastro do produto"
            );
            estoqueMovimentacaoRepository.save(movInicial);
        }

        auditoriaService.registrarComRequest(
                usuarioId,
                "Produto",
                salvo.getId().toString(),
                "INSERT",
                request
        );

        return toResponseDTO(salvo);
    }

    @Transactional
    public ProdutoResponseDTO atualizar(Long id, ProdutoUpdateDTO dto, Long usuarioId, HttpServletRequest request) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + id));

        String codigoLimpo = dto.codigo().trim();
        if (produtoRepository.existsByCodigoAndIdNot(codigoLimpo, id)) {
            throw new ConflictException("Já existe outro produto/peça cadastrado com o código: " + codigoLimpo);
        }

        Categoria categoria = null;
        if (dto.categoriaId() != null) {
            categoria = categoriaRepository.findById(dto.categoriaId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categoria não encontrada com o ID: " + dto.categoriaId()));
        }

        Fornecedor fornecedor = null;
        if (dto.fornecedorId() != null) {
            fornecedor = fornecedorRepository.findById(dto.fornecedorId())
                    .orElseThrow(() -> new ResourceNotFoundException("Fornecedor não encontrado com o ID: " + dto.fornecedorId()));
        }

        updateEntity(produto, dto, categoria, fornecedor);
        Produto salvo = produtoRepository.save(produto);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Produto",
                salvo.getId().toString(),
                "UPDATE",
                request
        );

        return toResponseDTO(salvo);
    }

    @Transactional(readOnly = true)
    public ProdutoResponseDTO buscarPorId(Long id) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + id));
        return toResponseDTO(produto);
    }

    @Transactional(readOnly = true)
    public Page<ProdutoResponseDTO> listar(
            String termo,
            TipoProduto tipo,
            Long categoriaId,
            Long fornecedorId,
            Boolean ativo,
            Boolean estoqueBaixo,
            Pageable pageable
    ) {
        String termoBusca = (termo != null && !termo.isBlank()) ? termo.trim() : null;
        return produtoRepository.pesquisarGlobal(termoBusca, tipo, categoriaId, fornecedorId, ativo, estoqueBaixo, pageable)
                .map(this::toResponseDTO);
    }

    @Transactional
    public ProdutoResponseDTO alterarStatus(Long id, boolean ativo, Long usuarioId, HttpServletRequest request) {
        Produto produto = produtoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + id));

        produto.setAtivo(ativo);
        Produto salvo = produtoRepository.save(produto);

        auditoriaService.registrarComRequest(
                usuarioId,
                "Produto",
                salvo.getId().toString(),
                "UPDATE",
                request
        );

        return toResponseDTO(salvo);
    }

    // =========================================================================
    // Compatibilidade Peça ↔ Equipamento (produto_maquina)
    // =========================================================================

    @Transactional(readOnly = true)
    public List<CompatibilidadeResponseDTO> listarCompatibilidades(Long produtoId) {
        if (!produtoRepository.existsById(produtoId)) {
            throw new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + produtoId);
        }
        return produtoMaquinaRepository.findByProdutoIdComMaquina(produtoId).stream()
                .map(this::toCompatibilidadeDTO)
                .toList();
    }

    @Transactional
    public CompatibilidadeResponseDTO adicionarCompatibilidade(
            Long produtoId,
            ProdutoCompatibilidadeDTO dto,
            Long usuarioId,
            HttpServletRequest request
    ) {
        Produto produto = produtoRepository.findById(produtoId)
                .orElseThrow(() -> new ResourceNotFoundException("Produto/Peça não encontrado com o ID: " + produtoId));

        Maquina maquina = maquinaRepository.findById(dto.maquinaId())
                .orElseThrow(() -> new ResourceNotFoundException("Equipamento/Máquina não encontrado com o ID: " + dto.maquinaId()));

        if (produtoMaquinaRepository.existsByProdutoIdAndMaquinaId(produtoId, dto.maquinaId())) {
            throw new BusinessException("Esta peça já está cadastrada como compatível com este equipamento.");
        }

        ProdutoMaquina pm = new ProdutoMaquina(produto, maquina, dto.observacaoCompatibilidade());
        ProdutoMaquina salvo = produtoMaquinaRepository.save(pm);

        auditoriaService.registrarComRequest(
                usuarioId,
                "ProdutoMaquina",
                salvo.getId().toString(),
                "INSERT",
                request
        );

        return toCompatibilidadeDTO(salvo);
    }

    @Transactional
    public void removerCompatibilidade(Long produtoId, Long maquinaId, Long usuarioId, HttpServletRequest request) {
        ProdutoMaquina pm = produtoMaquinaRepository.findByProdutoIdAndMaquinaId(produtoId, maquinaId)
                .orElseThrow(() -> new ResourceNotFoundException("Vínculo de compatibilidade não encontrado para o produto " + produtoId + " e máquina " + maquinaId));

        produtoMaquinaRepository.delete(pm);

        auditoriaService.registrarComRequest(
                usuarioId,
                "ProdutoMaquina",
                pm.getId().toString(),
                "DELETE",
                request
        );
    }

    // --- Métodos de Mapeamento Diretos ---

    public Produto toEntity(ProdutoCreateDTO dto, Categoria categoria, Fornecedor fornecedor) {
        if (dto == null) return null;
        Produto p = new Produto();
        p.setCodigo(dto.codigo().trim());
        p.setCodigoBarras(dto.codigoBarras() != null ? dto.codigoBarras().trim() : null);
        p.setNome(dto.nome().trim());
        p.setDescricao(dto.descricao() != null ? dto.descricao().trim() : null);
        p.setMarca(dto.marca() != null ? dto.marca().trim() : null);
        p.setTipo(dto.tipo() != null ? dto.tipo() : TipoProduto.PECA);
        p.setUnidadeMedida(dto.unidadeMedida() != null && !dto.unidadeMedida().isBlank() ? dto.unidadeMedida().trim() : "UN");
        p.setPrecoCusto(dto.precoCusto());
        p.setPrecoVenda(dto.precoVenda());
        p.setMargemLucro(calcularMargemLucro(dto.precoCusto(), dto.precoVenda()));
        p.setEstoqueAtual(dto.estoqueInicial() != null ? dto.estoqueInicial() : BigDecimal.ZERO);
        p.setEstoqueMinimo(dto.estoqueMinimo() != null ? dto.estoqueMinimo() : BigDecimal.ZERO);
        p.setLocalizacao(dto.localizacao() != null ? dto.localizacao().trim() : null);
        p.setCategoria(categoria);
        p.setFornecedor(fornecedor);
        p.setAtivo(true);
        return p;
    }

    public void updateEntity(Produto p, ProdutoUpdateDTO dto, Categoria categoria, Fornecedor fornecedor) {
        if (p == null || dto == null) return;
        p.setCodigo(dto.codigo().trim());
        p.setCodigoBarras(dto.codigoBarras() != null ? dto.codigoBarras().trim() : null);
        p.setNome(dto.nome().trim());
        p.setDescricao(dto.descricao() != null ? dto.descricao().trim() : null);
        p.setMarca(dto.marca() != null ? dto.marca().trim() : null);
        if (dto.tipo() != null) {
            p.setTipo(dto.tipo());
        }
        if (dto.unidadeMedida() != null && !dto.unidadeMedida().isBlank()) {
            p.setUnidadeMedida(dto.unidadeMedida().trim());
        }
        p.setPrecoCusto(dto.precoCusto());
        p.setPrecoVenda(dto.precoVenda());
        p.setMargemLucro(calcularMargemLucro(dto.precoCusto(), dto.precoVenda()));
        if (dto.estoqueMinimo() != null) {
            p.setEstoqueMinimo(dto.estoqueMinimo());
        }
        p.setLocalizacao(dto.localizacao() != null ? dto.localizacao().trim() : null);
        p.setCategoria(categoria);
        p.setFornecedor(fornecedor);
    }

    public ProdutoResponseDTO toResponseDTO(Produto p) {
        if (p == null) return null;
        return new ProdutoResponseDTO(
                p.getId(),
                p.getCodigo(),
                p.getCodigoBarras(),
                p.getNome(),
                p.getDescricao(),
                p.getMarca(),
                p.getTipo().name(),
                p.getTipo().getDescricao(),
                p.getUnidadeMedida(),
                p.getPrecoCusto(),
                p.getPrecoVenda(),
                p.getMargemLucro(),
                p.getEstoqueAtual(),
                p.getEstoqueMinimo(),
                p.getEstoqueMaximo(),
                p.getLocalizacao(),
                p.isAtivo(),
                p.getCategoria() != null ? p.getCategoria().getId() : null,
                p.getCategoria() != null ? p.getCategoria().getNome() : null,
                p.getFornecedor() != null ? p.getFornecedor().getId() : null,
                p.getFornecedor() != null ? p.getFornecedor().getRazaoSocial() : null,
                p.isEstoqueBaixo(),
                p.isSemEstoque(),
                p.getCreatedAt(),
                p.getUpdatedAt()
        );
    }

    public CompatibilidadeResponseDTO toCompatibilidadeDTO(ProdutoMaquina pm) {
        if (pm == null) return null;
        return new CompatibilidadeResponseDTO(
                pm.getId(),
                pm.getMaquina().getId(),
                pm.getMaquina().getTipoEquipamento().name(),
                pm.getMaquina().getMarca(),
                pm.getMaquina().getModelo(),
                pm.getMaquina().getNumeroSerie(),
                pm.getObservacaoCompatibilidade(),
                pm.getCreatedAt()
        );
    }

    private BigDecimal calcularMargemLucro(BigDecimal custo, BigDecimal venda) {
        if (custo == null || venda == null || custo.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return venda.subtract(custo)
                .divide(custo, 4, RoundingMode.HALF_UP)
                .multiply(BigDecimal.valueOf(100))
                .setScale(2, RoundingMode.HALF_UP);
    }
}
