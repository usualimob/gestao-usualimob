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
const tenantOnly = await fillContractModel(await synthetic.generateAsync({ type: "uint8array" }), { ...data, owner: {}, fillMode: "inquilino" });
const tenantXml = await (await JSZip.loadAsync(tenantOnly)).file("word/document.xml").async("string");
assert.ok(tenantXml.includes("Locatário Teste"));
assert.ok(!tenantXml.includes("Locador Teste"));
const ownerOnly = await fillContractModel(await synthetic.generateAsync({ type: "uint8array" }), { ...data, tenant: {}, fillMode: "proprietario" });
const ownerXml = await (await JSZip.loadAsync(ownerOnly)).file("word/document.xml").async("string");
assert.ok(ownerXml.includes("Locador Teste"));
assert.ok(!ownerXml.includes("Locatário Teste"));
console.log("DOCX sintético: campos, valor e prazo OK");

const administration = new JSZip();
administration.file("word/document.xml", `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
  <w:p><w:r><w:t>O(a) Sr(a). , denominado simplesmente PROPRIETÁRIO.</w:t></w:r></w:p>
  <w:p><w:r><w:t>Um apartamento situado a Rua XXXXXXXXXX.</w:t></w:r></w:p>
  <w:p><w:r><w:t>R$ XXXXXXXXX (XXXXXX)</w:t></w:r></w:p>
  <w:p><w:r><w:t>30 (trinta) meses a contar a partir de 13/10/2026</w:t></w:r></w:p>
</w:body></w:document>`);
const administrationOutput = await fillContractModel(await administration.generateAsync({ type: "uint8array" }), {
  ...data, months: 18, start: "2027-01-05", fillMode: "proprietario",
});
const administrationXml = await (await JSZip.loadAsync(administrationOutput)).file("word/document.xml").async("string");
assert.ok(administrationXml.includes("Locador Teste, CPF 111.111.111-11"));
assert.ok(administrationXml.includes("18 (dezoito) meses a contar a partir de 05/01/2027"));
assert.ok(!administrationXml.includes("13/10/2026"));
console.log("DOCX de administração: proprietário, campos XXX e prazo OK");

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
    assert.ok(xml.includes("24/09/2026"), name);
    if (!name.includes("Adm") && !name.includes("sem-nome")) {
      const withGuarantor = await fillContractModel(file, { ...data, guarantors: [{ nome: "Fiador Teste", cpf: "333.333.333-33" }] });
      const secondZip = await JSZip.loadAsync(withGuarantor);
      const secondXml = await secondZip.file("word/document.xml").async("string");
      assert.ok(secondXml.includes("Fiador Teste"), name);
    } else {
      const partial = await fillContractModel(file, { ...data, owner: {}, fillMode: "inquilino" });
      const partialXml = await (await JSZip.loadAsync(partial)).file("word/document.xml").async("string");
      assert.ok(!partialXml.includes("Locador Teste"), name);
    }
    console.log(`DOCX ${name}: preenchimento OK`);
  }
}
await assert.rejects(fillContractModel(new Uint8Array([1, 2]), data));

