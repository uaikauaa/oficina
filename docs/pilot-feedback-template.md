# Modelo Oficial de Coleta de Feedback, Incidentes e Melhorias
## Operação Piloto — Oficina Gestão (Release 1.0.0)

Este documento estabelece os padrões e instrumentos formais para registro de observações, incidentes, bugs e solicitações de melhoria durante a operação piloto do sistema **Oficina Gestão** (Soldas & Geradores).

---

## 1. Formulário de Entrevista / Coleta de Feedback com Usuários da Oficina

Este questionário deve ser aplicado periodicamente junto à proprietária e aos técnicos responsáveis pelo balcão e bancada:

1. **O que você tentou fazer no sistema?**
2. **Conseguiu realizar a ação sem impedimentos?**
3. **Em qual tela ou momento você ficou com dúvida sobre como prosseguir?**
4. **Qual etapa ou processo pareceu demorado ou burocrático demais?**
5. **Qual informação ou dado técnico você sentiu falta na tela ou no cadastro?**
6. **O que você gostaria que o sistema fizesse mais rapidamente ou com menos cliques?**
7. **Qual tela ou formulário foi o mais difícil de preencher? Por quê?**
8. **Você precisou anotar algum dado no papel ou fora do sistema durante o atendimento? O que foi anotado?**
9. **Alguma informação sobre o cliente, equipamento ou peça ficou difícil de localizar?**
10. **O PDF gerado da Ordem de Serviço atende plenamente ao que a oficina precisa entregar ao cliente no balcão?**

---

## 2. Template Padrão de Registro de Incidentes

Todos os incidentes operacionais ocorridos em produção durante o piloto devem ser registrados no seguinte formato:

```markdown
### INCIDENT-[NUMERO]

- **Data**: YYYY-MM-DD
- **Hora**: HH:mm:ss (Horário de Brasília)
- **Usuário**: [Nome do operador ou perfil]
- **Tela**: [URL ou nome da tela / modal]
- **Ação**: [Ação específica que estava sendo executada]
- **Resultado esperado**: [O que o sistema deveria ter feito]
- **Resultado obtido**: [O que o sistema de fato fez ou erro exibido]
- **Impacto**: [Consequência para o atendimento da oficina]
- **Frequência**: [Ocorreu 1 vez / Esporádico / Sistemático]
- **Evidência**: [Mensagem de erro, log HTTP, print ou descrição]
- **Reprodução**: [Passo a passo exato para simular a ocorrência]
- **Classificação**: [P0 / P1 / P2 / P3]
```

### Matriz de Severidade de Incidentes:
- **P0**: Sistema indisponível ou perda/corrupção de dados (parada total da oficina).
- **P1**: Operação crítica comprometida sem contorno viável (ex: incapacidade de concluir OS ou deduzir peça).
- **P2**: Problema funcional relevante com contorno operacional disponível.
- **P3**: Problema menor, de usabilidade, layout ou conveniência.

---

## 3. Template Padrão de Registro de Bugs

Falhas de software onde o comportamento implementado diverge do requisito especificado:

```markdown
### BUG-[NUMERO]

- **Título**: [Resumo conciso da falha]
- **Categoria**: [Backend / Frontend / Banco de Dados / PDF / Autenticação]
- **Severidade**: [Crítica (P0/P1) / Alta (P2) / Média ou Baixa (P3)]
- **Reprodução**: [Passo a passo numerado para disparar o bug]
- **Causa provável**: [Análise preliminar de código, regra ou constraint]
- **Impacto**: [Reflexo nos dados, na interface ou no fluxo do usuário]
- **Correção proposta**: [Direcionamento técnico para a Versão 1.1 — SEM aplicar agora]
```

---

## 4. Template Padrão de Solicitação de Melhoria (Feature Requests)

Novas capacidades, simplificações de fluxo ou ajustes de usabilidade que não configuram erro, mas agregam valor real ao dia a dia da oficina:

```markdown
### FEATURE-[NUMERO]

- **Título**: [Nome claro da funcionalidade ou ajuste sugerido]
- **Descrição**: [Detalhamento do que a funcionalidade deve fazer]
- **Problema que resolve**: [Dor operacional ou necessidade real observada no piloto]
- **Quem solicitou**: [Proprietária / Técnico de Bancada / Atendente]
- **Frequência de uso**: [Diário em todas as OSs / Frequente / Ocasional]
- **Impacto operacional**: [Alto ganho de agilidade / Redução de erros manuais / Conveniência]
- **Complexidade estimada**: [Baixa / Média / Alta]
- **Priorização sugerida para v1.1**: [P1 / P2 / P3]
```

---

## 5. Protocolo de Auditoria e Reconciliação de Estoque

Durante a operação piloto, o inventário físico da oficina de soldas e geradores deve ser confrontado periodicamente com o saldo registrado no sistema:

| Código | Descrição da Peça / Insumo | Aplicação Típica | Saldo Sistema | Saldo Físico | Divergência | Causa Identificada |
|---|---|---|---|---|---|---|
| `IGBT-40N120` | Transistor IGBT 40A 1200V | Máquinas de Solda Inversoras | | | | |
| `AVR-TOY-8K` | Regulador de Tensão AVR 8kVA | Geradores de Energia | | | | |
| `CAB-SOL-35` | Cabo de Solda Emborrachado 35mm² | Conjunto de Solda | | | | |
| `GAR-ENG-500` | Garra Negativa 500A Latão | Terra de Máquinas de Solda | | | | |
| `FIL-OLEO-GEN` | Filtro de Óleo Lubrificante | Geradores a Diesel | | | | |
| `OLEO-15W40` | Óleo Lubrificante Mineral 15W40 (L) | Motores de Geradores | | | | |
