# Guia de Release e Homologação — Release 1.0.0
## Oficina Gestão (Soldas & Geradores)

Este documento descreve os detalhes, o changelog consolidado e o procedimento oficial de corte da versão **Release 1.0.0** da aplicação **Oficina Gestão**.

---

## 1. Changelog Oficial da Release 1.0.0

A Release 1.0.0 representa a entrega completa do MVP homologado para assistência técnica especializada em conserto, manutenção e reparo de **máquinas de solda** e **geradores de energia**:

- **Fase 1 — Fundação do Banco de Dados**: Modelagem relacional inicial no PostgreSQL Neon com migrations Flyway (`V1` a `V3`).
- **Fase 2 — Autenticação e Segurança**: Login administrativo da proprietária, tokens JWT em cookies `HttpOnly` duplos (`SameSite=Lax` e `SameSite=Strict`), rotação de refresh tokens e proteção CSRF.
- **Fase 3 — Cadastro de Clientes e Endereços**: Gestão completa de clientes PF/PJ com validação de CPF/CNPJ e contatos.
- **Fase 4 — Domínio Especializado de Equipamentos**: Cadastro e vínculo de máquinas de solda e geradores de energia com potência, tensão e horímetro (`V4`, `V6`).
- **Fase 5 — Ordens de Serviço e Ciclo de Vida**: Fluxo técnico de 8 etapas (`ABERTA`, `EM_DIAGNOSTICO`, `AGUARDANDO_APROVACAO`, `EM_MANUTENCAO`, `AGUARDANDO_PECA`, `PRONTA`, `CONCLUIDA`, `CANCELADA`) com registro de testes em bancada (`V5`, `V8`).
- **Fase 6 — Produtos, Peças e Controle Atômico de Estoque**: Baixa e estorno atômicos de peças na OS com bloqueio pessimista (`PESSIMISTIC_WRITE`), prevenção de estoque negativo e congelamento histórico de preço unitário (`V7`, `V9`).
- **Fase 7 — Histórico Técnico e Busca Rápida**: Modal de busca global instantânea (`Ctrl+K`), linha do tempo cronológica de atendimentos por máquina e resumo gerencial por cliente.
- **Fase 8 — Impressão, PDF Oficial e Relatórios**: Geração vetorial nativa em PDF A4 via OpenPDF, componente de impressão em folha limpa de balcão e 6 abas de relatórios consolidados (`/relatorios`).
- **Fase 9 — Hardening e Preparação de Produção**: Revisão de segurança, parametrização HTTPS de cookies, pipeline de CI/CD, documentação operacional e checklists.

---

## 2. Checklist Manual de Homologação para a Proprietária da Oficina

Este roteiro simples de 14 passos deve ser executado pela dona da oficina para homologação do uso real:

- [ ] **1. Login**: Acessar o sistema com e-mail e senha cadastrados.
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

## 3. Procedimento Oficial para Publicação da Tag Git (Release 1.0.0)

> [!IMPORTANT]
> A tag Git só deve ser criada após a validação do relatório final de QA e da decisão explícita de **GO PARA RELEASE 1.0**.

Comando para corte da tag oficial:

```bash
# 1. Garantir que a branch main está atualizada
git checkout main
git pull origin main

# 2. Criar a tag anotada com assinatura de versão
git tag -a v1.0.0 -m "Release 1.0.0 — Oficina Gestao (Soldas & Geradores)"

# 3. Enviar a tag para o repositório remoto oficial
git push origin v1.0.0
```
