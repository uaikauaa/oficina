# Diagnósticos Java do VS Code

O número **~540** veio do relato do usuário. Não foi fornecida uma exportação do painel Problemas com arquivo, linha, coluna, código, mensagem, origem e severidade. As capturas locais encontradas são telas da aplicação; não contêm a lista de diagnósticos. Portanto, **zero dos ~540 foram individualmente classificados** e não se pode declarar o painel resolvido.

Evidências reproduzíveis de código:

- JDK no terminal/Maven: Temurin **21.0.12.1**; Maven Wrapper **3.9.16**.
- `./mvnw.cmd -B -ntp clean verify` na branch consolidada: **800 testes, zero falhas/erros/skips, build aprovado**. Compilação e classpath de `src/main/java` e `src/test/java` funcionaram.
- O projeto não contém `.vscode/settings.json` com JDK ou Maven alternativos. O `pom.xml` define Java 21; tipos Spring/Jakarta são resolvidos pelo Maven. O PR #9 corrigiu sete TS2339; ambos os `tsc` passaram nesta integração.

Evidências do editor no workspace original, preservado sem modificações: extensão `redhat.java-1.59.2026103008` e Java Test `0.47.0`. O log de JDT LS registrou **142 eventos de erro** no workspace original e **10** no worktree da auditoria; eventos de log não correspondem necessariamente a diagnósticos do painel. Entre as mensagens: falha ao carregar bundles, `org.objectweb.asm 9.10.1` já instalado, falha ao atualizar o bundle JDT LS e erro interno `Initialize workspace` por `NullPointerException`. Também registra importação Maven concluída e troca da VM padrão para o JRE 25 embarcado na extensão, apesar do Maven usar JDK 21. São sinais de problema de ambiente/indexação, **não prova de que todos os 540 itens têm a mesma causa**.

O acesso de automação de UI necessário para exportar o painel não estava disponível nesta sessão; por isso não alterei nem limpei o cache do VS Code do usuário. A exportação dos diagnósticos foi solicitada ao usuário. Próxima validação: abrir a branch de integração em workspace limpo, selecionar o JDK 21 para o projeto, atualizar ou isolar a combinação de extensões Java conflitantes, reimportar o Maven e capturar o painel Problemas completo antes/depois. Classificar cada item; qualquer erro verdadeiro de compilação/tipagem exige correção no código e teste. A aprovação para merge permanece bloqueada até essa evidência existir.
