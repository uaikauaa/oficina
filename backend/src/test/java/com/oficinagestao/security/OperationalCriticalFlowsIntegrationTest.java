package com.oficinagestao.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.oficinagestao.entity.Usuario;
import com.oficinagestao.entity.RefreshToken;
import com.oficinagestao.repository.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpMethod;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/** Valid HTTP mutations through the security chain, real repositories and disposable PostgreSQL. */
@SpringBootTest(properties = "security.jwt.legacy-sessionless-allowed=false")
@ActiveProfiles("test")
@AutoConfigureMockMvc(print = org.springframework.boot.webmvc.test.autoconfigure.MockMvcPrint.NONE)
@Transactional
class OperationalCriticalFlowsIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired UsuarioRepository users;
    @Autowired RoleRepository roles;
    @Autowired RefreshTokenRepository refreshTokens;
    @Autowired JwtService jwt;
    private final ObjectMapper json = new ObjectMapper();

    private String actor(String role) {
        Usuario user = new Usuario("Synthetic operational", UUID.randomUUID()+"@example.invalid", "unused", true);
        user.addRole(roles.findByNome(role).orElseThrow());
        user = users.saveAndFlush(user);
        RefreshToken refresh = refreshTokens.saveAndFlush(new RefreshToken(user,
                TokenHashUtil.hashStatic(UUID.randomUUID().toString()), OffsetDateTime.now().plusDays(1)));
        return jwt.generateToken(user, refresh.getSessionId());
    }
    private JsonNode call(String actor, String method, String path, Object body, int expected) throws Exception {
        var builder = request(HttpMethod.valueOf(method), path).header("Authorization", "Bearer "+actor);
        if (body != null) builder.contentType("application/json").content(json.writeValueAsBytes(body));
        var response = mvc.perform(builder).andReturn().getResponse();
        assertEquals(expected, response.getStatus(), method+" "+path+": "+response.getContentAsString());
        return response.getContentAsByteArray().length == 0 ? json.nullNode() : json.readTree(response.getContentAsString());
    }
    private long client(String actor) throws Exception {
        return call(actor,"POST","/api/clientes",Map.of("tipoPessoa","FISICA","nomeRazaoSocial","Synthetic client "+UUID.randomUUID(),
                "email","private@example.invalid"),201).path("id").asLong();
    }
    private long machine(String actor,long client) throws Exception {
        return call(actor,"POST","/api/maquinas",Map.of("clienteId",client,"tipoEquipamento","MAQUINA_SOLDA",
                "marca","Synthetic","modelo","Stage4a","numeroSerie",UUID.randomUUID().toString()),201).path("id").asLong();
    }
    private long product(String actor) throws Exception {
        return call(actor,"POST","/api/produtos",Map.of("nome","Synthetic "+UUID.randomUUID(),"tipo","PECA",
                "precoCusto",10,"precoVenda",20,"estoqueMinimo",1,"estoqueInicial",5),201).path("id").asLong();
    }
    private long order(String actor,long client,long machine) throws Exception {
        return call(actor,"POST","/api/ordens-servico",Map.of("clienteId",client,"maquinaId",machine,
                "problemaRelatado","Synthetic controlled repair"),201).path("id").asLong();
    }
    private void status(String actor,long order,String status) throws Exception {
        assertEquals(status,call(actor,"PATCH","/api/ordens-servico/"+order+"/status",Map.of("status",status,
                "testesRealizados","Synthetic bench test completed successfully"),200).path("status").asText());
    }

    @ParameterizedTest @ValueSource(strings = {"ROLE_SUPER_ADMIN","ROLE_OPERADOR_GERAL"})
    void criticalLifecyclePreservesStockFinanceAndHistory(String role) throws Exception {
        String actor = actor(role);
        long client = client(actor), machine = machine(actor,client), product = product(actor);
        assertEquals("Updated synthetic",call(actor,"PUT","/api/clientes/"+client,Map.of("tipoPessoa","FISICA",
                "nomeRazaoSocial","Updated synthetic"),200).path("nomeRazaoSocial").asText());
        long cancelled = order(actor,client,machine);
        call(actor,"POST","/api/ordens-servico/"+cancelled+"/itens",Map.of("produtoId",product,"quantidade",2,"valorDesconto",0),201);
        assertEquals(3,call(actor,"GET","/api/produtos/"+product,null,200).path("estoqueAtual").asInt());
        status(actor,cancelled,"CANCELADA");
        assertEquals(5,call(actor,"GET","/api/produtos/"+product,null,200).path("estoqueAtual").asInt());
        call(actor,"PATCH","/api/ordens-servico/"+cancelled+"/status",Map.of("status","CANCELADA"),400);
        assertEquals(5,call(actor,"GET","/api/produtos/"+product,null,200).path("estoqueAtual").asInt());
        long finished = order(actor,client,machine);
        call(actor,"POST","/api/ordens-servico/"+finished+"/itens",Map.of("produtoId",product,"quantidade",2,"valorDesconto",0),201);
        JsonNode financial = call(actor,"PUT","/api/ordens-servico/"+finished,Map.of("valorMaoObra",50,
                "valorDesconto",5,"diagnostico","Synthetic diagnosis","solucaoAplicada","Synthetic repair"),200);
        assertEquals(85,financial.path("valorTotal").asInt());
        for(String state:List.of("EM_DIAGNOSTICO","EM_MANUTENCAO","PRONTA","CONCLUIDA")) status(actor,finished,state);
        JsonNode closed = call(actor,"GET","/api/ordens-servico/"+finished,null,200);
        assertFalse(closed.path("dataConclusao").isNull());
        assertEquals(85,closed.path("valorTotal").asInt());
        for(String format:List.of("pdf","recibo","documento-servico")) {
            var response=mvc.perform(request(HttpMethod.GET,"/api/ordens-servico/"+finished+"/"+format)
                    .header("Authorization","Bearer "+actor)).andReturn().getResponse();
            assertEquals(200,response.getStatus());
            assertEquals("%PDF-",new String(Arrays.copyOf(response.getContentAsByteArray(),5),java.nio.charset.StandardCharsets.US_ASCII));
        }
        for(String path:List.of("/api/relatorios/ordens-servico","/api/relatorios/clientes","/api/relatorios/estoque",
                "/api/estoque/movimentacoes","/api/clientes/"+client+"/historico","/api/maquinas/"+machine+"/historico"))
            call(actor,"GET",path,null,200);
        for(String path:List.of("/api/clientes/"+client,"/api/maquinas/"+machine,"/api/produtos/"+product)) {
            assertFalse(call(actor,"PATCH",path+"/status",Map.of("ativo",false),200).path("ativo").asBoolean());
            assertFalse(call(actor,"GET",path,null,200).path("ativo").asBoolean());
        }
        call(actor,"GET","/api/admin/usuarios",null,role.equals("ROLE_SUPER_ADMIN")?200:403);
    }

    @Test void delegatedValidOperationsAndForbiddenMutations() throws Exception {
        String superAdmin=actor("ROLE_SUPER_ADMIN");
        long client=client(superAdmin),machine=machine(superAdmin,client),product=product(superAdmin);
        for(String role:List.of("ROLE_GERENTE","ROLE_ATENDENTE","ROLE_TECNICO","ROLE_ESTOQUISTA","ROLE_FINANCEIRO","ROLE_CONSULTA")) {
            String actor=actor(role);
            switch(role) {
                case "ROLE_GERENTE" -> {
                    long id=client(actor);
                    call(actor,"PATCH","/api/clientes/"+id+"/status",Map.of("ativo",false),200);
                    call(actor,"PUT","/api/configuracao-oficina",Map.of(),403);
                }
                case "ROLE_ATENDENTE" -> { client(actor); machine(actor,client); call(actor,"POST","/api/produtos",Map.of(),403); }
                case "ROLE_TECNICO" -> { long id=order(actor,client,machine); status(actor,id,"EM_DIAGNOSTICO");
                    call(actor,"POST","/api/clientes",Map.of(),403); }
                case "ROLE_ESTOQUISTA" -> {
                    call(actor,"POST","/api/estoque/movimentar",Map.of("produtoId",product,"tipoMovimentacao","ENTRADA",
                            "quantidade",2,"valorUnitario",10,"motivo","Synthetic incoming stock"),201);
                    call(actor,"POST","/api/ordens-servico",Map.of(),403);
                }
                case "ROLE_FINANCEIRO" -> { call(actor,"GET","/api/relatorios/ordens-servico",null,200);
                    call(actor,"POST","/api/estoque/movimentar",Map.of(),403); }
                case "ROLE_CONSULTA" -> {
                    JsonNode minimized=call(actor,"GET","/api/clientes/"+client,null,200);
                    assertFalse(minimized.toString().contains("private@example.invalid"));
                    call(actor,"GET","/api/maquinas/"+machine,null,200);
                    call(actor,"GET","/api/relatorios/ordens-servico",null,403);
                    call(actor,"PATCH","/api/clientes/"+client+"/status",Map.of("ativo",false),403);
                }
                default -> fail("unhandled role");
            }
            call(actor,"GET","/api/admin/usuarios",null,403);
        }
    }
}
