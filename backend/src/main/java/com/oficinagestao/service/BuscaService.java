package com.oficinagestao.service;

import com.oficinagestao.dto.BuscaRapidaDTO;
import com.oficinagestao.dto.BuscaRapidaDTO.ItemBuscaDTO;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import com.oficinagestao.repository.ProdutoRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;

@Service
public class BuscaService {

    private final ClienteRepository clienteRepository;
    private final MaquinaRepository maquinaRepository;
    private final OrdemServicoRepository ordemServicoRepository;
    private final ProdutoRepository produtoRepository;

    public BuscaService(
            ClienteRepository clienteRepository,
            MaquinaRepository maquinaRepository,
            OrdemServicoRepository ordemServicoRepository,
            ProdutoRepository produtoRepository
    ) {
        this.clienteRepository = clienteRepository;
        this.maquinaRepository = maquinaRepository;
        this.ordemServicoRepository = ordemServicoRepository;
        this.produtoRepository = produtoRepository;
    }

    @Transactional(readOnly = true)
    public BuscaRapidaDTO buscarRapida(String termo) {
        if (termo == null || termo.trim().isEmpty()) {
            return new BuscaRapidaDTO(
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList(),
                    Collections.emptyList(),
                    0
            );
        }

        String t = termo.trim();

        // 1. Clientes (top 5)
        List<ItemBuscaDTO> clientes = clienteRepository.buscarRapida(t, PageRequest.of(0, 5, Sort.by("nomeRazaoSocial").ascending()))
                .stream()
                .map(c -> {
                    String docLabel = c.getTipoPessoa() == TipoPessoa.JURIDICA ? "CNPJ: " : "CPF: ";
                    String doc = c.getCpfCnpj() != null ? c.getCpfCnpj() : "-";
                    String contato = c.getCelular() != null ? " • " + c.getCelular() : (c.getTelefone() != null ? " • " + c.getTelefone() : "");
                    return new ItemBuscaDTO(
                            c.getId(),
                            c.getNomeRazaoSocial(),
                            docLabel + doc + contato,
                            c.getTipoPessoa() == TipoPessoa.JURIDICA ? "PJ" : "PF",
                            "/clientes/" + c.getId()
                    );
                })
                .toList();

        // 2. Equipamentos (top 5)
        List<ItemBuscaDTO> maquinas = maquinaRepository.buscarRapida(t, PageRequest.of(0, 5, Sort.by("marca").ascending()))
                .stream()
                .map(m -> {
                    String tipoDesc = m.getTipoEquipamento() != null ? m.getTipoEquipamento().getDescricao() : "Equipamento";
                    String serie = m.getNumeroSerie() != null ? " • S/N: " + m.getNumeroSerie() : "";
                    String clienteNome = m.getCliente() != null ? " • " + m.getCliente().getNomeRazaoSocial() : "";
                    return new ItemBuscaDTO(
                            m.getId(),
                            m.getMarca() + " " + m.getModelo(),
                            tipoDesc + serie + clienteNome,
                            m.getTipoEquipamento() != null ? m.getTipoEquipamento().name() : "EQUIPAMENTO",
                            "/maquinas/" + m.getId()
                    );
                })
                .toList();

        // 3. Ordens de Serviço (top 5)
        List<ItemBuscaDTO> ordensServico = ordemServicoRepository.buscarRapidaOs(t, PageRequest.of(0, 5, Sort.by("dataEntrada").descending()))
                .stream()
                .map(os -> {
                    String statusDesc = os.getStatus() != null ? os.getStatus().getDescricao() : "";
                    String cli = os.getCliente() != null ? " • " + os.getCliente().getNomeRazaoSocial() : "";
                    String maq = os.getMaquina() != null ? " • " + os.getMaquina().getMarca() + " " + os.getMaquina().getModelo() : "";
                    return new ItemBuscaDTO(
                            os.getId(),
                            "OS " + os.getNumeroOs(),
                            statusDesc + cli + maq,
                            os.getStatus() != null ? os.getStatus().name() : "OS",
                            "/ordens-servico/" + os.getId()
                    );
                })
                .toList();

        // 4. Produtos / Peças (top 5)
        List<ItemBuscaDTO> produtos = produtoRepository.buscarRapida(t, PageRequest.of(0, 5, Sort.by("nome").ascending()))
                .stream()
                .map(p -> {
                    String saldo = "Estoque: " + (p.getEstoqueAtual() != null ? p.getEstoqueAtual() : "0") + " " + (p.getUnidadeMedida() != null ? p.getUnidadeMedida() : "UN");
                    String preco = p.getPrecoVenda() != null ? " • R$ " + p.getPrecoVenda() : "";
                    String marca = p.getMarca() != null ? " • " + p.getMarca() : "";
                    return new ItemBuscaDTO(
                            p.getId(),
                            "[" + p.getCodigo() + "] " + p.getNome(),
                            saldo + preco + marca,
                            p.getTipo() != null ? p.getTipo().name() : "PECA",
                            "/produtos"
                    );
                })
                .toList();

        int total = clientes.size() + maquinas.size() + ordensServico.size() + produtos.size();

        return new BuscaRapidaDTO(clientes, maquinas, ordensServico, produtos, total);
    }
}
