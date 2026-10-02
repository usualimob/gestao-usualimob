export type LegacyRow = Record<string, unknown>;

const number = (value: unknown) => Number(value || 0);

export const gross = (row: LegacyRow) =>
  ["aluguel", "tx_incendio", "fianca", "condominio", "iptu", "agua_luz"]
    .reduce((total, key) => total + number(row[key]), 0);

export const commission = (row: LegacyRow) => number(row.aluguel) * number(row.pct_imob);

export function deriveRow(
  table: string,
  row: LegacyRow,
  contracts: Map<number, LegacyRow>,
  taxRates: { rent: number; sale: number } = { rent: 0, sale: 0 },
): LegacyRow {
  if (table === "contratos" || table === "lancamentos") {
    const contract = table === "lancamentos" ? contracts.get(number(row.contrato_numero)) : row;
    const fee = commission(row);
    return {
      ...row,
      proprietario: contract?.proprietario ?? "",
      inquilino: contract?.inquilino ?? "",
      total_bruto: gross(row),
      taxa: fee,
      total_liquido: gross(row) - fee,
      ...(table === "lancamentos" ? {
        situacao: row.repassado_em ? "Repassado" : row.recebido_em ? "Aguarda repasse" : "Pendente",
      } : {}),
    };
  }
  if (table === "iptus" || table === "condominios") {
    return { ...row, saldo: Math.max(number(row.valor_total) - number(row.parcelas_pagas) * number(row.valor_parcela), 0) };
  }
  if (table === "notas_fiscais") {
    const contract = contracts.get(number(row.contrato_numero));
    const rate = row.atividade === "venda" ? taxRates.sale : taxRates.rent;
    return { ...row, proprietario: contract?.proprietario ?? "", inquilino: contract?.inquilino ?? "",
      imposto: number(row.valor) * rate / 100 };
  }
  return row;
}
