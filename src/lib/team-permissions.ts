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

type Membership = { user_id: string; ativo?: boolean; papel?: string; pode_editar?: string[] } | null;

export const isActiveMember = (member: Membership) => Boolean(member && member.ativo !== false);

export const editingPermissions = (member: Membership): string[] =>
  !isActiveMember(member) ? [] : member?.papel === "admin" || !Array.isArray(member?.pode_editar) ? ["*"] : member.pode_editar;
