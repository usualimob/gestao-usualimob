import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const sql = (name) => readFileSync(new URL(`../supabase/sql-editor/${name}`, import.meta.url), "utf8").replace(/^\uFEFF/, "");
function python(code) {
  try { return execFileSync("python", ["-c", code], { encoding: "utf8", maxBuffer: 5_000_000, env: { ...process.env, PYTHONIOENCODING: "utf-8" } }); }
  catch { throw new Error("Falha ao ler os snapshots SQLite locais."); }
}
if (!existsSync(new URL("../supabase/sql-editor/09_atualizacao_dados.sql", import.meta.url))) {
  throw new Error("Gere o script privado com python scripts/update_existing_supabase.py antes da verificação.");
}
const oldData = python(`
import hashlib, sqlite3, sys
sys.path.insert(0, "scripts")
from export_sqlite_to_supabase import generate
from pathlib import Path
path = Path("banco/gestao-antes-atualizacao.db")
connection = sqlite3.connect(path)
connection.row_factory = sqlite3.Row
print(generate(connection, hashlib.sha256(path.read_bytes()).hexdigest())[1], end="")
`);
const expected = JSON.parse(python(`
import json, sqlite3, sys
sys.path.insert(0, "scripts")
from export_sqlite_to_supabase import TABLES, identifier
connection = sqlite3.connect("banco/gestao.db")
print(json.dumps({table: connection.execute("SELECT count(*) FROM " + identifier(table)).fetchone()[0] for table in TABLES}))
`));
const db = new PGlite();
await db.exec(`
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE
AS $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
`);
for (const [stage, source] of [
  ["schema", sql("01_schema.sql")], ["snapshot anterior", oldData],
  ["equipe", sql("04_acesso_equipe.sql")], ["operações", sql("05_operacoes.sql")],
  ["parcelas", sql("08_parcelas_avulsas.sql")], ["atualização", sql("09_atualizacao_dados.sql")],
]) {
  try { await db.exec(source); }
  catch (error) { throw new Error(`Falha na etapa ${stage} (Postgres ${error.code ?? "sem código"}).`); }
}
for (const [table, count] of Object.entries(expected)) {
  const result = await db.query(`SELECT count(*) AS total FROM public.${table}`);
  assert.equal(Number(result.rows[0].total), count, `${table}: contagem após atualização`);
}
await db.close();
console.log("Atualização SQLite antigo → novo aplicada no Postgres local; 14 contagens OK");
