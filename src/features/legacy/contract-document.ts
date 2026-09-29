import JSZip from "jszip";
import { DOMParser, XMLSerializer, type Node as XmlNode, type Element as XmlElement } from "@xmldom/xmldom";

type Person = { nome?: string; cpf?: string; rg?: string; endereco?: string; email?: string; telefone?: string };
export type ContractDocumentData = {
  owner: Person;
  tenant: Person;
  property: { endereco?: string };
  guarantors: Person[];
  amount: number;
  months: number;
  start: string;
  waterLight: string;
  purpose: string;
  condominium: number;
  iptu: number;
  insurance: number;
  insurer: string;
};

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (value: string) => value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const elements = (node: XmlNode, name: string) => Array.from((node as XmlElement).getElementsByTagNameNS(W, name));
const direct = (node: XmlNode, name: string) => Array.from(node.childNodes).filter((item) => item.localName === name && item.namespaceURI === W);
const content = (node: XmlNode) => elements(node, "t").map((item) => item.textContent ?? "").join("");
function write(node: XmlNode, value: string) {
  const parts = elements(node, "t");
  if (!parts.length) {
    const document = node.ownerDocument;
    if (!document) throw new Error("Modelo Word inválido.");
    const paragraph = node.localName === "p" ? node : direct(node, "p")[0] ?? node.appendChild(document.createElementNS(W, "w:p"));
    const run = paragraph.appendChild(document.createElementNS(W, "w:r"));
    const text = run.appendChild(document.createElementNS(W, "w:t"));
    text.textContent = value;
    (text as XmlElement).setAttribute("xml:space", "preserve");
    return;
  }
  parts[0].textContent = value;
  parts[0].setAttribute("xml:space", "preserve");
  for (const part of parts.slice(1)) part.textContent = "";
}
function dateBR(iso: string) {
  const date = new Date(iso + "T12:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== iso) throw new Error("Data de início do contrato inválida.");
  return iso.slice(8) + "/" + iso.slice(5, 7) + "/" + iso.slice(0, 4);
}
function finishDate(iso: string, months: number) {
  const date = new Date(iso + "T12:00:00Z");
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0, 12)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), last));
  return dateBR(first.toISOString().slice(0, 10));
}
const units = ["", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove"];
const teens = ["dez", "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"];
const tens = ["", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"];
const hundreds = ["", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"];
function underThousand(value: number): string {
  if (value === 100) return "cem";
  const parts: string[] = [];
  if (value >= 100) { parts.push(hundreds[Math.floor(value / 100)]); value %= 100; }
  if (value >= 20) { parts.push(tens[Math.floor(value / 10)]); value %= 10; }
  else if (value >= 10) { parts.push(teens[value - 10]); value = 0; }
  if (value) parts.push(units[value]);
  return parts.join(" e ");
}
function spelled(value: number): string {
  if (value === 0) return "zero";
  if (value < 1000) return underThousand(value);
  if (value >= 1000000) {
    const millions = Math.floor(value / 1000000);
    const rest = value % 1000000;
    return (millions === 1 ? "um milhão" : underThousand(millions) + " milhões")
      + (rest ? (rest < 100 ? " e " : " ") + spelled(rest) : "");
  }
  const thousands = Math.floor(value / 1000);
  const rest = value % 1000;
  return (thousands === 1 ? "mil" : underThousand(thousands) + " mil")
    + (rest ? (rest < 100 ? " e " : " ") + underThousand(rest) : "");
}
function amountWords(value: number) {
  if (!Number.isFinite(value) || value < 0 || value >= 1000000000) throw new Error("Valor do aluguel fora do limite para documento.");
  const centavos = Math.round(value * 100);
  const reais = Math.floor(centavos / 100);
  const cents = centavos % 100;
  return `${spelled(reais)} ${reais === 1 ? "real" : "reais"}`
    + (cents ? ` e ${spelled(cents)} ${cents === 1 ? "centavo" : "centavos"}` : "");
}

export async function fillContractModel(model: Uint8Array, data: ContractDocumentData): Promise<Uint8Array> {
  if (!data.owner.nome || !data.tenant.nome || !data.property.endereco) throw new Error("Vincule proprietário, inquilino e imóvel antes de gerar.");
  if (!Number.isInteger(data.months) || data.months < 1 || data.months > 600) throw new Error("Prazo contratual inválido.");
  if (model.byteLength > 5242880) throw new Error("Modelo Word excede 5 MB.");
  const zip = await JSZip.loadAsync(model);
  const source = zip.file("word/document.xml");
  if (!source) throw new Error("Arquivo DOCX inválido: word/document.xml ausente.");
  const xml = await source.async("string");
  if (xml.length > 2000000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("XML do modelo Word inválido ou excessivo.");
  const document = new DOMParser().parseFromString(xml, "application/xml");
  const tables = elements(document, "tbl");
  const start = dateBR(data.start);
  const end = finishDate(data.start, data.months);
  const rent = `${currency.format(data.amount)} (${amountWords(data.amount)})`;
  const sections: Record<string, Record<string, string>> = {
    LOCADOR: { NOME: data.owner.nome, CPF: data.owner.cpf ?? "" },
    IMOVEL: { ENDERECO: data.property.endereco },
    LOCACAO: {
      "PRAZO CONTRATUAL": `${data.months} (${spelled(data.months)}) meses`,
      "INICIO CONTRATUAL": start, "TERMINO CONTRATUAL": end,
      "VALOR DO ALUGUEL": rent, "AGUA E LUZ": data.waterLight,
      FINALIDADE: data.purpose,
    },
    LOCATARIO: {
      NOME: data.tenant.nome, CPF: data.tenant.cpf ?? "", IDENTIDADE: data.tenant.rg ?? "",
      ENDERECO: data.tenant.endereco ?? "", "E-MAIL": data.tenant.email ?? "",
      TELEFONE: data.tenant.telefone ?? "",
    },
  };
  let filled = 0;
  for (const table of tables) {
    const rows = direct(table, "tr");
    if (!rows.length) continue;
    const heading = normalize(content(direct(rows[0], "tc")[0] ?? rows[0]));
    if (heading.includes("SOLIDARI")) {
      if (!data.guarantors.length) { table.parentNode?.removeChild(table); continue; }
      for (let index = rows.length - 1; index >= 1; index--) {
        const person = data.guarantors[Math.floor((index - 1) / 6)];
        if (!person) { rows[index].parentNode?.removeChild(rows[index]); continue; }
        const cells = direct(rows[index], "tc");
        const key = normalize(content(cells[0] ?? rows[index])).replace(/:$/, "").trim();
        const source = ({ NOME: person.nome, CPF: person.cpf, IDENTIDADE: person.rg, ENDERECO: person.endereco, "E-MAIL": person.email, TELEFONE: person.telefone } as Record<string, string | undefined>)[key];
        if (source !== undefined && cells.length > 1) write(cells[cells.length - 1], source);
      }
      continue;
    }
    const section = Object.entries(sections).find(([key]) => heading.includes(key))?.[1];
    if (!section) continue;
    for (const row of rows.slice(1)) {
      const cells = direct(row, "tc");
      if (cells.length < 2) continue;
      const key = normalize(content(cells[0])).replace(/:$/, "").trim();
      if (section[key] !== undefined) { write(cells[cells.length - 1], section[key]); filled++; }
    }
    if (heading.includes("LOCACAO")) {
      const extras: [string, number][] = [
        ["Condomínio", data.condominium], ["IPTU", data.iptu], ["Seguro fiança" + (data.insurer ? ` · ${data.insurer}` : ""), data.insurance],
      ];
      for (const [label, value] of extras) {
        if (!value) continue;
        const newRow = rows[rows.length - 1].cloneNode(true);
        const cells = direct(newRow, "tc");
        write(cells[0], label + ":");
        write(cells[cells.length - 1], currency.format(value) + " mensais");
        table.appendChild(newRow);
      }
    }
  }
  if (tables.length && filled < 8) throw new Error("O modelo Word não corresponde à estrutura esperada.");
  if (tables.length) {
    const body = elements(document, "body")[0];
    const paragraphs = direct(body, "p");
    let guarantorIndex = 0;
    for (let index = 1; index < paragraphs.length; index++) {
      const label = normalize(content(paragraphs[index]).trim());
      if (label.startsWith("LOCATARI") && label.length < 35) {
        write(paragraphs[index - 1], `${data.tenant.nome} — CPF ${data.tenant.cpf ?? ""}`);
      } else if (label.startsWith("RESPONSAVEL SOLID") && label.length < 45) {
        const person = data.guarantors[guarantorIndex++];
        if (person) write(paragraphs[index - 1], `${person.nome} — CPF ${person.cpf ?? ""}`);
        else {
          paragraphs[index].parentNode?.removeChild(paragraphs[index]);
          paragraphs[index - 1].parentNode?.removeChild(paragraphs[index - 1]);
        }
      }
    }
  }
  if (!tables.length) {
    const body = elements(document, "body")[0];
    let replacements = 0;
    for (const paragraph of direct(body, "p")) {
      const original = content(paragraph);
      const updated = original
        .replace(/O\(a\) Sr\(a\)\., qualificação e endereço/i, `${data.owner.nome}, CPF ${data.owner.cpf ?? ""}`)
        .replace(/Um apartamento situado a (Rua )?X{3,}\.?/i, `O imóvel situado a ${data.property.endereco}.`)
        .replace(/R\$\s*X+\s*\(X+\)/i, rent)
        .replace(/X{3,}\/X{3,}/, start)
        .replace(/12\s*\(doze\)\s*meses/i, `${data.months} (${spelled(data.months)}) meses`);
      if (updated !== original) { write(paragraph, updated); replacements++; }
    }
    if (replacements < 2) throw new Error("Modelo de administração sem campos reconhecidos.");
  }
  zip.file("word/document.xml", new XMLSerializer().serializeToString(document));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

