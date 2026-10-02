-- Gerado de banco/gestao.db; SHA-256: 43298f4bde0a5ee55a2989824801d793e8731dcba47b416d25adb0d828b33977
-- Execute somente no projeto Supabase correto e vazio. Arquivo UTF-8.

-- 03: todas as contagens devem aparecer como OK.
WITH contagens(tabela, esperado, encontrado) AS (
  VALUES
    ('caixas', 5, (SELECT COUNT(*) FROM public."caixas")),
    ('condominios', 0, (SELECT COUNT(*) FROM public."condominios")),
    ('config', 7, (SELECT COUNT(*) FROM public."config")),
    ('contratos', 157, (SELECT COUNT(*) FROM public."contratos")),
    ('despesas', 77, (SELECT COUNT(*) FROM public."despesas")),
    ('imoveis', 8, (SELECT COUNT(*) FROM public."imoveis")),
    ('iptus', 9, (SELECT COUNT(*) FROM public."iptus")),
    ('lancamentos', 332, (SELECT COUNT(*) FROM public."lancamentos")),
    ('leads', 0, (SELECT COUNT(*) FROM public."leads")),
    ('manutencoes', 10, (SELECT COUNT(*) FROM public."manutencoes")),
    ('notas_fiscais', 71, (SELECT COUNT(*) FROM public."notas_fiscais")),
    ('pendencias', 2, (SELECT COUNT(*) FROM public."pendencias")),
    ('pessoas', 18, (SELECT COUNT(*) FROM public."pessoas")),
    ('seguros', 4, (SELECT COUNT(*) FROM public."seguros"))
)
SELECT tabela, esperado, encontrado,
       CASE WHEN esperado = encontrado THEN 'OK' ELSE 'DIVERGENTE' END AS resultado
FROM contagens ORDER BY tabela;

-- Próximo ID de cada tabela com AUTOINCREMENT no SQLite.
WITH sequencias(tabela, esperado, encontrado) AS (
  VALUES
    ('condominios', 2, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."condominios_id_seq")),
    ('despesas', 164, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."despesas_id_seq")),
    ('imoveis', 11, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."imoveis_id_seq")),
    ('iptus', 10, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."iptus_id_seq")),
    ('lancamentos', 892, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."lancamentos_id_seq")),
    ('leads', 4, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."leads_id_seq")),
    ('manutencoes', 12, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."manutencoes_id_seq")),
    ('notas_fiscais', 78, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."notas_fiscais_id_seq")),
    ('pendencias', 4, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."pendencias_id_seq")),
    ('pessoas', 24, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."pessoas_id_seq")),
    ('seguros', 6, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."seguros_id_seq"))
)
SELECT tabela, esperado, encontrado,
       CASE WHEN esperado = encontrado THEN 'OK' ELSE 'DIVERGENTE' END AS resultado
FROM sequencias ORDER BY tabela;
