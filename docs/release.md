# Guia de Release e Homologação — Release 1.0.0
## Oficina Gestão (Soldas & Geradores)

Este documento registra o status oficial de homologação, os metadados de infraestrutura, o changelog consolidado e as instruções operacionais para a versão **Release 1.0.0** da aplicação **Oficina Gestão**.

---

## 1. Metadados Oficiais da Release 1.0.0

- **Status da Release**: `RELEASE 1.0.0 — GO / HOMOLOGADO PARA OPERAÇÃO PILOTO`
- **Data da Homologação**: 16 de Setembro de 2026
- **Tag Oficial Git**: `v1.0.0`
- **Domínio Especializado**: Assistência técnica de máquinas de solda (MIG, TIG, Eletrodo, Inversoras) e geradores de energia (diesel e gasolina).
- **Provedor Cloud / Banco**: Neon PostgreSQL 16/18 Serverless (Região `aws-sa-east-1` — São Paulo)
- **Branch de Produção Neon**: `production` (`br-wispy-truth-acn1bsbe`) — Padrão do projeto `summer-frost-22688608`
- **Snapshot Pré-Release**: `snap-spring-thunder-acvzytef` (`snapshot-pre-release-1-0-0`)
- **Branch Isolada de Desenvolvimento**: `development` (`br-cool-feather-actev7kw`)
- **Métricas de Qualidade Backend**: 152 testes automatizados aprovados (0 falhas, 0 erros, 0 ignorados)
- **Métricas de Qualidade Frontend**: 0 erros de lint (`eslint`), 0 avisos impeditivos, build Next.js 16.3.5 / Turbopack compilado com 100% de sucesso em todas as 15 rotas.

---

## 2. Changelog Oficial da Release 1.0.0

A Release 1.0.0 consolida todas as entregas das Fases 0 a 10:

- **Fase 1 — Fundação do Banco de Dados**: Modelagem relacional inicial no PostgreSQL Neon com migrations Flyway (`V1` a `V3`).
- **Fase 2 — Autenticação e Segurança**: Login administrativo da proprietária, tokens JWT em cookies `HttpOnly` duplos (`SameSite=Lax` e `SameSite=Strict`), rotação de refresh tokens e proteção CSRF.
- **Fase 3 — Cadastro de Clientes e Endereços**: Gestão completa de clientes PF/PJ com validação de CPF/CNPJ e contatos.
- **Fase 4 — Domínio Especializado de Equipamentos**: Cadastro e vínculo de máquinas de solda e geradores de energia com potência, tensão e horímetro (`V4`, `V6`).
- **Fase 5 — Ordens de Serviço e Ciclo de Vida**: Fluxo técnico de 8 etapas (`ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`, `AGUARDANDO_PECA`, `PRONTA`, `CONCLUIDA`, `CANCELADA`) com registro obrigatório de testes em bancada (`V5`, `V8`).
- **Fase 6 — Produtos, Peças e Controle Atômico de Estoque**: Baixa e estorno atômicos de peças na OS com bloqueio pessimista (`PESSIMISTIC_WRITE`), prevenção de estoque negativo (`chk_produtos_estoque_nao_negativo`) e congelamento histórico de preço unitário (`V7`, `V9`).
- **Fase 7 — Histórico Técnico e Busca Rápida**: Modal de busca global instantânea (`Ctrl+K`), linha do tempo cronológica de atendimentos por máquina e resumo gerencial por cliente.
- **Fase 8 — Impressão, PDF Oficial e Relatórios**: Geração vetorial nativa em PDF A4 via OpenPDF, componente de impressão em folha limpa de balcão e 6 abas de relatórios consolidados (`/relatorios`).
- **Fase 9 — Hardening e Preparação de Produção**: Revisão de segurança, parametrização HTTPS de cookies, pipeline de CI/CD, documentação operacional e checklists.
- **Fase 10 — Release 1.0.0 e Operação Piloto**: Separação de branches e snapshot Neon, teste de smoke automatizado com fluxo completo e liberação para operação piloto.

---

## 3. Roteiro e Resultados do Smoke Test Crítico

O teste de validação de ponta a ponta (`ReleaseSmokeTest`) executou o seguinte ciclo de vida com 100% de conformidade:

1. **Cliente Piloto**: Criado cliente `"CLIENTE TESTE RELEASE"` com documento e telefone formatados.
2. **Equipamento Especializado**: Criado gerador de energia `"GERADOR TESTE RELEASE TG8000"`, 8.0 kVA, 220V/110V com horímetro 250h.
3. **Produto e Saldo Inicial**: Cadastrado `"PEÇA TESTE RELEASE - Regulador AVR 8kVA"` com saldo inicial estrito de 1 unidade física.
4. **Abertura de Ordem de Serviço**: Aberta OS com defeito relatado `"Sem geração de tensão nas tomadas auxiliares"`.
5. **Dedução Atômica de Estoque**: Peça vinculada à OS; o saldo físico em estoque foi reduzido atomicamente de 1 para 0 unidades com registro em `estoque_movimentacoes` (tipo `SAIDA_OS`).
6. **Bloqueio de Saldo Negativo**: Tentativa de lançar uma segunda unidade da mesma peça na OS foi imediatamente rejeitada pelo backend com `BusinessException: Estoque insuficiente`.
7. **Evolução de Status e Testes de Bancada**:
   - Transição `ABERTA` -> `EM_DIAGNOSTICO` -> `EM_MANUTENCAO`.
   - Bloqueio de avanço para `PRONTA` sem testes técnicos registrado.
   - Registro de testes de bancada sob carga resistiva de 7.5 kVA por 40 min a 220V estável e liberação para `PRONTA`.
   - Conclusão final da OS com timestamp de entrega (`CONCLUIDA`).
8. **Geração Vetorial de PDF**: Emissão do PDF da OS conferida com cabeçalho `%PDF`, tabela de peças com preço unitário congelado e assinaturas de balcão.
9. **Totalização em Relatórios**: Relatório gerencial de Ordens de Serviço por período apurou a OS concluída e totalizou faturamento sem distorções.

---

## 4. Checklist Manual de Homologação para a Proprietária da Oficina

Este roteiro de 14 passos deve ser executado pela responsável da oficina durante a fase de operação piloto:

- [ ] **1. Login**: Acessar o sistema com e-mail e senha administrativos.
- [ ] **2. Cadastrar Cliente**: Cadastrar um novo cliente com nome, CPF/CNPJ e telefone.
- [ ] **3. Cadastrar Equipamento**: Cadastrar uma máquina de solda ou gerador vinculado ao cliente recém-criado.
- [ ] **4. Abrir Ordem de Serviço**: Criar uma nova OS para o equipamento, informando o defeito relatado e o horímetro.
- [ ] **5. Iniciar Diagnóstico**: Avançar o status da OS para `EM_DIAGNOSTICO` e descrever a análise técnica.
- [ ] **6. Adicionar Peça**: Incluir um componente na OS e verificar que o preço unitário congelou e o subtotal foi calculado.
- [ ] **7. Conferir Estoque**: Acessar `/estoque` e confirmar que a quantidade da peça foi baixada do saldo disponível.
- [ ] **8. Testes Técnicos**: Informar os testes de bancada realizados (arco elétrico / tensão de saída) e avançar para `PRONTA`.
- [ ] **9. Finalizar OS**: Concluir o atendimento (status `CONCLUIDA`) e registrar a entrega ao cliente.
- [ ] **10. Gerar PDF**: Clicar em "Gerar PDF" e verificar se o arquivo A4 foi baixado com cabeçalho, dados, valores e assinaturas.
- [ ] **11. Imprimir**: Clicar em "Imprimir" e conferir a pré-visualização limpa para papel A4.
- [ ] **12. Consultar Histórico**: Acessar a ficha do equipamento e constatar a OS registrada na linha do tempo com o valor acumulado.
- [ ] **13. Busca Rápida**: Pressionar `Ctrl+K`, digitar o nome do cliente ou o número da OS e verificar a localização instantânea.
- [ ] **14. Relatórios**: Acessar `/relatorios` e conferir a OS concluída contabilizada no resumo e no faturamento do período.

---

## 5. Procedimento Oficial da Tag Git (Release 1.0.0)

Com a aprovação dos 152 testes backend, 0 erros no frontend e base Neon de produção homologada:

```bash
git checkout main
git pull origin main
git tag -a v1.0.0 -m "Release 1.0.0 — Oficina Gestao (Soldas & Geradores)"
git push origin v1.0.0
```
