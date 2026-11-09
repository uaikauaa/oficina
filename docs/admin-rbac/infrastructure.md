# Painel de infraestrutura — contrato de medições

O endpoint `GET /api/admin/infraestrutura` exige `infraestrutura.visualizar` no backend. A resposta usa cache de 120 segundos por padrão (mínimo 60, máximo 3600), timeout de conexão de 2 segundos e de resposta de 3 segundos. Não há scheduler de coleta nem recurso pago criado por esta implementação. Falhas dos provedores não impedem a leitura das medições locais. O navegador recebe somente valores e fontes, nunca chaves.

## Fontes

| Indicador | Fonte | Sem configuração |
|---|---|---|
| Nome, conexão, tamanho lógico e tabelas | PostgreSQL conectado: `current_database`, `pg_database_size`, `pg_tables` | Indisponível se SQL falhar |
| Registros por módulo | Estatísticas `pg_class.reltuples`, explicitamente estimadas | Indisponível se SQL falhar |
| Nome do projeto Neon | API de projeto, com `NEON_PROJECT_ID` e `NEON_API_KEY` no backend | Indisponível |
| Armazenamento faturado, limite e CU-hours Neon | API de consumo depende do plano e da identidade confirmada | Indisponível, sem valor inventado |
| Requisições Cloud Run em 5 min | Cloud Monitoring, se projeto e serviço forem configurados e a identidade do serviço tiver permissão de leitura | Indisponível |
| CPU, memória, instâncias, custo, orçamento | Integração adicional ainda não implementada | Indisponível |

`INFRA_DATABASE_PROVIDER` é um **rótulo configurado**, não uma detecção automática do host. Mantenha `local` até cruzar projeto, branch, endpoint e banco no console Neon. `pg_database_size` é tamanho lógico SQL e **não** armazenamento cobrado pelo Neon. As contagens por módulo são estimativas de estatísticas e podem estar defasadas. O endpoint não faz `COUNT(*)` nas tabelas operacionais.

Para Neon, crie uma chave de API de leitura restrita ao projeto, conforme as permissões disponíveis no plano, e injete-a no backend pelo gerenciador de segredos. A integração atual só lê o nome do projeto. A [API de histórico de consumo por projeto](https://neon.com/docs/reference/api/consumption/get-consumption-history-per-project-v2) exige plano e escopo compatíveis; a disponibilidade e o limite efetivo da conta precisam ser confirmados antes de conectar números de faturamento. Não inferir quota pelo preço público.

Para Google Cloud, configure `GOOGLE_CLOUD_PROJECT_ID` e `GOOGLE_CLOUD_RUN_SERVICE` no backend Cloud Run. Conceda à identidade **do serviço de backend** somente leitura no projeto de métricas. O código usa o token do [metadata server](https://docs.cloud.google.com/run/docs/container-contract) e a [API `timeSeries.list`](https://docs.cloud.google.com/monitoring/api/ref_v3/rest/v3/projects.timeSeries/list), sem chave JSON. Em ambiente local, a chamada retorna indisponível. A coleta rejeita resultado paginado para não exibir total parcial. A API de Monitoring precisa estar habilitada por um operador; este código não habilita APIs nem faz alterações no projeto.

Alertas visuais de 50/80/95% só devem ser ativados quando numerador e limite vierem de fontes verificadas. Os valores de custo, orçamento, tendência, gasto futuro, tráfego e erros ainda não têm fonte integrada e permanecem vazios. [Alertas de orçamento do Google Cloud](https://docs.cloud.google.com/billing/docs/how-to/budget-api-overview) podem avisar, mas não são teto automático de cobrança. Não ativar controles que possam interromper o serviço sem aprovação operacional.
