-- Aplicar após 04_acesso_equipe.sql. Execute uma vez no SQL Editor.
BEGIN;

ALTER TABLE public.equipe_usuarios
    ADD COLUMN nome TEXT NOT NULL DEFAULT '',
    ADD COLUMN email TEXT NOT NULL DEFAULT '',
    ADD COLUMN papel TEXT NOT NULL DEFAULT 'funcionario' CHECK (papel IN ('admin', 'funcionario')),
    ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN pode_editar TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.equipe_usuarios AS equipe
SET nome = COALESCE(usuario.raw_user_meta_data ->> 'name', ''),
    email = COALESCE(usuario.email, ''),
    pode_editar = ARRAY[
        'caixas','condominios','config','contratos','despesas','imoveis','iptus',
        'lancamentos','leads','manutencoes','notas_fiscais','pendencias','pessoas','seguros'
    ]
FROM auth.users AS usuario
WHERE equipe.user_id = usuario.id;

-- A primeira conta previamente autorizada administra os convites.
UPDATE public.equipe_usuarios
SET papel = 'admin'
WHERE user_id = (SELECT user_id FROM public.equipe_usuarios ORDER BY criado_em, user_id LIMIT 1);

CREATE OR REPLACE FUNCTION private.eh_equipe() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.equipe_usuarios
        WHERE user_id = (SELECT auth.uid()) AND ativo
    );
$$;

CREATE FUNCTION private.eh_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.equipe_usuarios
        WHERE user_id = (SELECT auth.uid()) AND ativo AND papel = 'admin'
    );
$$;

CREATE FUNCTION private.pode_editar(p_tabela TEXT) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
    SELECT (SELECT auth.uid()) IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.equipe_usuarios
        WHERE user_id = (SELECT auth.uid()) AND ativo
          AND (papel = 'admin' OR p_tabela = ANY(pode_editar))
    );
$$;
REVOKE ALL ON FUNCTION private.eh_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.pode_editar(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.eh_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION private.pode_editar(TEXT) TO authenticated;

DROP POLICY "equipe consulta propria autorizacao" ON public.equipe_usuarios;
CREATE POLICY "equipe consulta autorizacao" ON public.equipe_usuarios
FOR SELECT TO authenticated
USING (user_id = (SELECT auth.uid()) OR (SELECT private.eh_admin()));

DO $$
DECLARE tabela TEXT;
BEGIN
    FOREACH tabela IN ARRAY ARRAY[
        'caixas','condominios','config','contratos','despesas','imoveis','iptus',
        'lancamentos','leads','manutencoes','notas_fiscais','pendencias','pessoas','seguros'
    ] LOOP
        EXECUTE format('DROP POLICY "equipe cria" ON public.%I', tabela);
        EXECUTE format('DROP POLICY "equipe edita" ON public.%I', tabela);
        EXECUTE format('DROP POLICY "equipe exclui" ON public.%I', tabela);
        EXECUTE format('CREATE POLICY "equipe cria" ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT private.pode_editar(%L)))', tabela, tabela);
        EXECUTE format('CREATE POLICY "equipe edita" ON public.%I FOR UPDATE TO authenticated USING ((SELECT private.pode_editar(%L))) WITH CHECK ((SELECT private.pode_editar(%L)))', tabela, tabela, tabela);
        EXECUTE format('CREATE POLICY "equipe exclui" ON public.%I FOR DELETE TO authenticated USING ((SELECT private.pode_editar(%L)))', tabela, tabela);
    END LOOP;
END $$;

DROP POLICY "equipe envia modelos" ON storage.objects;
DROP POLICY "equipe remove modelos" ON storage.objects;
CREATE POLICY "equipe envia modelos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'modelos-contrato' AND (SELECT private.pode_editar('contratos')));
CREATE POLICY "equipe remove modelos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'modelos-contrato' AND (SELECT private.pode_editar('contratos')));
COMMIT;
