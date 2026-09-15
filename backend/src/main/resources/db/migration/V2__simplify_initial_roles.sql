-- ==============================================================================
-- Oficina Gestão — V2: Simplify Initial Roles for MVP (Single User Admin)
-- Motor: PostgreSQL (Neon)
-- ==============================================================================

-- Remover eventuais vínculos em usuario_roles para manter integridade referencial
DELETE FROM usuario_roles
WHERE role_id IN (
    SELECT id FROM roles WHERE nome IN ('ROLE_GERENTE', 'ROLE_MECANICO', 'ROLE_ATENDENTE')
);

-- Remover os papéis não utilizados no MVP, preservando exclusivamente ROLE_ADMIN
DELETE FROM roles
WHERE nome IN ('ROLE_GERENTE', 'ROLE_MECANICO', 'ROLE_ATENDENTE');
