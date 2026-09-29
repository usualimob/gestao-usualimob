import assert from "node:assert/strict";
import { generateDimob } from "../src/features/legacy/dimob.ts";

const config = {
  dimob_cnpj: "12345678000199", dimob_nome: "Imobiliaria Exemplo",
  dimob_cpf_resp: "12345678901", dimob_endereco: "Rua Ficticia 1",
  dimob_uf: "RN", dimob_cod_municipio: "0001", dimob_cep: "59000000",
};
const contracts = [{ numero: 12, proprietario_id: 1, inquilino_id: 2, data_inicio: "2024-02-29", endereco: "Rua Modelo" }];
const people = [{ id: 1, cpf: "12345678901", nome: "Locador Exemplo" }, { id: 2, cpf: "98765432100", nome: "Locatario Exemplo" }];
const entries = [
  { contrato_numero: 12, recebido_em: "2025-01-15", aluguel: 1000, pct_imob: 0.1 },
  { contrato_numero: 12, recebido_em: "2025-02-15", aluguel: 2000, pct_imob: 0.1 },
  { contrato_numero: 12, recebido_em: null, aluguel: 9999, pct_imob: 0.1 },
];
const text = generateDimob(2025, config, contracts, people, entries);
const lines = text.split("\r\n");
assert.equal(lines.length, 5);
assert.equal(lines[0], "DIMOB");
assert.ok(lines[1].startsWith("R01"));
assert.ok(lines[2].startsWith("R02"));
assert.equal(lines[3], "T9");
assert.ok(lines[2].includes("29022024"));
assert.ok(lines[2].includes("00000000100000"));
assert.ok(lines[2].includes("00000000200000"));
assert.ok(!lines[2].includes("9999"));
assert.throws(() => generateDimob(2025, config, [{ ...contracts[0], data_inicio: null }], people, entries), /data de início/);
assert.throws(() => generateDimob(2025, config, contracts, [{ ...people[0], cpf: "" }, people[1]], entries), /CPF\/CNPJ/);
console.log("DIMOB sintética: agrupamento por pagamento, campos fixos e bloqueios OK");

