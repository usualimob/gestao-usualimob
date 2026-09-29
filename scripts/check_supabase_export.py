"""Confere se os scripts locais correspondem ao SQLite atual, sem exibir registros."""

import hashlib
import sqlite3

from export_sqlite_to_supabase import OUTPUT, SOURCE, generate, literal, structure_check


assert literal("D'Água\\teste\n") == "'D''Água\\teste\n'"
assert literal(None) == "NULL"

connection = sqlite3.connect(f"file:{SOURCE.resolve().as_posix()}?mode=ro", uri=True)
connection.row_factory = sqlite3.Row
try:
    source_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    expected = (*generate(connection, source_hash), structure_check(connection, source_hash))
finally:
    connection.close()

for name, contents in zip(
    ("01_schema.sql", "02_dados.sql", "03_verificacao.sql", "verificacao_estrutura.sql"), expected, strict=True
):
    assert (OUTPUT / name).read_text(encoding="utf-8") == contents, (
        f"{name} está desatualizado. Execute: python scripts/export_sqlite_to_supabase.py"
    )

print("Scripts correspondem ao SQLite atual; aspas, barras e quebras de linha verificadas.")
