package com.oficinagestao.service;

import com.lowagie.text.pdf.PdfReader;
import com.lowagie.text.pdf.parser.PdfTextExtractor;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.TipoEquipamento;
import com.oficinagestao.entity.TipoPessoa;
import com.oficinagestao.repository.ClienteRepository;
import com.oficinagestao.repository.MaquinaRepository;
import com.oficinagestao.repository.OrdemServicoRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ImpressaoConfigPdfIntegrationTest {

    @Autowired private ConfiguracaoOficinaService configuracaoService;
    @Autowired private PdfService pdfService;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private MaquinaRepository maquinaRepository;
    @Autowired private OrdemServicoRepository ordemServicoRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    private ConfiguracaoOficinaUpdateDTO config(String nome, String nomeEmpresarial, String cnpj,
                                                 String telefone, String logradouro) {
        return new ConfiguracaoOficinaUpdateDTO(nome, nomeEmpresarial, cnpj, null, telefone,
                null, logradouro, "10", null, null, "Ourinhos", "SP");
    }

    private String textoPdf(OrdemServico os) throws IOException {
        try (PdfReader reader = new PdfReader(pdfService.gerarOrdemServicoPdf(os, List.of()))) {
            return new PdfTextExtractor(reader).getTextFromPage(1);
        }
    }

    @Test
    void pdfLeConfiguracaoPersistidaAtualEnaoReutilizaCnpjRemovido() throws IOException {
        String id = UUID.randomUUID().toString().substring(0, 8);
        Cliente cliente = clienteRepository.saveAndFlush(new Cliente(TipoPessoa.FISICA,
                "ImpressaoQA-" + id, null, null, null, null, null, null, null));
        Maquina maquina = new Maquina();
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("QA");
        maquina.setModelo("QA");
        maquina = maquinaRepository.saveAndFlush(maquina);
        OrdemServico os = new OrdemServico();
        os.setNumeroOs("PRINTQA-" + id);
        os.setCliente(cliente);
        os.setMaquina(maquina);
        os.setProblemaRelatado("Teste de impressao");
        os = ordemServicoRepository.saveAndFlush(os);

        configuracaoService.atualizar(config("Oficina QA A", "Empresa QA A", "11.222.333/0001-81", "1111-1111", "Rua A"));
        entityManager.flush();
        entityManager.clear();
        String pdfA = textoPdf(os);
        assertTrue(pdfA.contains("OFICINA QA A"));
        assertTrue(pdfA.contains("11.222.333/0001-81"));
        assertTrue(pdfA.contains("1111-1111"));
        assertTrue(pdfA.contains("Rua A"));

        configuracaoService.atualizar(config("Oficina QA B", "", "", "2222-2222", "Rua B"));
        entityManager.flush();
        entityManager.clear();
        assertNull(jdbc.queryForObject("select cnpj from configuracao_oficina order by id limit 1", String.class));
        String pdfB = textoPdf(os);
        assertTrue(pdfB.contains("OFICINA QA B"));
        assertTrue(pdfB.contains("2222-2222"));
        assertTrue(pdfB.contains("Rua B"));
        assertTrue(!pdfB.contains("OFICINA QA A"));
        assertTrue(!pdfB.contains("11.222.333/0001-81"));
    }
}
