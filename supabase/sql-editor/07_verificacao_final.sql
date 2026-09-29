-- Execute depois de 01, 04 e 05. Compatível com a coluna data_inicio e o acesso autenticado via RLS.
-- Cada uma das 14 linhas deve retornar OK. Não modifica dados nem permissões.
WITH esperado(tabela, colunas, defaults, primarias, unicas, estrangeiras) AS (
  VALUES
    ('caixas', 'nome:text:1:0|valor:numeric:1:0', 1, 1, 0, 0),
    ('condominios', 'id:bigint:1:1|responsavel:text:1:0|responsabilidade:text:1:0|valor_total:numeric:1:0|valor_parcela:numeric:1:0|parcelas:bigint:1:0|parcelas_pagas:bigint:1:0|vencimento:text:1:0|contrato_numero:bigint:0:0|administradora:text:1:0|pago_ate:text:1:0', 8, 1, 0, 0),
    ('config', 'chave:text:1:0|valor:text:1:0', 0, 1, 0, 0),
    ('contratos', 'numero:bigint:1:0|proprietario:text:1:0|chave_pix:text:1:0|inquilino:text:1:0|endereco:text:1:0|mes_reajuste:text:1:0|aluguel:numeric:1:0|garantia:text:1:0|caucao:numeric:1:0|adiantado:numeric:1:0|tx_incendio:numeric:1:0|fianca:numeric:1:0|condominio:numeric:1:0|iptu:numeric:1:0|agua_luz:numeric:1:0|pct_imob:numeric:1:0|vencimento_dia:bigint:1:0|ativo:bigint:1:0|obs:text:1:0|proprietario_id:bigint:0:0|inquilino_id:bigint:0:0|imovel_id:bigint:0:0', 18, 1, 0, 0),
    ('despesas', 'id:bigint:1:1|tipo:text:1:0|categoria:text:1:0|valor:numeric:1:0|vencimento:text:1:0|situacao:text:1:0|competencia:text:1:0|origem:text:1:0', 6, 1, 0, 0),
    ('imoveis', 'id:bigint:1:1|endereco:text:1:0|tem_iptu:bigint:1:0|tem_condominio:bigint:1:0|relogio_agua:text:1:0|relogio_luz:text:1:0|obs:text:1:0', 5, 1, 0, 0),
    ('iptus', 'id:bigint:1:1|responsavel:text:1:0|responsabilidade:text:1:0|valor_total:numeric:1:0|valor_parcela:numeric:1:0|parcelas:bigint:1:0|parcelas_pagas:bigint:1:0|vencimento:text:1:0|contrato_numero:bigint:0:0|indice_cadastral:text:1:0|cpf_titular:text:1:0|codigo_acesso:text:1:0|pago_ate:text:1:0', 10, 1, 0, 0),
    ('lancamentos', 'id:bigint:1:1|contrato_numero:bigint:1:0|competencia:text:1:0|aluguel:numeric:1:0|caucao:numeric:1:0|adiantado:numeric:1:0|tx_incendio:numeric:1:0|fianca:numeric:1:0|condominio:numeric:1:0|iptu:numeric:1:0|agua_luz:numeric:1:0|pct_imob:numeric:1:0|vencimento_dia:bigint:1:0|recebido_em:text:0:0|via:text:1:0|repassado_em:text:0:0|obs:text:1:0', 12, 1, 1, 1),
    ('leads', 'id:bigint:1:1|nome:text:1:0|telefone:text:1:0|email:text:1:0|origem:text:1:0|interesse:text:1:0|procura:text:1:0|obs:text:1:0|criado_em:text:1:0', 7, 1, 0, 0),
    ('manutencoes', 'id:bigint:1:1|solicitante:text:1:0|origem:text:1:0|contrato_numero:bigint:0:0|detalhes:text:1:0|situacao:text:1:0|data_abertura:text:1:0|data_programada:text:1:0|concluida_por:text:1:0|data_conclusao:text:1:0|valor_materiais:numeric:1:0|valor_mao_obra:numeric:1:0', 10, 1, 0, 0),
    ('notas_fiscais', 'id:bigint:1:1|contrato_numero:bigint:1:0|competencia:text:1:0|valor:numeric:1:0|status:text:1:0|emitida_em:text:0:0|obs:text:1:0|atividade:text:1:0', 4, 1, 1, 0),
    ('pendencias', 'id:bigint:1:1|tipo:text:1:0|ref_id:bigint:1:0|descricao:text:1:0|contrato_numero:bigint:0:0|competencia:text:1:0|valor:numeric:1:0|criada_em:text:1:0|repassado_em:text:0:0', 4, 1, 1, 0),
    ('pessoas', 'id:bigint:1:1|tipo:text:1:0|nome:text:1:0|cpf:text:1:0|email:text:1:0|telefone:text:1:0|aniversario:text:1:0|forma_repasse:text:1:0|dados_bancarios:text:1:0|obs:text:1:0|rg:text:1:0|endereco:text:1:0', 10, 1, 0, 0),
    ('seguros', 'id:bigint:1:1|seguradora:text:1:0|contrato_numero:bigint:0:0|valor_parcela:numeric:1:0|vencimento:text:1:0|parcelas:bigint:1:0|parcelas_pagas:bigint:1:0|obs:text:1:0|pago_ate:text:1:0', 6, 1, 0, 0)
), conferido AS (
  SELECT e.*,
    c.oid,
    c.relrowsecurity,
    (SELECT string_agg(a.attname || ':' || format_type(a.atttypid, a.atttypmod) || ':' ||
      CASE WHEN a.attnotnull THEN '1' ELSE '0' END || ':' ||
      CASE WHEN a.attidentity = 'd' THEN '1' ELSE '0' END, '|' ORDER BY a.attnum)
     FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS colunas_encontradas,
    (SELECT COUNT(*) FROM pg_attrdef d WHERE d.adrelid = c.oid) AS defaults_encontrados,
    (SELECT COUNT(*) FROM pg_constraint x WHERE x.conrelid = c.oid AND x.contype = 'p') AS primarias_encontradas,
    (SELECT COUNT(*) FROM pg_constraint x WHERE x.conrelid = c.oid AND x.contype = 'u') AS unicas_encontradas,
    (SELECT COUNT(*) FROM pg_constraint x WHERE x.conrelid = c.oid AND x.contype = 'f') AS estrangeiras_encontradas,
    (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = e.tabela
      AND p.policyname IN ('equipe le', 'equipe cria', 'equipe edita', 'equipe exclui')
      AND p.roles = ARRAY['authenticated']::name[]) AS politicas_equipe,
    (SELECT COUNT(*) FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = e.tabela) AS politicas_total,
    COALESCE(has_table_privilege('anon', c.oid, 'SELECT') OR
      has_table_privilege('anon', c.oid, 'INSERT') OR
      has_table_privilege('anon', c.oid, 'UPDATE') OR
      has_table_privilege('anon', c.oid, 'DELETE'), TRUE) AS acesso_anon,
    COALESCE(has_table_privilege('authenticated', c.oid, 'SELECT') AND
      has_table_privilege('authenticated', c.oid, 'INSERT') AND
      has_table_privilege('authenticated', c.oid, 'UPDATE') AND
      has_table_privilege('authenticated', c.oid, 'DELETE'), FALSE) AS acesso_equipe
  FROM esperado e LEFT JOIN pg_class c ON c.relname = e.tabela
    AND c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
)
SELECT tabela, CASE
  WHEN oid IS NULL THEN 'TABELA AUSENTE'
  WHEN colunas || CASE WHEN tabela = 'contratos' THEN '|data_inicio:date:0:0' ELSE '' END
    IS DISTINCT FROM colunas_encontradas THEN 'COLUNAS/TIPOS DIFERENTES'
  WHEN defaults <> defaults_encontrados THEN 'DEFAULTS DIFERENTES'
  WHEN primarias <> primarias_encontradas OR unicas <> unicas_encontradas
    OR estrangeiras <> estrangeiras_encontradas THEN 'CONSTRAINTS DIFERENTES'
  WHEN NOT relrowsecurity THEN 'RLS DESLIGADO'
  WHEN acesso_anon THEN 'ACESSO ANON INDEVIDO'
  WHEN politicas_equipe <> 4 OR politicas_total <> 4
    OR to_regprocedure('private.eh_equipe()') IS NULL THEN 'POLÍTICAS DA EQUIPE DIFERENTES'
  WHEN NOT acesso_equipe THEN 'PERMISSÃO DA EQUIPE AUSENTE'
  ELSE 'OK' END AS resultado
FROM conferido ORDER BY tabela;
