import assert from "node:assert/strict";
import { commission, deriveRow, gross } from "../src/features/legacy/derived.ts";

const contract = { numero: 12, proprietario: "Pessoa A", inquilino: "Pessoa B", aluguel: 2000, pct_imob: 0.1, iptu: 150 };
const contracts = new Map([[12, contract]]);
const launch = { contrato_numero: 12, aluguel: 2000, pct_imob: 0.1, iptu: 150, recebido_em: "2026-10-01" };
assert.equal(gross(launch), 2150);
assert.equal(commission(launch), 200);
assert.deepEqual(
  (({ proprietario, inquilino, total_bruto, taxa, total_liquido, situacao }) =>
    ({ proprietario, inquilino, total_bruto, taxa, total_liquido, situacao }))(deriveRow("lancamentos", launch, contracts)),
  { proprietario: "Pessoa A", inquilino: "Pessoa B", total_bruto: 2150, taxa: 200, total_liquido: 1950, situacao: "Aguarda repasse" },
);
assert.equal(deriveRow("iptus", { valor_total: 1000, valor_parcela: 300, parcelas_pagas: 4 }, contracts).saldo, 0);
assert.equal(deriveRow("notas_fiscais", { contrato_numero: 12, atividade: "venda", valor: 500 }, contracts, { rent: 4, sale: 8 }).imposto, 40);
console.log("Cálculos de contratos, lançamentos, parcelas e notas OK");
