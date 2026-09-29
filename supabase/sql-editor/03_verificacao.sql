-- Gerado de banco/gestao.db; SHA-256: ed36954661652c7c1f07c8df1d07c724376e03eba4d599372db14cbcaf044ab4
-- Execute somente no projeto Supabase correto e vazio. Arquivo UTF-8.

-- 03: todas as contagens devem aparecer como OK.
WITH contagens(tabela, esperado, encontrado) AS (
  VALUES
    ('caixas', 5, (SELECT COUNT(*) FROM public."caixas")),
    ('condominios', 0, (SELECT COUNT(*) FROM public."condominios")),
    ('config', 7, (SELECT COUNT(*) FROM public."config")),
    ('contratos', 153, (SELECT COUNT(*) FROM public."contratos")),
    ('despesas', 52, (SELECT COUNT(*) FROM public."despesas")),
    ('imoveis', 4, (SELECT COUNT(*) FROM public."imoveis")),
    ('iptus', 9, (SELECT COUNT(*) FROM public."iptus")),
    ('lancamentos', 265, (SELECT COUNT(*) FROM public."lancamentos")),
    ('leads', 0, (SELECT COUNT(*) FROM public."leads")),
    ('manutencoes', 7, (SELECT COUNT(*) FROM public."manutencoes")),
    ('notas_fiscais', 19, (SELECT COUNT(*) FROM public."notas_fiscais")),
    ('pendencias', 0, (SELECT COUNT(*) FROM public."pendencias")),
    ('pessoas', 11, (SELECT COUNT(*) FROM public."pessoas")),
    ('seguros', 4, (SELECT COUNT(*) FROM public."seguros"))
)
SELECT tabela, esperado, encontrado,
       CASE WHEN esperado = encontrado THEN 'OK' ELSE 'DIVERGENTE' END AS resultado
FROM contagens ORDER BY tabela;

-- Próximo ID de cada tabela com AUTOINCREMENT no SQLite.
WITH sequencias(tabela, esperado, encontrado) AS (
  VALUES
    ('condominios', 2, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."condominios_id_seq")),
    ('despesas', 139, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."despesas_id_seq")),
    ('imoveis', 7, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."imoveis_id_seq")),
    ('iptus', 10, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."iptus_id_seq")),
    ('lancamentos', 552, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."lancamentos_id_seq")),
    ('leads', 4, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."leads_id_seq")),
    ('manutencoes', 9, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."manutencoes_id_seq")),
    ('notas_fiscais', 23, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."notas_fiscais_id_seq")),
    ('pendencias', 2, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."pendencias_id_seq")),
    ('pessoas', 17, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."pessoas_id_seq")),
    ('seguros', 6, (SELECT last_value + CASE WHEN is_called THEN 1 ELSE 0 END FROM public."seguros_id_seq"))
)
SELECT tabela, esperado, encontrado,
       CASE WHEN esperado = encontrado THEN 'OK' ELSE 'DIVERGENTE' END AS resultado
FROM sequencias ORDER BY tabela;
