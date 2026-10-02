"""Gera uma atualização transacional do snapshot antigo para o SQLite atual.

Execute depois de export_sqlite_to_supabase.py. O SQL gerado contém dados pessoais
e só deve ser executado no projeto que recebeu o snapshot anterior integralmente.
"""

from __future__ import annotations

import hashlib
import sqlite3

from export_sqlite_to_supabase import OUTPUT, ROOT, SOURCE, TABLES, identifier, literal


PREVIOUS = ROOT / "banco" / "gestao-antes-atualizacao.db"
TARGET = OUTPUT / "09_atualizacao_dados.sql"


def rows(connection: sqlite3.Connection, table: str, key: str) -> dict[object, sqlite3.Row]:
    return {row[key]: row for row in connection.execute(f"SELECT * FROM {identifier(table)}")}


def matching_row(table: str, columns: list[str], row: sqlite3.Row, key: str) -> str:
    names = ", ".join(identifier(column) for column in columns)
    values = ", ".join(literal(row[column]) for column in columns)
    return (
        f"EXISTS (SELECT 1 FROM public.{identifier(table)} "
        f"WHERE {identifier(key)} = {literal(row[key])} "
        f"AND ROW({names}) IS NOT DISTINCT FROM ROW({values}))"
    )


def generate_update(previous: sqlite3.Connection, current: sqlite3.Connection) -> str:
    statements = [
        "-- Dados pessoais. Execute UMA VEZ no projeto que recebeu o snapshot anterior.",
        f"-- Snapshot anterior SHA-256: {hashlib.sha256(PREVIOUS.read_bytes()).hexdigest()}",
        f"-- Snapshot atual SHA-256: {hashlib.sha256(SOURCE.read_bytes()).hexdigest()}",
        "-- Se o destino divergir, a transação falha sem aplicar parte da atualização.",
        "BEGIN;",
        "SET LOCAL lock_timeout = '10s';",
        "LOCK TABLE " + ", ".join(f"public.{identifier(t)}" for t in TABLES) + " IN SHARE ROW EXCLUSIVE MODE;",
    ]
    changes: dict[str, tuple[list[str], str, dict, dict]] = {}
    checks = [
        "  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.contratos'::regclass "
        "AND tgname = 'contratos_propagar' AND tgenabled = 'O') "
        "THEN RAISE EXCEPTION 'Gatilho de contratos ausente ou desativado'; END IF;"
    ]
    for table in TABLES:
        old_columns = [dict(column) for column in previous.execute(f"PRAGMA table_info({identifier(table)})")]
        new_columns = [dict(column) for column in current.execute(f"PRAGMA table_info({identifier(table)})")]
        if old_columns != new_columns:
            raise ValueError(f"Estrutura diferente em {table}")
        columns = [column["name"] for column in old_columns]
        keys = [column["name"] for column in old_columns if column["pk"]]
        if len(keys) != 1:
            raise ValueError(f"Chave primária inesperada em {table}")
        key = keys[0]
        old_rows, new_rows = rows(previous, table, key), rows(current, table, key)
        changes[table] = (columns, key, old_rows, new_rows)
        checks.append(
            f"  IF (SELECT COUNT(*) FROM public.{identifier(table)}) <> {len(old_rows)} "
            f"THEN RAISE EXCEPTION 'Contagem anterior divergente: {table}'; END IF;"
        )
        for row in old_rows.values():
            checks.append(
                f"  IF NOT {matching_row(table, columns, row, key)} "
                f"THEN RAISE EXCEPTION 'Registro anterior divergente: {table}'; END IF;"
            )
    statements.extend(["DO $verify_old$", "BEGIN", *checks, "END", "$verify_old$;"])

    # O gatilho propaga valores de contratos aos lançamentos; o snapshot já traz ambos.
    statements.append("ALTER TABLE public.contratos DISABLE TRIGGER contratos_propagar;")
    for table in reversed(TABLES):
        _, key, old_rows, new_rows = changes[table]
        for value in old_rows.keys() - new_rows.keys():
            statements.append(
                f"DELETE FROM public.{identifier(table)} WHERE {identifier(key)} = {literal(value)};"
            )
    for table in TABLES:
        columns, key, old_rows, new_rows = changes[table]
        for value, row in new_rows.items():
            if value not in old_rows:
                names = ", ".join(identifier(column) for column in columns)
                values = ", ".join(literal(row[column]) for column in columns)
                statements.append(f"INSERT INTO public.{identifier(table)} ({names}) VALUES ({values});")
            elif tuple(row) != tuple(old_rows[value]):
                changed = [column for column in columns if row[column] != old_rows[value][column]]
                assignments = ", ".join(f"{identifier(column)} = {literal(row[column])}" for column in changed)
                statements.append(
                    f"UPDATE public.{identifier(table)} SET {assignments} "
                    f"WHERE {identifier(key)} = {literal(value)};"
                )
    statements.append("ALTER TABLE public.contratos ENABLE TRIGGER contratos_propagar;")

    checks = []
    for table in TABLES:
        columns, key, old_rows, new_rows = changes[table]
        checks.append(
            f"  IF (SELECT COUNT(*) FROM public.{identifier(table)}) <> {len(new_rows)} "
            f"THEN RAISE EXCEPTION 'Contagem final divergente: {table}'; END IF;"
        )
        for value, row in new_rows.items():
            if value in old_rows and tuple(row) == tuple(old_rows[value]):
                continue
            checks.append(
                f"  IF NOT {matching_row(table, columns, row, key)} "
                f"THEN RAISE EXCEPTION 'Registro final divergente: {table}'; END IF;"
            )
        for value in old_rows.keys() - new_rows.keys():
            checks.append(
                f"  IF EXISTS (SELECT 1 FROM public.{identifier(table)} "
                f"WHERE {identifier(key)} = {literal(value)}) "
                f"THEN RAISE EXCEPTION 'Exclusão divergente: {table}'; END IF;"
            )
        if any(column["name"] == "id" and column["pk"] for column in current.execute(f"PRAGMA table_info({identifier(table)})")):
            sequence = current.execute("SELECT seq FROM sqlite_sequence WHERE name = ?", (table,)).fetchone()
            high_water = sequence[0] if sequence else 0
            statements.append(
                f"SELECT setval(pg_get_serial_sequence('public.{identifier(table)}', 'id'), "
                f"GREATEST((SELECT last_value FROM public.{identifier(table + '_id_seq')}), "
                f"(SELECT COALESCE(MAX(id), 0) FROM public.{identifier(table)}), {high_water}, 1), true);"
            )
    statements.extend(["DO $verify_new$", "BEGIN", *checks, "END", "$verify_new$;", "COMMIT;"])
    return "\n".join(statements) + "\n"


def main() -> None:
    previous = sqlite3.connect(f"file:{PREVIOUS.resolve().as_posix()}?mode=ro", uri=True)
    current = sqlite3.connect(f"file:{SOURCE.resolve().as_posix()}?mode=ro", uri=True)
    for connection in (previous, current):
        connection.row_factory = sqlite3.Row
        if connection.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise ValueError("SQLite inválido")
        if connection.execute("PRAGMA foreign_key_check").fetchall():
            raise ValueError("SQLite com chave estrangeira inválida")
    try:
        TARGET.write_text(generate_update(previous, current), encoding="utf-8")
    finally:
        previous.close()
        current.close()
    print(f"Atualização gerada em {TARGET} (dados pessoais; fora do Git).")


if __name__ == "__main__":
    main()
