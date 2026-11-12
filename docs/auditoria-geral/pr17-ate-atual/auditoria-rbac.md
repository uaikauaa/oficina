# RBAC, administração e operações

`V25__admin_rbac.sql` concede o mesmo catálogo operacional a `ROLE_SUPER_ADMIN`, `ROLE_OPERADOR_GERAL` e `ROLE_ADMIN`; permissões de identidade/infraestrutura são acrescentadas ao SUPER_ADMIN. V26 restringe CONSULTA. O filtro JWT monta grants **atuais** dos papéis no banco, sem confiar nas claims de role. `SecurityConfig` nega rotas desconhecidas e protege mutações por método/permissão; os serviços aplicam regras de negócio. Isso foi confrontado com testes HTTP e estado persistido, além de comparação da migration.

| Papel | Operação válida/negativa observada no Stage 4A | Estado |
|---|---|---|
| SUPER_ADMIN sintético | Cadastro/OS/estoque/financeiro/PDF e gestão de usuários, convite, revogação, auditoria | Aprovado isolado; conta real não criada |
| OPERADOR_GERAL sintético | Cliente/máquina/produto, OS, peça, cancelamento/estorno/conclusão, relatórios, CSV/PDF; não administra identidades | Aprovado nos fluxos críticos; preservar paridade operacional com ADMIN legado |
| ADMIN legado | Mesmo conjunto operacional em V25; sem privilégio implícito de SUPER_ADMIN | Parcial: matriz de todas as rotas deve ser reavaliada antes da transição real |
| GERENTE/ATENDENTE/TECNICO/ESTOQUISTA/FINANCEIRO | Mutações representativas autorizadas e negativas por domínio | Parcial; não equivale a cobertura exaustiva por objeto |
| CONSULTA | Leituras minimizadas de cliente/máquina; mutações/financeiro negados | Parcial: exportadores e novos endpoints devem manter minimização |
| Personalizados | Negação padrão e catálogo de permissões em testes de rota | Parcial; combinações reais não provisionadas |

Nenhum HTTP 200 foi tomado sozinho como persistência: `OperationalCriticalFlowsIntegrationTest` consulta estado após criação/alteração, confirma total financeiro e estorno único. Faltam cenários mais amplos de concorrência e isolamento horizontal por objeto. Uma futura Geisa OPERADOR_GERAL deve manter ID, hash de senha, estado ativo e todos os históricos; reatribuição de role revoga sessões, logo novo login com 2FA será necessário. Só após SUPER_ADMIN real validado por convite oficial, senha do titular e 2FA, e mediante autorização separada. Não alterar nenhuma conta nesta auditoria.
