-- Aplicar depois de 01_schema.sql e antes de conectar o aplicativo.
-- Convide/crie usuários no Auth. Inclua manualmente seus IDs em equipe_usuarios.
BEGIN;

CREATE TABLE public.equipe_usuarios (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.equipe_usuarios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.equipe_usuarios FROM anon, authenticated;
GRANT SELECT ON public.equipe_usuarios TO authenticated;
CREATE POLICY "equipe consulta propria autorizacao"
    ON public.equipe_usuarios FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated;
CREATE FUNCTION private.eh_equipe() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT (SELECT auth.uid()) IS NOT NULL
       AND EXISTS (
           SELECT 1 FROM public.equipe_usuarios
           WHERE user_id = (SELECT auth.uid())
       );
$$;
REVOKE ALL ON FUNCTION private.eh_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.eh_equipe() TO authenticated;

DO $$
DECLARE tabela TEXT;
BEGIN
    FOREACH tabela IN ARRAY ARRAY[
        'caixas', 'condominios', 'config', 'contratos', 'despesas',
        'imoveis', 'iptus', 'lancamentos', 'leads', 'manutencoes',
        'notas_fiscais', 'pendencias', 'pessoas', 'seguros'
    ] LOOP
        EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tabela);
        EXECUTE format(
            'CREATE POLICY "equipe le" ON public.%I FOR SELECT TO authenticated USING ((SELECT private.eh_equipe()))',
            tabela
        );
        EXECUTE format(
            'CREATE POLICY "equipe cria" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.eh_equipe()))',
            tabela
        );
        EXECUTE format(
            'CREATE POLICY "equipe edita" ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.eh_equipe())) WITH CHECK ((SELECT private.eh_equipe()))',
            tabela
        );
        EXECUTE format(
            'CREATE POLICY "equipe exclui" ON public.%I FOR DELETE TO authenticated USING ((SELECT private.eh_equipe()))',
            tabela
        );
    END LOOP;
END $$;

GRANT USAGE ON SEQUENCE public.condominios_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.despesas_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.imoveis_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.iptus_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.lancamentos_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.leads_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.manutencoes_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.notas_fiscais_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.pendencias_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.pessoas_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE public.seguros_id_seq TO authenticated;
COMMIT;

-- Primeiro acesso: copie o UUID de Authentication > Users e execute separadamente:
-- INSERT INTO public.equipe_usuarios (user_id) VALUES ('UUID-DO-USUARIO');
-- Nunca use metadata editável pelo usuário para autorizar acesso.

