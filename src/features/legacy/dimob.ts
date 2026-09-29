export type DimobRow = Record<string, unknown>;

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
function numeric(value: unknown, length: number, exact = false): string {
  const result = digits(value);
  if (exact && result.length !== length) throw new Error(`Documento com ${result.length} dígitos; são necessários ${length}.`);
  if (result.length > length) throw new Error(`Número excede ${length} dígitos.`);
  return result.padStart(length, "0");
}
function words(value: unknown, length: number): string {
  const result = String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (result.length > length) throw new Error(`Texto excede ${length} caracteres: ${result.slice(0, 25)}...`);
  return result.padEnd(length, " ");
}
function cents(value: number): string {
  const result = Math.round(value * 100);
  if (!Number.isFinite(result) || result < 0) throw new Error("Valor monetário inválido para DIMOB.");
  return numeric(result, 14);
}
function dateField(value: unknown): string {
  const source = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(source) || Number.isNaN(Date.parse(source)) || new Date(source).toISOString().slice(0, 10) !== source) {
    throw new Error("Informe a data de início real de cada contrato incluído na DIMOB.");
  }
  return source.slice(8, 10) + source.slice(5, 7) + source.slice(0, 4);
}

export function generateDimob(
  year: number, config: Record<string, string>, contracts: DimobRow[],
  people: DimobRow[], entries: DimobRow[],
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 2099) throw new Error("Ano-calendário inválido.");
  const cnpj = numeric(config.dimob_cnpj, 14, true);
  const responsible = numeric(config.dimob_cpf_resp, 11, true);
  const city = numeric(config.dimob_cod_municipio, 4, true);
  const cep = numeric(config.dimob_cep, 8, true);
  const company = words(config.dimob_nome, 60);
  const address = words(config.dimob_endereco, 120);
  const uf = words(config.dimob_uf, 2);
  if (!company.trim() || !address.trim() || !uf.trim()) throw new Error("Preencha nome, endereço e UF do declarante.");

  const contractsById = new Map(contracts.map((row) => [Number(row.numero), row]));
  const peopleById = new Map(people.map((row) => [Number(row.id), row]));
  const grouped = new Map<number, Map<number, [number, number]>>();
  for (const entry of entries) {
    const paid = String(entry.recebido_em ?? "");
    if (!paid.startsWith(`${year}-`)) continue;
    const number = Number(entry.contrato_numero);
    const month = Number(paid.slice(5, 7));
    if (!contractsById.has(number) || month < 1 || month > 12) throw new Error("Lançamento recebido sem contrato ou data válida.");
    const months = grouped.get(number) ?? new Map<number, [number, number]>();
    const previous = months.get(month) ?? [0, 0];
    months.set(month, [previous[0] + Number(entry.aluguel || 0), previous[1] + Number(entry.aluguel || 0) * Number(entry.pct_imob || 0)]);
    grouped.set(number, months);
  }
  if (grouped.size === 0) throw new Error("Não há aluguéis recebidos no ano informado.");
  const lines = ["DIMOB"];
  lines.push("R01" + cnpj + String(year) + "N" + " ".repeat(10) + "N" + " ".repeat(8) + " ".repeat(2)
    + company + responsible + address + uf + city + " ".repeat(20) + " ".repeat(10));

  for (const [index, [number, months]] of [...grouped].sort((a, b) => a[0] - b[0]).entries()) {
    const contract = contractsById.get(number)!;
    const owner = peopleById.get(Number(contract.proprietario_id));
    const tenant = peopleById.get(Number(contract.inquilino_id));
    if (!owner || !tenant) throw new Error(`Contrato ${number}: vincule locador e locatário ao cadastro.`);
    const ownerCpf = numeric(owner.cpf, 14);
    const tenantCpf = numeric(tenant.cpf, 14);
    if (digits(owner.cpf).length !== 11 && digits(owner.cpf).length !== 14) throw new Error(`Contrato ${number}: CPF/CNPJ do locador inválido.`);
    if (digits(tenant.cpf).length !== 11 && digits(tenant.cpf).length !== 14) throw new Error(`Contrato ${number}: CPF/CNPJ do locatário inválido.`);
    const monthly = Array.from({ length: 12 }, (_, offset) => {
      const [rent, fee] = months.get(offset + 1) ?? [0, 0];
      return cents(rent) + cents(fee) + cents(0);
    }).join("");
    lines.push("R02" + cnpj + String(year) + numeric(index + 1, 5)
      + ownerCpf + words(owner.nome, 60) + tenantCpf + words(tenant.nome, 60)
      + numeric(number, 6) + dateField(contract.data_inicio) + monthly + "U"
      + words(contract.endereco, 60) + cep + city + " ".repeat(20) + uf + " ".repeat(10));
  }
  lines.push("T9");
  return lines.join("\r\n") + "\r\n";
}

