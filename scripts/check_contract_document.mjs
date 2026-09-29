import assert from "node:assert/strict";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import JSZip from "jszip";
import { fillContractModel } from "../src/features/legacy/contract-document.ts";

const data = {
  owner: { nome: "Locador Teste", cpf: "111.111.111-11" },
  tenant: { nome: "Locatário Teste", cpf: "222.222.222-22", rg: "RG Teste", endereco: "Rua Teste", email: "teste@example.invalid", telefone: "0000" },
  property: { endereco: "Imóvel Teste" },
  guarantors: [],
  amount: 2000,
  months: 30,
  start: "2026-09-24",
  waterLight: "Por conta do locatário",
  purpose: "Residencial",
  condominium: 100,
  iptu: 50,
  insurance: 0,
  insurer: "",
};
const cell = (value) => `<w:tc><w:p><w:r><w:t>${value}</w:t></w:r></w:p></w:tc>`;
const table = (heading, labels) => `<w:tbl><w:tr>${cell(heading)}</w:tr>${labels.map((label) => `<w:tr>${cell(label)}${cell("")}</w:tr>`).join("")}</w:tbl>`;
const synthetic = new JSZip();
synthetic.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${
  table("LOCADOR", ["Nome:", "CPF:"]) + table("IMÓVEL", ["Endereço:"]) +
  table("LOCAÇÃO", ["Prazo contratual:", "Início contratual:", "Término contratual:", "Valor do aluguel:", "Água e luz:", "Finalidade:"]) +
  table("LOCATÁRIO", ["Nome:", "CPF:", "Identidade:", "Endereço:", "E-MAIL:", "Telefone:"])
}</w:body></w:document>`);
const generated = await fillContractModel(await synthetic.generateAsync({ type: "uint8array" }), data);
const generatedZip = await JSZip.loadAsync(generated);
const generatedXml = await generatedZip.file("word/document.xml").async("string");
assert.ok(generatedXml.includes("Locador Teste"));
assert.ok(generatedXml.includes("2.000,00"));
assert.ok(generatedXml.includes("24/03/2029"));
console.log("DOCX sintético: campos, valor e prazo OK");

const base = "codigo/modelos";
if (existsSync(base)) {
  for (const name of readdirSync(base).filter((item) => item.endsWith(".docx"))) {
    const file = readFileSync(`${base}/${name}`);
    const output = await fillContractModel(file, data);
    const zip = await JSZip.loadAsync(output);
    const xml = await zip.file("word/document.xml").async("string");
    assert.ok(xml.includes("Locador Teste"), name);
    assert.ok(xml.includes("Imóvel Teste"), name);
    assert.ok(xml.includes("2.000,00"), name);
    if (!name.includes("Adm")) {
      const withGuarantor = await fillContractModel(file, { ...data, guarantors: [{ nome: "Fiador Teste", cpf: "333.333.333-33" }] });
      const secondZip = await JSZip.loadAsync(withGuarantor);
      const secondXml = await secondZip.file("word/document.xml").async("string");
      assert.ok(secondXml.includes("Fiador Teste"), name);
    }
    console.log(`DOCX ${name}: preenchimento OK`);
  }
}
await assert.rejects(fillContractModel(new Uint8Array([1, 2]), data));

