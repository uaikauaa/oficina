-- V14: Limpeza das Estruturas Fiscais Não Utilizadas (NFS-e / DPS)
-- Fase 6.6 — Oficina Gestão / Bruno Soldas
-- O sistema é exclusivamente comercial/operacional. Não emite NFS-e.
-- O Recibo Comercial é o documento fiscal oficial do sistema.

-- 1. Remover tabela de Documentos de Preparação para NFS-e (DPS)
--    Dependências verificadas: nenhuma tabela legítima referencia dps_fiscal.
DROP TABLE IF EXISTS dps_fiscal;

-- 2. Remover tabela de Controle de Numeração Sequencial da DPS
--    Dependências verificadas: nenhuma tabela legítima referencia dps_numeracao.
DROP TABLE IF EXISTS dps_numeracao;

-- 3. Remover colunas fiscais da tabela configuracao_oficina
--    Verificado: PdfService, Recibo e Documento de Serviço NÃO utilizam estes campos.
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS inscricao_municipal;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS regime_tributario;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS codigo_tributacao_servico;
ALTER TABLE configuracao_oficina DROP COLUMN IF EXISTS codigo_ibge;

-- DECISÃO: clientes.codigo_ibge é PRESERVADO.
-- O campo existe no cadastro de clientes, aparece nos tipos do frontend
-- e pode ter utilidade cadastral legítima futura. Remoção adiada por segurança.

-- Estruturas preservadas intactas:
-- - ordens_servico (OS, valores, laudo técnico)
-- - clientes (incluindo codigo_ibge)
-- - maquinas (equipamentos)
-- - produtos, estoque, estoque_movimentacoes
-- - configuracao_oficina (dados comerciais: nome, cnpj, responsavel, contato, endereco)
-- - usuarios, refresh_tokens, roles
-- - Spring Security, JWT, CORS, rate limiting
