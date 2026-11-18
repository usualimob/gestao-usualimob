export const editableTables = [
  ["contratos", "Contratos"], ["lancamentos", "Lançamentos"],
  ["pessoas", "Pessoas"], ["imoveis", "Imóveis"], ["leads", "Clientes comerciais"],
  ["iptus", "IPTUs"], ["condominios", "Condomínios"], ["seguros", "Seguros"],
  ["notas_fiscais", "Notas fiscais"], ["config", "Configurações"],
  ["manutencoes", "Manutenções"], ["despesas", "Despesas"],
  ["pendencias", "Repasses pendentes"],
  ["caixas", "Caixas"],
] as const;

export const tableNames: string[] = [...new Set(editableTables.map(([name]) => name))];
