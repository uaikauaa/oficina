# Matriz preparatória de rotas e permissões

Gerada do código da branch desta auditoria. Rotas com aliases aparecem separadamente. A tabela é proposta para a ETAPA 2; nenhum papel novo está ativo nesta etapa.

Legenda: **OG** = `ROLE_OPERADOR_GERAL`; **SA** = `ROLE_SUPER_ADMIN`; **P** = público com proteções próprias; **A** = qualquer usuário autenticado; **ADM** = `ROLE_ADMIN` atual. O backend exige `ROLE_ADMIN` em `/api/**` salvo as exceções explícitas no `SecurityConfig`.

| Módulo / serviço | Método | Endpoint | Permissão proposta | Atual | Futuro | Regra e escopo | Mudança / risco / teste |
|---|---|---|---|---|---|---|---|
| Auth | POST | /api/auth/2fa/resend | AUTH_2FA_RESEND_POST | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Auth | POST | /api/auth/2fa/verify | AUTH_2FA_VERIFY_POST | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Auth | PUT | /api/auth/alterar-senha | AUTH_ALTERAR_SENHA_PUT | ADM | A | identidade/sessão própria | sessão própria; testar acesso cruzado negado |
| Auth | POST | /api/auth/login | AUTH_LOGIN_POST | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Auth | POST | /api/auth/logout | AUTH_LOGOUT_POST | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Auth | GET | /api/auth/me | AUTH_ME_GET | ADM | A | identidade/sessão própria | sessão própria; testar acesso cruzado negado |
| Auth | POST | /api/auth/refresh | AUTH_REFRESH_POST | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Busca | GET | /api/busca/rapida | BUSCA_RAPIDA_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | GET | /api/categorias | CATEGORIAS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | POST | /api/categorias | CATEGORIAS_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | GET | /api/categorias/{id} | CATEGORIAS_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | PUT | /api/categorias/{id} | CATEGORIAS_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | PATCH | /api/categorias/{id}/status | CATEGORIAS_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Categoria | GET | /api/categorias/ativas | CATEGORIAS_ATIVAS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | GET | /api/clientes | CLIENTES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | POST | /api/clientes | CLIENTES_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | GET | /api/clientes/{id} | CLIENTES_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | PUT | /api/clientes/{id} | CLIENTES_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | GET | /api/clientes/{id}/historico | CLIENTES_ID_HISTORICO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | GET | /api/clientes/{id}/resumo | CLIENTES_ID_RESUMO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | PATCH | /api/clientes/{id}/status | CLIENTES_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Cliente | GET | /api/clientes/contadores-status | CLIENTES_CONTADORES_STATUS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| ConfiguracaoOficina | GET | /api/configuracao-oficina | CONFIGURACAO_OFICINA_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| ConfiguracaoOficina | PUT | /api/configuracao-oficina | CONFIGURACAO_OFICINA_PUT | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Csrf | GET | /api/auth/csrf | AUTH_CSRF_GET | P | P | identidade/sessão própria | preservar controles; teste HTTP/CSRF/limites |
| Estoque | POST | /api/estoque/ajuste | ESTOQUE_AJUSTE_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Estoque | POST | /api/estoque/entrada | ESTOQUE_ENTRADA_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Estoque | GET | /api/estoque/movimentacoes | ESTOQUE_MOVIMENTACOES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Estoque | POST | /api/estoque/movimentar | ESTOQUE_MOVIMENTAR_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Estoque | GET | /api/estoque/resumo | ESTOQUE_RESUMO_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Estoque | POST | /api/estoque/saida | ESTOQUE_SAIDA_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Fornecedor | GET | /api/fornecedores | FORNECEDORES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Fornecedor | POST | /api/fornecedores | FORNECEDORES_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Fornecedor | GET | /api/fornecedores/{id} | FORNECEDORES_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Fornecedor | PUT | /api/fornecedores/{id} | FORNECEDORES_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Fornecedor | PATCH | /api/fornecedores/{id}/status | FORNECEDORES_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Health | GET | /api/health | HEALTH_GET | P | P | status mínimo | preservar controles; teste HTTP/CSRF/limites |
| Maquina | GET | /api/clientes/{clienteId}/maquinas | CLIENTES_ID_MAQUINAS_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | GET | /api/maquinas | MAQUINAS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | POST | /api/maquinas | MAQUINAS_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | GET | /api/maquinas/{id} | MAQUINAS_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | PUT | /api/maquinas/{id} | MAQUINAS_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | GET | /api/maquinas/{id}/historico | MAQUINAS_ID_HISTORICO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | GET | /api/maquinas/{id}/resumo | MAQUINAS_ID_RESUMO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Maquina | PATCH | /api/maquinas/{id}/status | MAQUINAS_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Notificacao | GET | /api/notificacoes | NOTIFICACOES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Notificacao | PATCH | /api/notificacoes/{id}/ler | NOTIFICACOES_ID_LER_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Notificacao | PUT | /api/notificacoes/{id}/ler | NOTIFICACOES_ID_LER_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Notificacao | PATCH | /api/notificacoes/ler-todas | NOTIFICACOES_LER_TODAS_PATCH | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Notificacao | PUT | /api/notificacoes/ler-todas | NOTIFICACOES_LER_TODAS_PUT | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/clientes/{clienteId}/ordens-servico | CLIENTES_ID_ORDENS_SERVICO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/maquinas/{maquinaId}/ordens-servico | MAQUINAS_ID_ORDENS_SERVICO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico | ORDENS_SERVICO_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | POST | /api/ordens-servico | ORDENS_SERVICO_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/{id} | ORDENS_SERVICO_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | PUT | /api/ordens-servico/{id} | ORDENS_SERVICO_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/{id}/documento-servico | ORDENS_SERVICO_ID_DOCUMENTO_SERVICO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/{id}/itens | ORDENS_SERVICO_ID_ITENS_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | POST | /api/ordens-servico/{id}/itens | ORDENS_SERVICO_ID_ITENS_POST | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | DELETE | /api/ordens-servico/{id}/itens/{itemId} | ORDENS_SERVICO_ID_ITENS_ID_DELETE | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/{id}/pdf | ORDENS_SERVICO_ID_PDF_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/{id}/recibo | ORDENS_SERVICO_ID_RECIBO_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | PATCH | /api/ordens-servico/{id}/status | ORDENS_SERVICO_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/contadores-dashboard | ORDENS_SERVICO_CONTADORES_DASHBOARD_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| OrdemServico | GET | /api/ordens-servico/contadores-status | ORDENS_SERVICO_CONTADORES_STATUS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | GET | /api/produtos | PRODUTOS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | POST | /api/produtos | PRODUTOS_POST | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | GET | /api/produtos/{id} | PRODUTOS_ID_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | PUT | /api/produtos/{id} | PRODUTOS_ID_PUT | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | GET | /api/produtos/{id}/compatibilidades | PRODUTOS_ID_COMPATIBILIDADES_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | POST | /api/produtos/{id}/compatibilidades | PRODUTOS_ID_COMPATIBILIDADES_POST | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | DELETE | /api/produtos/{id}/compatibilidades/{maquinaId} | PRODUTOS_ID_COMPATIBILIDADES_ID_DELETE | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | GET | /api/produtos/{id}/maquinas | PRODUTOS_ID_MAQUINAS_GET | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | POST | /api/produtos/{id}/maquinas | PRODUTOS_ID_MAQUINAS_POST | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | DELETE | /api/produtos/{id}/maquinas/{maquinaId} | PRODUTOS_ID_MAQUINAS_ID_DELETE | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Produto | PATCH | /api/produtos/{id}/status | PRODUTOS_ID_STATUS_PATCH | ADM | OG, SA | objeto ligado ao recurso; validar IDs | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/clientes | RELATORIOS_CLIENTES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/equipamentos | RELATORIOS_EQUIPAMENTOS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/estoque | RELATORIOS_ESTOQUE_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/movimentacoes | RELATORIOS_MOVIMENTACOES_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/ordens-servico | RELATORIOS_ORDENS_SERVICO_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| Relatorio | GET | /api/relatorios/pecas-mais-utilizadas | RELATORIOS_PECAS_MAIS_UTILIZADAS_GET | ADM | OG, SA | oficina; validar integridade | trocar gate; testar OG permitido e papel sem permissão negado |
| System | GET | /api/system/status | SYSTEM_STATUS_GET | ADM | SA | infraestrutura restrita | gate SA; testar OG negado |

As operações de PATCH/PUT de status e DELETE de vínculos ou itens exigem os mesmos invariantes de domínio atuais. Excluir usuário não possui endpoint; na ETAPA 2 a desativação lógica deve ser padrão, e a exclusão física exige análise referencial e auditoria. Serviços pertencem aos controllers indicados; a associação exata método de controller → método de service deve ser revisada ao implementar o gate granular.
