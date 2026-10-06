package com.oficinagestao.service;

import com.oficinagestao.dto.ClienteCreateDTO;
import com.oficinagestao.dto.ClienteUpdateDTO;
import com.oficinagestao.dto.ConfiguracaoOficinaUpdateDTO;
import com.oficinagestao.dto.EnderecoDTO;
import com.oficinagestao.dto.MaquinaCreateDTO;
import com.oficinagestao.dto.OrdemServicoUpdateDTO;
import com.oficinagestao.entity.Cliente;
import com.oficinagestao.entity.Maquina;
import com.oficinagestao.entity.OrdemServico;
import com.oficinagestao.entity.TipoEndereco;
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

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class FormClearIntegrationTest {

    @Autowired private ClienteService clienteService;
    @Autowired private MaquinaService maquinaService;
    @Autowired private OrdemServicoService ordemServicoService;
    @Autowired private ConfiguracaoOficinaService configuracaoService;
    @Autowired private ClienteRepository clienteRepository;
    @Autowired private MaquinaRepository maquinaRepository;
    @Autowired private OrdemServicoRepository ordemServicoRepository;
    @Autowired private EntityManager entityManager;
    @Autowired private JdbcTemplate jdbc;

    private String uniqueName() {
        return "FormTest-" + UUID.randomUUID();
    }

    private EnderecoDTO endereco(String rua) {
        return new EnderecoDTO(null, "19914080", rua, "10", null, "Centro", "Ourinhos", "SP", TipoEndereco.PRINCIPAL);
    }

    private ClienteUpdateDTO clienteUpdate(String nome, EnderecoDTO endereco, Boolean removerEndereco) {
        return new ClienteUpdateDTO(TipoPessoa.FISICA, nome, null, null, null, null, null,
                null, true, null, endereco, removerEndereco);
    }

    private Cliente novoCliente(String nome, EnderecoDTO endereco) {
        Long id = clienteService.criar(new ClienteCreateDTO(TipoPessoa.FISICA, nome, null, null,
                null, null, null, null, null, endereco), null, null).id();
        entityManager.flush();
        entityManager.clear();
        return clienteRepository.findById(id).orElseThrow();
    }

    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    private Integer enderecoCount(Long clienteId) {
        return jdbc.queryForObject("select count(*) from enderecos where cliente_id = ?", Integer.class, clienteId);
    }

    @Test
    void enderecoOmitidoPreservaValorPersistido() {
        Cliente cliente = novoCliente(uniqueName(), endereco("Rua A"));
        clienteService.atualizar(cliente.getId(), clienteUpdate(cliente.getNomeRazaoSocial(), null, null), null, null);
        flushAndClear();
        assertEquals(1, enderecoCount(cliente.getId()));
        assertEquals("Rua A", jdbc.queryForObject("select logradouro from enderecos where cliente_id = ?", String.class, cliente.getId()));
    }

    @Test
    void enderecoExplicitamenteRemovidoExcluiOrfao() {
        Cliente cliente = novoCliente(uniqueName(), endereco("Rua A"));
        clienteService.atualizar(cliente.getId(), clienteUpdate(cliente.getNomeRazaoSocial(), null, true), null, null);
        flushAndClear();
        assertEquals(0, enderecoCount(cliente.getId()));
        assertEquals(0, clienteService.buscarPorId(cliente.getId()).enderecos().size());
    }

    @Test
    void enderecoAlteradoPersisteENenhumEnderecoContinuaValido() {
        Cliente cliente = novoCliente(uniqueName(), endereco("Rua A"));
        clienteService.atualizar(cliente.getId(), clienteUpdate(cliente.getNomeRazaoSocial(), endereco("Rua B"), null), null, null);
        flushAndClear();
        assertEquals(1, enderecoCount(cliente.getId()));
        assertEquals("Rua B", jdbc.queryForObject("select logradouro from enderecos where cliente_id = ?", String.class, cliente.getId()));

        Cliente semEndereco = novoCliente(uniqueName(), null);
        clienteService.atualizar(semEndereco.getId(), clienteUpdate(semEndereco.getNomeRazaoSocial(), null, null), null, null);
        flushAndClear();
        assertEquals(0, enderecoCount(semEndereco.getId()));
    }

    private OrdemServico novaOrdem() {
        Cliente cliente = novoCliente(uniqueName(), null);
        Maquina maquina = new Maquina();
        maquina.setCliente(cliente);
        maquina.setTipoEquipamento(TipoEquipamento.MAQUINA_SOLDA);
        maquina.setMarca("Teste");
        maquina.setModelo("Teste");
        maquina = maquinaRepository.saveAndFlush(maquina);
        OrdemServico ordem = new OrdemServico();
        ordem.setNumeroOs("FORM-" + UUID.randomUUID().toString().substring(0, 20));
        ordem.setCliente(cliente);
        ordem.setMaquina(maquina);
        ordem.setProblemaRelatado("Teste de formulario");
        ordem.setDiagnostico("Diagnostico antigo");
        ordem.setSolucaoAplicada("Solucao antiga");
        ordem.setTestesRealizados("Testes antigos");
        ordem = ordemServicoRepository.saveAndFlush(ordem);
        entityManager.clear();
        return ordem;
    }

    private OrdemServicoUpdateDTO laudo(String diagnostico, String solucao, String testes) {
        return new OrdemServicoUpdateDTO(null, diagnostico, solucao, testes, null, null,
                null, null, null, null);
    }

    @Test
    void laudoOmitidoPreservaTodosOsCampos() {
        OrdemServico ordem = novaOrdem();
        ordemServicoService.atualizar(ordem.getId(), laudo(null, null, null), null, null);
        flushAndClear();
        assertEquals("Diagnostico antigo", jdbc.queryForObject("select diagnostico_tecnico from ordens_servico where id = ?", String.class, ordem.getId()));
        assertEquals("Solucao antiga", jdbc.queryForObject("select solucao_aplicada from ordens_servico where id = ?", String.class, ordem.getId()));
        assertEquals("Testes antigos", jdbc.queryForObject("select testes_realizados from ordens_servico where id = ?", String.class, ordem.getId()));
    }

    @Test
    void laudoVazioLimpaTodosOsCamposNoBanco() {
        OrdemServico ordem = novaOrdem();
        ordemServicoService.atualizar(ordem.getId(), laudo("", "", ""), null, null);
        flushAndClear();
        assertNull(jdbc.queryForObject("select diagnostico_tecnico from ordens_servico where id = ?", String.class, ordem.getId()));
        assertNull(jdbc.queryForObject("select solucao_aplicada from ordens_servico where id = ?", String.class, ordem.getId()));
        assertNull(jdbc.queryForObject("select testes_realizados from ordens_servico where id = ?", String.class, ordem.getId()));
    }

    private ConfiguracaoOficinaUpdateDTO config(String nomeFantasia, String nomeEmpresarial, String cnpj) {
        return new ConfiguracaoOficinaUpdateDTO(nomeFantasia, nomeEmpresarial, cnpj,
                null, null, null, null, null, null, null, null, null);
    }

    @Test
    void configuracaoOmitidaPreservaLimpezaRemoveEValorNovoPersiste() {
        var original = configuracaoService.obter();
        Long id = original.id();
        configuracaoService.atualizar(config(original.nomeFantasia(), "Empresa Teste", "45076507000167"));
        flushAndClear();
        configuracaoService.atualizar(config(original.nomeFantasia(), null, null));
        flushAndClear();
        assertEquals("Empresa Teste", jdbc.queryForObject("select nome_empresarial from configuracao_oficina where id = ?", String.class, id));
        assertEquals("45076507000167", jdbc.queryForObject("select cnpj from configuracao_oficina where id = ?", String.class, id));

        configuracaoService.atualizar(config(original.nomeFantasia(), "", ""));
        flushAndClear();
        assertNull(jdbc.queryForObject("select nome_empresarial from configuracao_oficina where id = ?", String.class, id));
        assertNull(jdbc.queryForObject("select cnpj from configuracao_oficina where id = ?", String.class, id));

        configuracaoService.atualizar(config(original.nomeFantasia(), "Empresa Nova", "11222333000181"));
        flushAndClear();
        assertEquals("Empresa Nova", jdbc.queryForObject("select nome_empresarial from configuracao_oficina where id = ?", String.class, id));
        assertEquals("11222333000181", jdbc.queryForObject("select cnpj from configuracao_oficina where id = ?", String.class, id));
    }

    @Test
    void clientePersistidoPodeReceberMaquinaSemNovoCliente() {
        String nome = uniqueName();
        Cliente cliente = novoCliente(nome, null);
        maquinaService.criar(new MaquinaCreateDTO(cliente.getId(), TipoEquipamento.MAQUINA_SOLDA,
                "Teste", "Modelo", null, null, null, null, null, null), null, null);
        flushAndClear();
        assertEquals(1, jdbc.queryForObject("select count(*) from clientes where id = ?", Integer.class, cliente.getId()));
        assertEquals(1, jdbc.queryForObject("select count(*) from maquinas where cliente_id = ?", Integer.class, cliente.getId()));
    }
}
