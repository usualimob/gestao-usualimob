import assert from "node:assert/strict";
import { getOverviewColumns, modules } from "../src/features/legacy/modules.ts";

assert.deepEqual(getOverviewColumns(modules.lancamentos), ["contrato_numero", "inquilino", "proprietario", "total_bruto", "situacao"]);
assert.deepEqual(getOverviewColumns(modules.contratos), ["numero", "proprietario", "inquilino", "aluguel", "ativo"]);
assert.deepEqual(getOverviewColumns(modules.manutencoes), ["solicitante", "contrato_numero", "situacao", "data_abertura"]);

for (const module of Object.values(modules)) {
  const visible = getOverviewColumns(module);
  assert.ok(visible.length > 0 && visible.length <= 5, `${module.table}: quantidade de colunas`);
  assert.equal(visible[0], module.columns[0], `${module.table}: identificação do registro`);
  assert.equal(new Set(visible).size, visible.length, `${module.table}: colunas duplicadas`);
  assert.ok(visible.every((name) => module.columns.includes(name)), `${module.table}: coluna desconhecida`);
}

console.log("Resumo das tabelas: OK");
