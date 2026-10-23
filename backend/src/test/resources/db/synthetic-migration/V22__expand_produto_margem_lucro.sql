-- numeric(12,2) permite venda até 9.999.999.999,99 e custo positivo mínimo 0,01.
-- ((9.999.999.999,99 - 0,01) / 0,01) * 100 = 99.999.999.999.800,00%.
-- São 14 dígitos inteiros e 2 decimais: numeric(16,2).
ALTER TABLE produtos ALTER COLUMN margem_lucro TYPE NUMERIC(16, 2);
