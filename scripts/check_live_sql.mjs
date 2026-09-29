import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const sql = (name) => readFileSync(new URL(`../supabase/sql-editor/${name}`, import.meta.url), "utf8").replace(/^\uFEFF/, "");
await db.exec(`
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
    id TEXT PRIMARY KEY, name TEXT, public BOOLEAN,
    file_size_limit BIGINT, allowed_mime_types TEXT[]
);
CREATE TABLE storage.objects (bucket_id TEXT);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, DELETE ON storage.objects TO authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
`);
await db.exec(sql("01_schema.sql"));
let verification = await db.query(sql("verificacao_estrutura.sql"));
assert.equal(verification.rows.length, 14);
assert(verification.rows.every((row) => row.resultado === "OK"), "estrutura inicial divergente");
await db.exec(sql("04_acesso_equipe.sql"));
await db.exec(sql("05_operacoes.sql"));
await db.exec(sql("06_modelos_privados.sql"));
verification = await db.query(sql("07_verificacao_final.sql"));
assert.equal(verification.rows.length, 14);
assert(verification.rows.every((row) => row.resultado === "OK"), JSON.stringify(verification.rows));

const staff = "11111111-1111-4111-8111-111111111111";
const stranger = "22222222-2222-4222-8222-222222222222";
await db.query("INSERT INTO auth.users (id) VALUES ($1), ($2)", [staff, stranger]);
await db.exec(`
INSERT INTO public.equipe_usuarios (user_id) VALUES ('${staff}');
INSERT INTO public.contratos (numero, proprietario, inquilino, aluguel, pct_imob, ativo)
VALUES (10, 'Proprietário Teste', 'Inquilino Teste', 2000, 0.1, 1);
INSERT INTO public.seguros (seguradora, contrato_numero, valor_parcela) VALUES ('Seguro Teste', 10, 80);
INSERT INTO public.iptus (responsavel, contrato_numero, valor_parcela) VALUES ('IPTU Teste', 10, 100);
INSERT INTO public.condominios (responsavel, contrato_numero, valor_parcela) VALUES ('Condomínio Teste', 10, 300);
INSERT INTO public.despesas (tipo, categoria, valor, competencia)
VALUES ('Fixa Teste', 'indispensável', 50, '2026-09');
`);

await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub = '${stranger}';`);
let rows = await db.query("SELECT * FROM public.contratos");
assert.equal(rows.rows.length, 0, "usuário fora da equipe não lê contratos");
rows = await db.query("SELECT * FROM public.equipe_usuarios");
assert.equal(rows.rows.length, 0);
await assert.rejects(db.query("INSERT INTO storage.objects (bucket_id) VALUES ('modelos-contrato')"), /row-level security|permission denied/i);
await assert.rejects(db.query("INSERT INTO public.contratos (numero) VALUES (20)"), /row-level security|permission denied/i);
await db.exec(`SET request.jwt.claim.sub = '${staff}';`);
rows = await db.query("SELECT * FROM public.contratos");
assert.equal(rows.rows.length, 1);
await db.query("INSERT INTO storage.objects (bucket_id) VALUES ('modelos-contrato')");
rows = await db.query("SELECT * FROM public.gerar_competencia('2026-09')");
assert.equal(Number(rows.rows[0].criados), 1);
rows = await db.query("SELECT * FROM public.gerar_competencia('2026-09')");
assert.equal(Number(rows.rows[0].criados), 0, "geração é idempotente");
rows = await db.query("SELECT id FROM public.lancamentos WHERE contrato_numero = 10");
const id = Number(rows.rows[0].id);
await db.query("SELECT public.registrar_recebimento($1, '2026-09-24', 'PIX')", [id]);
rows = await db.query("SELECT * FROM public.notas_fiscais");
assert.equal(rows.rows.length, 1);
assert.equal(Number(rows.rows[0].valor), 200);
rows = await db.query("SELECT * FROM public.pendencias");
assert.equal(rows.rows.length, 3, "seguro, IPTU e condomínio geram pendências");
await assert.rejects(db.query("SELECT public.registrar_recebimento($1, '2026-09-24', 'PIX')", [id]), /já recebido/i);
await db.query("SELECT public.estornar_recebimento($1)", [id]);
rows = await db.query("SELECT * FROM public.notas_fiscais");
assert.equal(rows.rows.length, 0, "estorno remove nota não emitida");
rows = await db.query("SELECT * FROM public.pendencias");
assert.equal(rows.rows.length, 0, "estorno remove pendências abertas");
await db.query("SELECT public.registrar_recebimento($1, '2026-09-24', 'PIX')", [id]);
await db.query("SELECT * FROM public.gerar_competencia('2026-10')");
await db.query("UPDATE public.contratos SET aluguel = 2300 WHERE numero = 10");
rows = await db.query("SELECT competencia, aluguel FROM public.lancamentos ORDER BY competencia");
assert.equal(Number(rows.rows[0].aluguel), 2000, "histórico recebido preservado");
assert.equal(Number(rows.rows[1].aluguel), 2300, "futuro pendente acompanha contrato");
await db.query("UPDATE public.contratos SET ativo = 0 WHERE numero = 10");
rows = await db.query("SELECT competencia FROM public.lancamentos");
assert.deepEqual(rows.rows.map((row) => row.competencia), ["2026-09"], "encerramento preserva histórico");
rows = await db.query("SELECT public.copiar_despesas('2026-09','2026-10',false) AS copiadas");
assert.equal(Number(rows.rows[0].copiadas), 1);
rows = await db.query("SELECT public.copiar_despesas('2026-09','2026-10',false) AS copiadas");
assert.equal(Number(rows.rows[0].copiadas), 0, "cópia repetida não duplica despesas");
await db.query("UPDATE public.despesas SET vencimento = '2026-09-30' WHERE competencia = '2026-09'");
rows = await db.query("SELECT public.copiar_despesas('2026-09','2027-02',false) AS copiadas");
assert.equal(Number(rows.rows[0].copiadas), 1);
rows = await db.query("SELECT vencimento FROM public.despesas WHERE competencia = '2027-02'");
assert.equal(rows.rows[0].vencimento, "2027-02-28", "vencimento é ajustado ao último dia do mês");

rows = await db.query("SELECT id FROM public.iptus LIMIT 1");
const iptuId = Number(rows.rows[0].id);
await db.query("SELECT public.registrar_parcela('iptus',$1,'2026-09')", [iptuId]);
await assert.rejects(db.query("SELECT public.registrar_parcela('iptus',$1,'2026-09')", [iptuId]), /já paga/i);
console.log("SQL: RLS, competência, recebimento, estorno, contrato, despesas e parcelas OK");
await db.close();

