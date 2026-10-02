"""Confere se os scripts locais correspondem ao SQLite atual, sem exibir registros."""

import hashlib
import sqlite3

from export_sqlite_to_supabase import OUTPUT, SOURCE, generate, literal, structure_check
from update_existing_supabase import PREVIOUS, TARGET, generate_update


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

previous = sqlite3.connect(f"file:{PREVIOUS.resolve().as_posix()}?mode=ro", uri=True)
current = sqlite3.connect(f"file:{SOURCE.resolve().as_posix()}?mode=ro", uri=True)
for connection in (previous, current):
    connection.row_factory = sqlite3.Row
try:
    assert TARGET.read_text(encoding="utf-8") == generate_update(previous, current), (
        f"{TARGET.name} está desatualizado. Execute: python scripts/update_existing_supabase.py"
    )
finally:
    previous.close()
    current.close()
print("Atualização do snapshot anterior corresponde aos bancos locais.")
