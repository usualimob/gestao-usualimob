-- Executar após 04_acesso_equipe.sql. Funções invoker respeitam RLS.
BEGIN;

ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS data_inicio DATE;

CREATE OR REPLACE FUNCTION public.gerar_competencia(p_competencia TEXT)
RETURNS TABLE (criados BIGINT, removidos BIGINT)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    IF p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Competência inválida: use AAAA-MM';
    END IF;

    INSERT INTO public.lancamentos (
        contrato_numero, competencia, aluguel, caucao, adiantado,
        tx_incendio, fianca, condominio, iptu, agua_luz, pct_imob, vencimento_dia
    )
    SELECT numero, p_competencia, aluguel, caucao, adiantado,
           tx_incendio, fianca, condominio, iptu, agua_luz, pct_imob, vencimento_dia
    FROM public.contratos WHERE ativo = 1
    ON CONFLICT (contrato_numero, competencia) DO NOTHING;
    GET DIAGNOSTICS criados = ROW_COUNT;

    DELETE FROM public.lancamentos l
    USING public.contratos c
    WHERE l.contrato_numero = c.numero AND c.ativo = 0
      AND l.competencia = p_competencia AND l.recebido_em IS NULL;
    GET DIAGNOSTICS removidos = ROW_COUNT;
    RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_recebimento(
    p_id BIGINT, p_data TEXT, p_via TEXT DEFAULT ''
)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE
    lanc public.lancamentos%ROWTYPE;
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    IF p_data !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
       OR to_char(to_date(p_data, 'YYYY-MM-DD'), 'YYYY-MM-DD') <> p_data THEN
        RAISE EXCEPTION 'Data inválida';
    END IF;

    UPDATE public.lancamentos SET recebido_em = p_data, via = p_via
    WHERE id = p_id AND recebido_em IS NULL RETURNING * INTO lanc;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lançamento não encontrado ou já recebido'; END IF;

    INSERT INTO public.notas_fiscais (contrato_numero, competencia, valor)
    VALUES (lanc.contrato_numero, lanc.competencia, round(lanc.aluguel * lanc.pct_imob, 2))
    ON CONFLICT (contrato_numero, competencia) DO NOTHING;

    INSERT INTO public.pendencias (tipo, ref_id, descricao, contrato_numero, competencia, valor, criada_em)
    SELECT 'seguro', id, 'Seguro ' || seguradora, lanc.contrato_numero, lanc.competencia,
           valor_parcela, p_data
    FROM public.seguros WHERE contrato_numero = lanc.contrato_numero
    ON CONFLICT (tipo, ref_id, competencia) DO NOTHING;

    INSERT INTO public.pendencias (tipo, ref_id, descricao, contrato_numero, competencia, valor, criada_em)
    SELECT 'iptu', id, 'IPTU ' || responsavel, lanc.contrato_numero, lanc.competencia,
           valor_parcela, p_data
    FROM public.iptus WHERE contrato_numero = lanc.contrato_numero
    ON CONFLICT (tipo, ref_id, competencia) DO NOTHING;

    INSERT INTO public.pendencias (tipo, ref_id, descricao, contrato_numero, competencia, valor, criada_em)
    SELECT 'condominio', id, 'Condomínio ' || COALESCE(NULLIF(administradora, ''), responsavel),
           lanc.contrato_numero, lanc.competencia, valor_parcela, p_data
    FROM public.condominios WHERE contrato_numero = lanc.contrato_numero
    ON CONFLICT (tipo, ref_id, competencia) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.copiar_despesas(
    p_origem TEXT, p_destino TEXT, p_incluir_ordinarias BOOLEAN DEFAULT FALSE
)
RETURNS BIGINT LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE copiadas BIGINT;
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    IF p_origem !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR p_destino !~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
       OR p_origem = p_destino THEN
        RAISE EXCEPTION 'Competências inválidas ou iguais';
    END IF;
    INSERT INTO public.despesas (tipo, categoria, valor, vencimento, situacao, competencia, origem)
    SELECT tipo, categoria, valor,
           CASE WHEN vencimento ~ '^[0-9]{4}-[0-9]{2}-(0[1-9]|[12][0-9]|3[01])$'
                THEN p_destino || '-' || lpad(
                    LEAST(
                        substring(vencimento, 9, 2)::int,
                        EXTRACT(DAY FROM (
                            make_date(substring(p_destino, 1, 4)::int, substring(p_destino, 6, 2)::int, 1)
                            + INTERVAL '1 month - 1 day'
                        ))::int
                    )::text, 2, '0'
                )
                ELSE vencimento END,
           'pendente', p_destino, origem
    FROM public.despesas origem
    WHERE origem.competencia = p_origem
      AND (p_incluir_ordinarias OR origem.categoria <> 'ordinária')
      AND NOT EXISTS (
          SELECT 1 FROM public.despesas destino
          WHERE destino.competencia = p_destino
            AND destino.tipo = origem.tipo
            AND destino.categoria = origem.categoria
            AND destino.origem = origem.origem
      );
    GET DIAGNOSTICS copiadas = ROW_COUNT;
    RETURN copiadas;
END;
$$;

CREATE OR REPLACE FUNCTION public.registrar_parcela(
    p_tabela TEXT, p_id BIGINT, p_competencia TEXT
)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE atualizados BIGINT;
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    IF p_tabela NOT IN ('iptus', 'condominios', 'seguros')
       OR p_competencia !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' THEN
        RAISE EXCEPTION 'Parâmetros inválidos';
    END IF;
    EXECUTE format(
        'UPDATE public.%I SET parcelas_pagas = parcelas_pagas + 1, pago_ate = $1
         WHERE id = $2 AND pago_ate < $1
           AND (parcelas = 0 OR parcelas_pagas < parcelas)',
        p_tabela
    ) USING p_competencia, p_id;
    GET DIAGNOSTICS atualizados = ROW_COUNT;
    IF atualizados <> 1 THEN RAISE EXCEPTION 'Parcela já paga, encerrada ou inexistente'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION private.propagar_contrato()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE mes_atual TEXT := to_char((now() AT TIME ZONE 'America/Fortaleza')::date, 'YYYY-MM');
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    UPDATE public.lancamentos SET
        aluguel = NEW.aluguel, tx_incendio = NEW.tx_incendio,
        fianca = NEW.fianca, condominio = NEW.condominio, iptu = NEW.iptu,
        agua_luz = NEW.agua_luz, pct_imob = NEW.pct_imob,
        vencimento_dia = NEW.vencimento_dia
    WHERE contrato_numero = NEW.numero AND recebido_em IS NULL AND competencia >= mes_atual;

    IF OLD.ativo = 1 AND NEW.ativo = 0 THEN
        DELETE FROM public.lancamentos
        WHERE contrato_numero = NEW.numero AND recebido_em IS NULL AND competencia >= mes_atual;
    END IF;
    RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.propagar_contrato() FROM PUBLIC, anon;
CREATE TRIGGER contratos_propagar
AFTER UPDATE OF aluguel, tx_incendio, fianca, condominio, iptu, agua_luz, pct_imob, vencimento_dia, ativo ON public.contratos
FOR EACH ROW EXECUTE FUNCTION private.propagar_contrato();

CREATE OR REPLACE FUNCTION public.estornar_recebimento(p_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY INVOKER SET search_path = ''
AS $$
DECLARE lanc public.lancamentos%ROWTYPE;
BEGIN
    IF NOT (SELECT private.eh_equipe()) THEN RAISE EXCEPTION 'Acesso negado'; END IF;
    SELECT * INTO lanc FROM public.lancamentos WHERE id = p_id FOR UPDATE;
    IF NOT FOUND OR lanc.recebido_em IS NULL THEN
        RAISE EXCEPTION 'Lançamento não recebido ou inexistente';
    END IF;
    IF lanc.repassado_em IS NOT NULL THEN
        RAISE EXCEPTION 'Desfaça o repasse antes de estornar o recebimento';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.notas_fiscais
        WHERE contrato_numero = lanc.contrato_numero
          AND competencia = lanc.competencia AND status = 'emitida'
    ) THEN
        RAISE EXCEPTION 'Nota emitida: ajuste a nota antes de estornar';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.pendencias
        WHERE contrato_numero = lanc.contrato_numero
          AND competencia = lanc.competencia AND repassado_em IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Há pendência repassada: ajuste o repasse antes de estornar';
    END IF;
    DELETE FROM public.pendencias
    WHERE contrato_numero = lanc.contrato_numero AND competencia = lanc.competencia;
    DELETE FROM public.notas_fiscais
    WHERE contrato_numero = lanc.contrato_numero AND competencia = lanc.competencia;
    UPDATE public.lancamentos SET recebido_em = NULL, via = ''
    WHERE id = p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.gerar_competencia(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_recebimento(BIGINT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.copiar_despesas(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.registrar_parcela(TEXT, BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.estornar_recebimento(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gerar_competencia(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_recebimento(BIGINT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.copiar_despesas(TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_parcela(TEXT, BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.estornar_recebimento(BIGINT) TO authenticated;
COMMIT;

