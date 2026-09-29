-- Executar após 04_acesso_equipe.sql.
-- Modelos DOCX contêm texto empresarial e devem ficar em bucket privado.
BEGIN;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'modelos-contrato', 'modelos-contrato', false, 5242880,
    ARRAY['application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "equipe consulta modelos" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'modelos-contrato' AND (SELECT private.eh_equipe()));
CREATE POLICY "equipe envia modelos" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'modelos-contrato' AND (SELECT private.eh_equipe()));
CREATE POLICY "equipe remove modelos" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'modelos-contrato' AND (SELECT private.eh_equipe()));
COMMIT;

