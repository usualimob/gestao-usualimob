-- Atualização incremental após 05_operacoes.sql. Pode ser executada novamente.
-- Não recria tabelas nem modifica registros existentes durante a instalação.
BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_parcela_avulsa(p_tabela TEXT, p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE atualizados BIGINT;
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    IF p_tabela NOT IN ('iptus', 'condominios', 'seguros') OR p_id IS NULL OR p_id < 1 THEN
        RAISE EXCEPTION 'Parâmetros inválidos';
    END IF;
    EXECUTE format(
        'UPDATE public.%I SET parcelas_pagas = parcelas_pagas + 1
         WHERE id = $1 AND (parcelas = 0 OR parcelas_pagas < parcelas)',
        p_tabela
    ) USING p_id;
    GET DIAGNOSTICS atualizados = ROW_COUNT;
    IF atualizados <> 1 THEN RAISE EXCEPTION 'Parcela encerrada ou inexistente'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_parcela_avulsa(TEXT, BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_parcela_avulsa(TEXT, BIGINT) TO authenticated;
COMMIT;
